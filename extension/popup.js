document.addEventListener('DOMContentLoaded', () => {
  const scanBtn = document.getElementById('scanBtn');
  const urlInput = document.getElementById('urlInput');
  const resultCard = document.getElementById('resultCard');
  const verdictLabel = document.getElementById('verdictLabel');
  const scoreLabel = document.getElementById('scoreLabel');
  const headlineText = document.getElementById('headlineText');

  const toggleSettings = document.getElementById('toggleSettings');
  const scanPanel = document.getElementById('scanPanel');
  const settingsPanel = document.getElementById('settingsPanel');
  const endpointInput = document.getElementById('endpointInput');
  const authStatus = document.getElementById('authStatus');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');

  let activeEndpoint = 'http://localhost:8000/api/v1';

  // 1. Initial State Loading
  chrome.storage.local.get(['lastResult', 'apiGatewayUrl', 'endpointUrl', 'token', 'apiKey'], (data) => {
    if (data.lastResult) {
      displayResult(data.lastResult);
    }
    const savedUrl = data.apiGatewayUrl || data.endpointUrl;
    if (savedUrl) {
      activeEndpoint = savedUrl;
      endpointInput.value = savedUrl;
    }
    
    // Audit active credentials
    if (data.apiKey) {
      authStatus.innerText = 'API Access Key Active';
      authStatus.style.color = '#38bdf8';
    } else if (data.token) {
      authStatus.innerText = 'Synchronized with Web App Session';
      authStatus.style.color = '#10b981';
    } else {
      authStatus.innerText = 'Unauthenticated (Sign in on web dashboard)';
      authStatus.style.color = '#94a3b8';
    }
  });

  // 2. Settings View Toggle
  toggleSettings.addEventListener('click', () => {
    scanPanel.classList.toggle('hidden');
    settingsPanel.classList.toggle('hidden');
  });

  // 3. Save Custom Options
  saveSettingsBtn.addEventListener('click', () => {
    const customEndpoint = endpointInput.value.trim();
    if (!customEndpoint) return;

    chrome.storage.local.set({ apiGatewayUrl: customEndpoint, endpointUrl: customEndpoint }, () => {
      activeEndpoint = customEndpoint;
      scanPanel.classList.remove('hidden');
      settingsPanel.classList.add('hidden');
    });
  });

  // 4. Manual URL Verification Scan
  scanBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) return;

    scanBtn.innerText = 'Scanning...';
    try {
      // Get authentication headers
      const headers = await getAuthHeaders();
      
      const res = await fetch(`${activeEndpoint}/scan/url`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ url })
      });
      const result = await res.json();
      chrome.storage.local.set({ lastResult: result });
      displayResult(result);
    } catch (err) {
      alert('Verification server connection failed.');
    } finally {
      scanBtn.innerText = 'Verify Authenticity';
    }
  });

  async function getAuthHeaders() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['token', 'apiKey'], (data) => {
        const headers = { 'Content-Type': 'application/json' };
        if (data.apiKey) {
          headers['X-API-Key'] = data.apiKey;
        } else if (data.token) {
          headers['Authorization'] = `Bearer ${data.token}`;
        }
        resolve(headers);
      });
    });
  }

  function displayResult(res) {
    resultCard.style.display = 'block';
    
    // Standardize verdict
    const verdict = res.verdict || 'AUTHENTIC';
    verdictLabel.innerText = verdict.replace('_', ' ');
    
    if (verdict === 'AUTHENTIC') {
      verdictLabel.className = 'badge authentic';
    } else if (verdict === 'SUSPICIOUS') {
      verdictLabel.className = 'badge suspicious';
    } else {
      verdictLabel.className = 'badge phishing';
    }
    
    scoreLabel.innerText = `Confidence: ${res.confidence || 0}%`;
    headlineText.innerText = res.simple_summary || res.simple_summary?.headline || 'Forensic analysis completed.';
  }
});
