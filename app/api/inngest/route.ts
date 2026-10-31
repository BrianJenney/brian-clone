import { serve } from "inngest/next";
import { functions, inngest } from "@/video/inngest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The longest step is FFmpeg compositing (~1-3 min on a Vercel CPU).
// Raise to 800 on Vercel Pro if long videos time out.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({ client: inngest, functions });
