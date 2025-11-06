import { tool } from "ai";
import { v4 as uuidv4 } from "uuid";
import { UploadContentToolSchema, ContentType } from "@/libs/schemas";
import { qdrantClient } from "@/libs/qdrant";
import { generateEmbedding } from "@/libs/openai";
import { getCollectionName, chunkTextWithOverlap, noChunking } from "@/libs/utils";

/**
 * Upload content tool
 * Uploads new content to the knowledge base with automatic chunking
 */
export const uploadContentTool = tool({
  description:
    "Upload new content to the knowledge base with automatic chunking",
  inputSchema: UploadContentToolSchema,
  execute: async (args: {
    text: string;
    contentType: ContentType;
    title?: string;
    tags?: string[];
  }) => {
    const { text, contentType, title, tags } = args;
    try {
      const collectionName = getCollectionName(contentType);

      // Chunk based on content type
      const chunks =
        contentType === "post"
          ? noChunking(text)
          : chunkTextWithOverlap(text, 1500);

      const baseId = uuidv4();
      const chunkIds: string[] = [];

      // Upload each chunk
      for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk.text);
        const chunkId =
          chunks.length > 1 ? `${baseId}-chunk-${chunk.index}` : baseId;
        chunkIds.push(chunkId);

        await qdrantClient.upsert(collectionName, {
          wait: true,
          points: [
            {
              id: chunkId,
              vector: embedding,
              payload: {
                text: chunk.text,
                contentType,
                baseId,
                chunkIndex: chunk.index,
                totalChunks: chunk.totalChunks,
                title,
                tags,
                createdAt: new Date().toISOString(),
              },
            },
          ],
        });
      }

      return {
        success: true,
        chunkIds,
        chunksCreated: chunks.length,
        message: `Uploaded ${chunks.length} chunk(s) to ${collectionName}`,
      };
    } catch (error) {
      return {
        error: "Failed to upload content",
        details: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
