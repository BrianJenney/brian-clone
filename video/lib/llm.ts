import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { env } from "../config";

/** Structured-output call. Imported lazily so commands that don't need OpenAI work without the key. */
export async function llmParse<S extends z.ZodTypeAny>(
  schema: S,
  name: string,
  input: string,
  {
    model = env.llmModel,
    instructions,
  }: { model?: string; instructions?: string } = {},
): Promise<z.infer<S>> {
  const { openai } = await import("@/libs/openai");
  const res = await openai.responses.parse({
    model,
    instructions,
    input,
    text: { format: zodTextFormat(schema, name) },
  });
  if (!res.output_parsed)
    throw new Error(`LLM returned no parsed output for ${name}`);
  return res.output_parsed as z.infer<S>;
}
