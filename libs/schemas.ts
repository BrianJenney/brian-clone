import { z } from "zod";

/**
 * Content type enum
 */
export const ContentTypeSchema = z.enum(["transcript", "article", "post"]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

/**
 * Upload request schema
 */
export const UploadRequestSchema = z.object({
  text: z.string().min(1, "Text is required"),
  contentType: ContentTypeSchema,
  metadata: z
    .object({
      title: z.string().optional(),
      date: z.string().optional(),
      tags: z.array(z.string()).optional(),
      sourceUrl: z.string().url().optional(),
      episodeNumber: z.number().optional(),
      author: z.string().optional(),
    })
    .optional(),
});
export type UploadRequest = z.infer<typeof UploadRequestSchema>;

/**
 * Upload response schema
 */
export const UploadResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  chunkIds: z.array(z.string()),
  chunksCreated: z.number(),
});
export type UploadResponse = z.infer<typeof UploadResponseSchema>;

/**
 * Search request schema
 */
export const SearchRequestSchema = z.object({
  query: z.string().min(1, "Query is required"),
  collections: z.array(ContentTypeSchema).optional(),
  limit: z.number().min(1).max(100).default(10),
  filter: z
    .object({
      title: z.string().optional(),
      tags: z.array(z.string()).optional(),
      author: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    })
    .optional(),
});
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

/**
 * Search result schema
 */
export const SearchResultSchema = z.object({
  id: z.union([z.string(), z.number()]),
  score: z.number(),
  text: z.string(),
  contentType: ContentTypeSchema,
  metadata: z.record(z.any()).optional(),
  chunkIndex: z.number().optional(),
  totalChunks: z.number().optional(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

/**
 * Search response schema
 */
export const SearchResponseSchema = z.object({
  success: z.boolean(),
  results: z.array(SearchResultSchema),
  total: z.number(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

/**
 * Delete request schema
 */
export const DeleteRequestSchema = z.object({
  ids: z.array(z.union([z.string(), z.number()])).min(1, "At least one ID is required"),
  collection: ContentTypeSchema,
});
export type DeleteRequest = z.infer<typeof DeleteRequestSchema>;

/**
 * Delete response schema
 */
export const DeleteResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  deletedCount: z.number(),
});
export type DeleteResponse = z.infer<typeof DeleteResponseSchema>;

/**
 * Tool call schemas for chat
 */
export const SearchContentToolSchema = z.object({
  query: z.string().describe("The search query"),
  contentTypes: z
    .array(ContentTypeSchema)
    .optional()
    .describe("Types of content to search (transcript, article, post)"),
  limit: z.number().optional().describe("Maximum number of results to return"),
});
export type SearchContentTool = z.infer<typeof SearchContentToolSchema>;

export const GenerateContentToolSchema = z.object({
  contentType: ContentTypeSchema.describe("Type of content to generate"),
  topic: z.string().describe("Topic for the content"),
  style: z
    .string()
    .optional()
    .describe("Specific style notes or requirements"),
  maxLength: z.number().optional().describe("Maximum length in words"),
});
export type GenerateContentTool = z.infer<typeof GenerateContentToolSchema>;

export const UploadContentToolSchema = z.object({
  text: z.string().describe("The text content to upload"),
  contentType: ContentTypeSchema.describe("Type of content (transcript, article, post)"),
  title: z.string().optional().describe("Title of the content"),
  tags: z.array(z.string()).optional().describe("Tags for the content"),
});
export type UploadContentTool = z.infer<typeof UploadContentToolSchema>;
