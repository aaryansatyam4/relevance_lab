console.log("LLM Data Leakage Monitor content script loaded!");

// Regex patterns for sensitive data
const regexPatterns = [
  /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g, // SSN
  /\b\d{16}\b/g, // Credit card
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Email 
  /\b\d{10}\b/g, // Phone number
  /AKIA[0-9A-Z]{16}/g, // AWS Access Key ID
  /AIza[0-9A-Za-z\-_]{35}/g, // Google API Key
  /sk[-][a-zA-Z0-9]{32,}/g, // OpenAI API Key
  /sk[_][a-zA-Z0-9]{32,}/g, // OpenAI API Key
  /(?<![A-Za-z0-9])[A-Za-z0-9]{32}(?![A-Za-z0-9])/g, // Generic 32-char key/token
  /(?<![A-Za-z0-9])[A-Za-z0-9]{40}(?![A-Za-z0-9])/g, // Generic 40-char key/token
  /(?<![A-Za-z0-9])[A-Za-z0-9]{64}(?![A-Za-z0-9])/g, // Generic 64-char key/token
  new RegExp('api[_-]?key\\s*[:=]\\s*[A-Za-z0-9\-_]{16,}', 'gi'), // api_key or api-key assignment
  new RegExp('secret[_-]?key\\s*[:=]\\s*[A-Za-z0-9\-_]{16,}', 'gi'), // secret_key or secret-key assignment
  new RegExp('access[_-]?token\\s*[:=]\\s*[A-Za-z0-9\-_]{16,}', 'gi') // access_token or access-token assignment
];

function containsSensitiveRegex(text) {
  return regexPatterns.some((pattern) => pattern.test(text));
}

function showToast(message) {
  // Remove existing toast if present
  const existing = document.getElementById('llm-data-leakage-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'llm-data-leakage-toast';
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.bottom = '30px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.background = '#d32f2f';
  toast.style.color = '#fff';
  toast.style.padding = '12px 24px';
  toast.style.borderRadius = '6px';
  toast.style.fontSize = '16px';
  toast.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
  toast.style.zIndex = 99999;
  toast.style.opacity = '0.95';
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function blockInput(element) {
  element.style.backgroundColor = '#ffcccc';
  element.setCustomValidity && element.setCustomValidity('Sensitive data detected!');
  showToast('Sensitive data detected!');
}

function clearBlock(element) {
  element.style.backgroundColor = '';
  element.setCustomValidity && element.setCustomValidity('');
}

(() => {
  const inputs = document.querySelectorAll('input[type="text"], textarea');
  inputs.forEach((input) => {
    input.addEventListener('input', (e) => {
      const value = e.target.value;
      if (containsSensitiveRegex(value)) {
        blockInput(e.target);
      } else {
        clearBlock(e.target);
      }
    });
  });
})(); 