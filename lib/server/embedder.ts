import { pipeline } from '@xenova/transformers';

let embedderPromise: Promise<any> | null = null;

/**
 * Singleton feature-extraction pipeline (384-d MiniLM) for ingest, search, and playlist APIs.
 */
export function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { quantized: true }
    ).catch((err) => {
      embedderPromise = null;
      throw err;
    });
  }
  return embedderPromise;
}

/** Embed text to pgvector literal `[f1,f2,...]`. */
export async function embedTextToVectorLiteral(text: string): Promise<string> {
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  const arr = Array.from(output.data as Float32Array);
  return `[${arr.join(',')}]`;
}
