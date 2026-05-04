/**
 * Browser-only audio decode + Essentia BPM/key + worker feature extraction.
 * Used by upload page and bulk CSV (File or ArrayBuffer from proxied URL).
 */

export type ExtractedAudioFeatures = {
  bpm: number;
  key: string;
  danceability: number;
  aggressiveness: number;
  mood_happy: number;
  mood_relaxed: number;
  mood_sad: number;
  engagement: number;
  approachability: number;
};

function monomix(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels > 1) {
    const L = buffer.getChannelData(0);
    const R = buffer.getChannelData(1);
    return L.map((s, i) => 0.5 * (s + R[i]));
  }
  return buffer.getChannelData(0).slice();
}

function downsampleArray(audioIn: Float32Array, srIn: number, srOut: number): Float32Array {
  if (srIn === srOut) return audioIn;
  const ratio = srIn / srOut;
  const newLength = Math.round(audioIn.length / ratio);
  const result = new Float32Array(newLength);
  let offsetOut = 0,
    offsetIn = 0;
  while (offsetOut < newLength) {
    const nextIn = Math.round((offsetOut + 1) * ratio);
    let accum = 0,
      count = 0;
    for (let i = offsetIn; i < nextIn && i < audioIn.length; i++) {
      accum += audioIn[i];
      count++;
    }
    result[offsetOut++] = accum / count;
    offsetIn = nextIn;
  }
  return result;
}

function shortenAudio(audioIn: Float32Array, keepRatio: number, trim: boolean): Float32Array {
  if (keepRatio < 0.15) keepRatio = 0.15;
  else if (keepRatio > 0.66) keepRatio = 0.66;
  let slice = audioIn;
  if (trim) {
    const d = Math.floor(0.1 * audioIn.length);
    slice = audioIn.subarray(d, audioIn.length - d);
  }
  const patchSamples = 187 * 256;
  const ratioLen = Math.ceil(slice.length * keepRatio);
  const numPatches = Math.ceil(ratioLen / patchSamples);
  const skipSize = Math.floor((slice.length - ratioLen) / Math.max(numPatches - 1, 1));
  const out = new Float32Array(numPatches * patchSamples);
  let writePos = 0,
    start = 0;
  for (let i = 0; i < numPatches; i++) {
    out.set(slice.subarray(start, start + patchSamples), writePos);
    writePos += patchSamples;
    start += patchSamples + skipSize;
  }
  return out;
}

async function decodeToMono16kPatches(arrayBuffer: ArrayBuffer): Promise<{
  audioForNN: Float32Array;
  audioForBpmKey: Float32Array;
}> {
  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
  await ctx.close();
  const mono = monomix(decoded);
  const at16k = downsampleArray(mono, decoded.sampleRate, 16000);
  const audioForNN = shortenAudio(at16k, 0.15, true);
  const half = 15 * 16000;
  const centre = Math.floor(at16k.length / 2);
  const audioForBpmKey = at16k.subarray(
    Math.max(0, centre - half),
    Math.min(at16k.length, centre + half)
  );
  return { audioForNN, audioForBpmKey };
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

let _ess: any = null;
async function getEssentia() {
  if (_ess) return _ess;
  await loadScript('/essentia-wasm.web.js');
  await loadScript('/essentia.js-core.js');
  const wasm = await (window as unknown as { EssentiaWASM: () => Promise<any> }).EssentiaWASM();
  _ess = new wasm.EssentiaJS(false);
  _ess.arrayToVector = wasm.arrayToVector;
  return _ess;
}

let featureWorker: Worker | null = null;
let inferenceWorker: Worker | null = null;
let workersReady: Promise<void> | null = null;

let onFeatDone: ((f: any) => void) | null = null;
let onFeatError: ((e: string) => void) | null = null;
let onPredDone: ((r: Record<string, number>) => void) | null = null;
let onPredError: ((e: string) => void) | null = null;

export function initAudioWorkers(): Promise<void> {
  if (workersReady) return workersReady;
  workersReady = new Promise<void>((resolve, reject) => {
    featureWorker = new Worker('/workers/featureWorker.js');
    featureWorker.onmessage = ({ data }) => {
      if (data.features) onFeatDone?.(data.features);
      else if (data.error) onFeatError?.(data.error);
    };
    featureWorker.onerror = (e) => onFeatError?.(e.message);

    inferenceWorker = new Worker('/workers/inferenceWorker.js');
    inferenceWorker.onmessage = ({ data }) => {
      if (data.ready) resolve();
      else if (data.predictions) onPredDone?.(data.predictions);
      else if (data.error) onPredError?.(data.error);
      else if (data.modelReady) console.info(`model ready: ${data.modelReady}`);
    };
    inferenceWorker.onerror = (e) => {
      reject(new Error(`inferenceWorker: ${e.message}`));
      onPredError?.(e.message);
    };
    inferenceWorker.postMessage({ init: true });
  });
  return workersReady;
}

function computeFeatures(audio: Float32Array): Promise<any> {
  return new Promise((resolve, reject) => {
    onFeatDone = resolve;
    onFeatError = reject;
    const w = featureWorker;
    if (!w) {
      reject(new Error('Feature worker not ready'));
      return;
    }
    w.postMessage({ audio: audio.buffer }, [audio.buffer]);
  });
}

function runInference(features: any): Promise<Record<string, number>> {
  return new Promise((resolve, reject) => {
    onPredDone = resolve;
    onPredError = reject;
    inferenceWorker!.postMessage({ features });
  });
}

/** Full pipeline: decode PCM → Essentia BPM/key → ONNX mood features. */
export async function extractFeaturesFromArrayBuffer(
  arrayBuffer: ArrayBuffer
): Promise<ExtractedAudioFeatures> {
  const { audioForNN, audioForBpmKey } = await decodeToMono16kPatches(arrayBuffer);

  const ess = await getEssentia();
  const vec = ess.arrayToVector(audioForBpmKey);

  let bpm = 120;
  try {
    bpm =
      Math.round(
        ess.PercivalBpmEstimator(vec, 1024, 2048, 128, 128, 210, 50, 16000).bpm
      ) || 120;
  } catch (e) {
    console.warn('[BPM]', e);
  }

  let key = 'Unknown';
  try {
    const k = ess.KeyExtractor(
      vec,
      true,
      4096,
      4096,
      12,
      3500,
      60,
      25,
      0.2,
      'bgate',
      16000,
      0.0001,
      440,
      'cosine',
      'hann'
    );
    key = `${k.key} ${k.scale}`;
  } catch (e) {
    console.warn('[Key]', e);
  }

  vec.delete();

  await initAudioWorkers();
  const features = await computeFeatures(audioForNN);
  const mood = await runInference(features);

  const {
    danceability,
    mood_aggressive: aggressiveness,
    mood_happy,
    mood_relaxed,
    mood_sad,
  } = mood;

  return {
    bpm,
    key,
    danceability,
    aggressiveness,
    mood_happy,
    mood_relaxed,
    mood_sad,
    engagement: Math.min(1, (aggressiveness + mood_happy + danceability) / 3),
    approachability: Math.min(
      1,
      (mood_happy + danceability + (1 - aggressiveness)) / 3
    ),
  };
}

export async function extractFeaturesFromFile(file: File): Promise<ExtractedAudioFeatures> {
  const buf = await file.arrayBuffer();
  return extractFeaturesFromArrayBuffer(buf);
}

/** YouTube / no-audio URL: neutral scalars; embedding comes from text at ingest. */
export function neutralFeaturesForMetadataOnly(): ExtractedAudioFeatures {
  return {
    bpm: 120,
    key: 'Unknown',
    danceability: 0.55,
    aggressiveness: 0.45,
    mood_happy: 0.55,
    mood_relaxed: 0.45,
    mood_sad: 0.25,
    engagement: 0.55,
    approachability: 0.65,
  };
}
