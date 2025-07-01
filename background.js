import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.10.0/dist/transformers.min.js';

env.allowRemoteModels = false;
env.localModelPath = chrome.runtime.getURL('web_model/');
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('wasm/');

let nerPipeline = null;

async function loadModel() {
  if (!nerPipeline) {
    nerPipeline = await pipeline('token-classification', 'bert-tiny-ner', { quantized: true });
  }
  return nerPipeline;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'checkPII') {
    (async () => {
      try {
        const model = await loadModel();
        const result = await model(message.text, { aggregation_strategy: 'simple' });
        const piiTags = ['PER', 'ORG', 'LOC', 'MISC'];
        const hasPII = result.some(ent => piiTags.includes(ent.entity_group));
        sendResponse({ pii: hasPII });
      } catch (e) {
        console.error('NER inference error:', e);
        sendResponse({ pii: false, error: e.message });
      }
    })();

    return true; // keep channel open for async response
  }
});
