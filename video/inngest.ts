/**
 * Durable render workflow (https://www.inngest.com).
 *
 * Why: a final render takes several minutes (HeyGen alone is 2–10 min). A
 * Vercel function can't sit and wait that long, and the MCP tool call
 * shouldn't. The MCP tool sends `video/render.requested` and returns
 * immediately; Inngest calls /api/inngest once per step, sleeps between
 * HeyGen checks without holding a function open, and retries a failed step
 * without re-running (or re-paying for) the ones before it.
 *
 * Progress is mirrored into the job record, so `video_get_job` always knows
 * where a render is: you never need the Inngest dashboard to find a video.
 */
import { Inngest } from "inngest";
import type { RenderMode } from "./jobs";
import { setRun } from "./jobs";
import {
  stepAvatarCheck,
  stepAvatarStart,
  stepCompose,
  stepVoice,
} from "./steps";

export const inngest = new Inngest({ id: "brian-clone" });

export const RENDER_EVENT = "video/render.requested";

export type RenderEventData = {
  jobId: string;
  mode: RenderMode;
  label?: string;
};

export async function requestRender(data: RenderEventData) {
  await inngest.send({ name: RENDER_EVENT, data });
}

export const renderVideo = inngest.createFunction(
  {
    id: "video-render",
    name: "Render short-form video",
    triggers: [{ event: RENDER_EVENT }],
    retries: 3,
    // One render per job at a time; a few jobs in parallel overall.
    concurrency: [{ key: "event.data.jobId", limit: 1 }, { limit: 3 }],
    onFailure: async ({ event, error }) => {
      const original = (event.data as { event?: { data?: RenderEventData } })
        .event;
      const jobId = original?.data?.jobId;
      if (jobId) await setRun(jobId, { stage: "failed", error: error.message });
    },
  },
  async ({ event, step }) => {
    const { jobId, mode, label } = event.data as RenderEventData;

    await step.run("voice", async () => {
      await setRun(jobId, {
        mode,
        stage: "voice",
        startedAt: new Date().toISOString(),
        error: null,
        detail: null,
      });
      return stepVoice(jobId, mode);
    });

    const ids = await step.run("avatar-start", async () => {
      await setRun(jobId, { stage: "avatar" });
      return stepAvatarStart(jobId, mode);
    });

    // ~45 min ceiling at 30s intervals. Each check is its own short invocation.
    let pending = ids;
    for (let i = 0; i < 90 && pending.length; i++) {
      const states = await step.run(`avatar-check-${i}`, async () =>
        Promise.all(
          pending.map(async (vid) => ({
            vid,
            state: await stepAvatarCheck(jobId, vid),
          })),
        ),
      );
      pending = states.filter((x) => x.state === "pending").map((x) => x.vid);
      if (pending.length) await step.sleep(`avatar-wait-${i}`, "30s");
    }
    if (pending.length)
      throw new Error(
        `HeyGen render(s) ${pending.join(", ")} still not done after 45 min`,
      );

    const result = await step.run("compose", async () => {
      await setRun(jobId, { stage: "compositing", detail: null });
      return stepCompose(jobId, mode, { label });
    });

    await step.run("done", () =>
      setRun(jobId, { stage: "done" }).then(() => null),
    );
    return result;
  },
);

export const functions = [renderVideo];
