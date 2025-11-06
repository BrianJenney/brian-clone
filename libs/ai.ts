import { createOpenAI } from "@ai-sdk/openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not defined in environment variables");
}

if (!process.env.HELICONE_API_KEY) {
  throw new Error("HELICONE_API_KEY is not defined in environment variables");
}

/**
 * OpenAI client configured with Helicone for caching and monitoring
 * Use this for AI SDK tool calling and streaming
 */
export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://oai.helicone.ai/v1",
  headers: {
    "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
    "Helicone-Cache-Enabled": "true",
  },
});
