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

  // Disable internal cache to avoid stale model data issues
  env.cache = false;

  // Load quantized MobileBERT tiny NER model offline
  const ner = await pipeline('token-classification', 'bert-tiny-ner', { quantized: true });
  window.ner = ner;

  // Map LABEL_* tokens from model to human-readable NER groups
  const labelMap = {
    'LABEL_1': 'PER',
    'LABEL_2': 'PER',
    'LABEL_3': 'ORG',
    'LABEL_4': 'ORG',
    'LABEL_5': 'LOC',
    'LABEL_6': 'LOC',
    // Add more mappings here if you find more labels in logs
  };

  // Define which entity groups count as PII for blocking
  const piiTags = ['PER', 'ORG', 'LOC', 'MISC'];

  window.addEventListener('llm-pii-check', async (event) => {
    const { id, text } = event.detail;
    try {
      // Normalize input text to lowercase for better model consistency
      const normalizedText = text.toLowerCase();

      const result = await ner(normalizedText, { aggregation_strategy: 'simple' });
      console.log('Full NER result:', result);

      // Map raw labels to standard entity groups
      const mappedEntities = result.map(ent => ({
        ...ent,
        entity_group: labelMap[ent.entity] || ent.entity
      }));

      // Filter entities by PII groups with confidence > 0.7
      const sensitiveEntities = mappedEntities.filter(ent => piiTags.includes(ent.entity_group) && ent.score > 0.7);

      // Flag as PII if any sensitive entities found
      const hasPII = sensitiveEntities.length > 0;

      window.dispatchEvent(new CustomEvent('llm-pii-result', { detail: { id, hasPII } }));
    } catch (e) {
      console.error('NER error:', e);
      window.dispatchEvent(new CustomEvent('llm-pii-result', { detail: { id, hasPII: false } }));
    }
  });
})();
