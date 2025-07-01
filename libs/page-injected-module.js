// Patch Cache.prototype.put to silently ignore chrome-extension scheme errors
(function() {
  const originalPut = Cache.prototype.put;
  Cache.prototype.put = function(request, response) {
    try {
      return originalPut.call(this, request, response).catch(err => {
        if (!err.message.includes("Request scheme 'chrome-extension'")) {
          return Promise.reject(err);
        }
        // Silently ignore this specific error
        return Promise.resolve();
      });
    } catch (err) {
      if (!err.message.includes("Request scheme 'chrome-extension'")) {
        throw err;
      }
      // Silently ignore this specific error
      return Promise.resolve();
    }
  };
})();

import { pipeline, env } from './transformers.min.js';

function getInjectedScriptTag() {
  const scripts = [...document.querySelectorAll('script[type="module"]')];
  return scripts.reverse().find(
    s => s.hasAttribute('data-model-path') && s.hasAttribute('data-wasm-path')
  );
}

(async () => {
  const scriptTag = getInjectedScriptTag();
  if (!scriptTag) {
    throw new Error('Injected module script tag with data attributes not found');
  }

  const modelPath = scriptTag.getAttribute('data-model-path');
  const wasmPath = scriptTag.getAttribute('data-wasm-path');

  env.allowRemoteModels = false;
  env.localModelPath = modelPath;
  env.backends.onnx.wasm.wasmPaths = wasmPath;

  // Optional: disable internal transformers cache (may help)
  env.cache = false;

  const ner = await pipeline('token-classification', 'bert-tiny-ner', { quantized: true });

  window.ner = ner;

  // Map LABEL_* to standard NER entity groups
  const labelMap = {
    'LABEL_1': 'PER',
    'LABEL_2': 'PER',
    'LABEL_3': 'ORG',
    'LABEL_4': 'ORG',
    'LABEL_5': 'LOC',
    'LABEL_6': 'LOC',
    // Add more if your model outputs additional labels
  };

  const piiTags = ['PER', 'ORG', 'LOC', 'MISC'];

  window.addEventListener('llm-pii-check', async (event) => {
    const { id, text } = event.detail;
    try {
      const result = await ner(text, { aggregation_strategy: 'simple' });
      console.log('Full NER result:', result);

      // Map raw entity labels to standard groups
      const mappedEntities = result.map(ent => ({
        ...ent,
        entity_group: labelMap[ent.entity] || ent.entity
      }));

      // Filter only entities that are PII relevant
      const sensitiveEntities = mappedEntities.filter(ent => piiTags.includes(ent.entity_group));

      const hasPII = sensitiveEntities.length > 0;

      window.dispatchEvent(new CustomEvent('llm-pii-result', { detail: { id, hasPII } }));
    } catch (e) {
      console.error('NER processing error:', e);
      window.dispatchEvent(new CustomEvent('llm-pii-result', { detail: { id, hasPII: false } }));
    }
  });
})();
