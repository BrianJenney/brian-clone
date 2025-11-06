/**
 * Chunking utilities for text processing
 */

export interface Chunk {
  text: string;
  index: number;
  totalChunks: number;
}

/**
 * Splits text into sentences (roughly)
 */
function splitIntoSentences(text: string): string[] {
  // Split on period, exclamation, question mark followed by space or end
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [];
  return sentences.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Chunks text with overlap of last sentence from previous chunk
 * Used for articles and transcripts
 */
export function chunkTextWithOverlap(
  text: string,
  maxChunkSize: number = 1500
): Chunk[] {
  const sentences = splitIntoSentences(text);

  if (sentences.length === 0) {
    return [];
  }

  const chunks: Chunk[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;
  let lastSentence = "";

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceLength = sentence.length;

    // If adding this sentence would exceed the limit and we have content
    if (currentLength + sentenceLength > maxChunkSize && currentChunk.length > 0) {
      // Save current chunk
      const chunkText = currentChunk.join(" ");
      chunks.push({
        text: chunkText,
        index: chunks.length,
        totalChunks: 0, // Will be updated later
      });

      // Start new chunk with last sentence from previous chunk (overlap)
      lastSentence = currentChunk[currentChunk.length - 1];
      currentChunk = [lastSentence, sentence];
      currentLength = lastSentence.length + sentenceLength + 1; // +1 for space
    } else {
      // Add sentence to current chunk
      currentChunk.push(sentence);
      currentLength += sentenceLength + (currentChunk.length > 1 ? 1 : 0); // +1 for space between sentences
    }
  }

  // Add final chunk if there's remaining content
  if (currentChunk.length > 0) {
    chunks.push({
      text: currentChunk.join(" "),
      index: chunks.length,
      totalChunks: 0,
    });
  }

  // Update totalChunks for all chunks
  const totalChunks = chunks.length;
  chunks.forEach((chunk) => {
    chunk.totalChunks = totalChunks;
  });

  return chunks;
}

/**
 * Returns text as-is (no chunking) for posts
 */
export function noChunking(text: string): Chunk[] {
  return [
    {
      text,
      index: 0,
      totalChunks: 1,
    },
  ];
}
