/**
 * Chat module - Native Claude tool-calling
 *
 * Re-exports chat functionality from ./chat directory:
 * - types.ts: Tool definitions and types
 * - tools.ts: Tool execution logic
 * - stream.ts: Streaming logic
 * - index.ts: Public API (chat, chatStream)
 */

export { chat, chatStream } from './chat';
export type { StreamEvent } from './chat';
