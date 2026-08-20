document.addEventListener('DOMContentLoaded', () => {
  const scanBtn = document.getElementById('scanBtn');
  const urlInput = document.getElementById('urlInput');
  const resultCard = document.getElementById('resultCard');
  const verdictLabel = document.getElementById('verdictLabel');
  const scoreLabel = document.getElementById('scoreLabel');
  const headlineText = document.getElementById('headlineText');

  chrome.storage.local.get(['lastResult'], (data) => {
    if (data.lastResult) {
      displayResult(data.lastResult);
    }
  });

  scanBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) return;

    scanBtn.innerText = 'Scanning...';
    try {
      const res = await fetch('http://localhost:8000/api/v1/scan/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  function displayResult(res) {
    resultCard.style.display = 'block';
    verdictLabel.innerText = res.verdict || 'AUTHENTIC';
    verdictLabel.className = 'badge ' + (res.verdict === 'AUTHENTIC' ? 'authentic' : 'phishing');
    scoreLabel.innerText = `Confidence: ${res.confidence}%`;
    headlineText.innerText = res.simple_summary?.headline || 'Scan complete.';
  }
});
