import { generateText, Output, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

const webTracksSchema = z.object({
  tracks: z
    .array(
      z.object({
        title: z.string().describe('Song or release title as on current charts or playlists'),
        artist: z
          .string()
          .nullable()
          .describe('Primary credited artist; null only if truly unknown'),
      })
    )
    .max(150)
    .describe('Ordered list: strongest / most relevant matches first (may be long; server keeps top after catalog match)'),
  rationale: z
    .string()
    .describe(
      'One short sentence on what you used from the web (e.g. weekly chart, playlist). Use an empty string if none.'
    ),
});

export type ZipdjWebTracksOutput = z.infer<typeof webTracksSchema>;

function buildUserPrompt(args: {
  originalPrompt: string;
  webQuery: string;
  maxTracks: number;
  temporalContext: string | null;
}): string {
  const timeBlock =
    args.temporalContext != null && args.temporalContext.trim() !== ''
      ? `\nTimeframe (use when searching and ranking; prefer sources that match it):\n"""${args.temporalContext.trim()}"""\n`
      : '';

  return `You are a music chart researcher. Use the web_search_preview tool as needed to answer accurately.

User request (verbatim):
"""${args.originalPrompt}"""

Suggested search focus (from router):
"""${args.webQuery}"""
${timeBlock}
Task:
1. Search the web for facts that satisfy the user request (prefer **current** weekly / viral / Spotify-style charts or reputable playlist pages — avoid relying only on "all-time most streamed" tables unless the user asked for all-time).
2. Produce a JSON object matching the schema: up to ${args.maxTracks} distinct tracks in \`tracks\` (aim for the full count when the web supports it — the app will match a subset to a DJ catalog). Each entry: canonical **title** (song / release name) and **artist** (string or null). Order: strongest / most authoritative chart or playlist signal first.

Be conservative: only include tracks you believe are supported by web results you found.`;
}

export interface ZipdjAiWebSearchResult {
  output: ZipdjWebTracksOutput;
  /** Model text (may include reasoning beyond JSON). */
  text: string;
  /** Serialized sources from the model (URLs, titles). */
  sources: unknown;
  /** Total steps (tool + generation). */
  stepCount: number;
}

/**
 * OpenAI Responses API + built-in web search (via AI SDK), structured output for chart titles.
 * Uses OPENAI_API_KEY and OPENAI_PROMPT_MODEL (must be a Responses-capable id, e.g. gpt-4o-mini, gpt-5.5).
 */
export async function runZipdjWebSearchWithAiSdk(options: {
  originalPrompt: string;
  webQuery: string;
  maxTracks: number;
  /** Explicit calendar windows for "this week" / "this year" / "last N days" (server-computed). */
  temporalContext?: string | null;
}): Promise<ZipdjAiWebSearchResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const modelId = (process.env.OPENAI_PROMPT_MODEL || 'gpt-4o-mini').trim();
  const openai = createOpenAI({ apiKey });

  const result = await generateText({
    model: openai.responses(modelId),
    system:
      'You are a precise music data assistant. Always use web search when the user asks for trending, charts, or time-sensitive lists. Prefer weekly/regional chart pages or official Spotify playlist pages over generic SEO pages.',
    prompt: buildUserPrompt({
      originalPrompt: options.originalPrompt,
      webQuery: options.webQuery,
      maxTracks: options.maxTracks,
      temporalContext: options.temporalContext ?? null,
    }),
    tools: {
      web_search_preview: openai.tools.webSearchPreview({
        searchContextSize: 'high',
      }),
    },
    stopWhen: stepCountIs(24),
    output: Output.object({
      schema: webTracksSchema,
      name: 'chart_tracks',
      description: 'Structured tracks grounded in web search',
    }),
  });

  const output = result.output;
  if (!output || !Array.isArray(output.tracks)) {
    throw new Error('AI SDK returned no structured chart output');
  }

  return {
    output: {
      tracks: output.tracks.slice(0, options.maxTracks),
      rationale: output.rationale?.trim() ?? '',
    },
    text: result.text,
    sources: result.sources,
    stepCount: result.steps.length,
  };
}
