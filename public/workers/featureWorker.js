// public/workers/featureWorker.js
// All local files — no CDN, no network latency inside the worker

importScripts('/essentia.js-model.umd.js');
importScripts('/essentia-wasm.module.js'); // sets global `Module` synchronously

const extractor = new EssentiaModel.EssentiaTFInputExtractor(Module, 'musicnn', false);

self.onmessage = function (msg) {
    if (!msg.data.audio) return;
    try {
        const audio    = new Float32Array(msg.data.audio);
        const features = extractor.computeFrameWise(audio, 256);
        self.postMessage({ features });
    } catch (e) {
        self.postMessage({ error: String(e) });
    }
};

// import { EssentiaModel } from "/essentia.js-model.umd.js";
// import { EssentiaWASM } from "/essentia-wasm-0.1.0.module.js";q

// // essentia-wasm.module.js sets global `Module` synchronously
// const EssentiaWASM = Module;
// const extractor    = new EssentiaModel.EssentiaTFInputExtractor(EssentiaWASM, 'musicnn', false);

// self.onmessage = function (msg) {
//     if (!msg.data.audio) return;
//     try {
//         const audio    = new Float32Array(msg.data.audio);
//         const features = extractor.computeFrameWise(audio, 256); // hopSize=256, exact demo value
//         self.postMessage({ features });
//     } catch (e) {
//         self.postMessage({ error: String(e) });
//     }
// };

