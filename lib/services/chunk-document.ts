const CHUNKING_THRESHOLD_CHARS = 16_000;
const MAX_CHUNK_CHARS = 50_000;

function splitOversizedSegment(segment: string, maxChars: number): string[] {
  if (segment.length <= maxChars) return [segment];

  const sentenceParts =
    segment.match(/[^.!?\n]+(?:[.!?]+|\n|$)/g)?.map((part) => part.trim()) ?? [];
  if (sentenceParts.length <= 1) {
    const chunks: string[] = [];
    for (let i = 0; i < segment.length; i += maxChars) {
      chunks.push(segment.slice(i, i + maxChars));
    }
    return chunks;
  }

  const chunks: string[] = [];
  let current = "";
  for (const part of sentenceParts) {
    if (!part) continue;
    const candidate = current ? `${current} ${part}` : part;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    if (part.length <= maxChars) {
      current = part;
    } else {
      chunks.push(...splitOversizedSegment(part, maxChars));
      current = "";
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function splitIntoLogicalSegments(content: string): string[] {
  const paragraphSegments = content
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (paragraphSegments.length > 1) return paragraphSegments;

  const lineSegments = content
    .split("\n")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (lineSegments.length > 1) return lineSegments;

  return [content.trim()].filter(Boolean);
}

export function shouldChunkDocument(content: string | null | undefined): boolean {
  if (!content) return false;
  return content.length > CHUNKING_THRESHOLD_CHARS;
}

export function buildDocumentChunks(
  title: string,
  content: string
): Array<{ title: string; content: string; chunkIndex: number }> {
  const logicalSegments = splitIntoLogicalSegments(content);
  const normalizedSegments = logicalSegments.flatMap((segment) =>
    splitOversizedSegment(segment, MAX_CHUNK_CHARS)
  );

  const chunks: string[] = [];
  let current = "";
  for (const segment of normalizedSegments) {
    const next = current ? `${current}\n\n${segment}` : segment;
    if (next.length <= MAX_CHUNK_CHARS) {
      current = next;
      continue;
    }
    if (current) chunks.push(current);
    current = segment;
  }
  if (current) chunks.push(current);

  return chunks.map((chunkContent, index) => ({
    title: `${title} (Chunk ${index + 1})`,
    content: chunkContent,
    chunkIndex: index,
  }));
}

export function buildChunkEmbeddingText(chunkContent: string, maxChars = 8_000): string {
  if (chunkContent.length <= maxChars) return chunkContent;

  const marker = "\n\n[...]\n\n";
  const available = maxChars - marker.length * 2;
  const segmentSize = Math.max(Math.floor(available / 3), 500);

  const head = chunkContent.slice(0, segmentSize);
  const middleStart = Math.max(
    Math.floor(chunkContent.length / 2) - Math.floor(segmentSize / 2),
    0
  );
  const middle = chunkContent.slice(middleStart, middleStart + segmentSize);
  const tail = chunkContent.slice(-segmentSize);

  return `${head}${marker}${middle}${marker}${tail}`.slice(0, maxChars);
}

export const documentChunkingConfig = {
  thresholdChars: CHUNKING_THRESHOLD_CHARS,
  maxChunkChars: MAX_CHUNK_CHARS,
};
