// DeepGuard Content Script (Manifest V3)
// Handles JWT token sync from Web App and overlays inline results badges on web images.

// 1. Sync JWT token and API Key from web application storage
if (window.location.host === 'localhost:5173' || window.location.host === 'localhost:3000') {
  const token = localStorage.getItem('token');
  const apiKey = localStorage.getItem('api_key');
  if (token || apiKey) {
    chrome.runtime.sendMessage({
      action: 'SYNC_AUTH',
      token: token,
      apiKey: apiKey
    });
  }
}

// 2. Inline badge overlay on web images
// Scans page images and appends a floating status badge indicator (green/red)
function injectImageBadges() {
  const images = document.querySelectorAll('img');
  
  images.forEach((img) => {
    // Skip small icons or already badged images
    if (img.width < 100 || img.height < 100 || img.dataset.deepguardIndexed) {
      return;
    }
    
    img.dataset.deepguardIndexed = "true";
    
    // Create wrapper container if not present
    const parent = img.parentNode;
    if (!parent) return;
    
    // Create badge element
    const badge = document.createElement('div');
    badge.className = 'deepguard-inline-badge';
    badge.style.position = 'absolute';
    badge.style.top = '8px';
    badge.style.left = '8px';
    badge.style.zIndex = '99999';
    badge.style.padding = '4px 8px';
    badge.style.borderRadius = '6px';
    badge.style.fontSize = '9px';
    badge.style.fontWeight = '900';
    badge.style.fontFamily = 'sans-serif';
    badge.style.cursor = 'pointer';
    badge.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
    
    // Default scanning/unverified status
    badge.style.background = 'rgba(15, 23, 42, 0.85)';
    badge.style.color = '#38bdf8';
    badge.style.border = '1px solid #0284c7';
    badge.innerText = 'DG VERIFY';
    
    // Listen for click to run dynamic verification
    badge.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      badge.innerText = 'SCANNING...';
      badge.style.background = 'rgba(245, 158, 11, 0.85)';
      badge.style.color = '#fff';
      badge.style.border = '1px solid #d97706';
      
      chrome.runtime.sendMessage({
        action: 'SCAN_IMAGE_URL',
        url: img.src
      }, (response) => {
        if (response && response.verdict) {
          updateBadge(badge, response.verdict, response.confidence);
        } else {
          badge.innerText = 'OFFLINE';
          badge.style.background = 'rgba(71, 85, 105, 0.85)';
          badge.style.border = '1px solid #475569';
        }
      });
    });
    
    // Position parent relative to support absolute badges
    if (window.getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }
    parent.appendChild(badge);
  });
}

function updateBadge(badge, verdict, confidence) {
  if (verdict === 'AUTHENTIC') {
    badge.innerText = `✓ AUTHENTIC (${Math.round(confidence)}%)`;
    badge.style.background = 'rgba(22, 163, 74, 0.9)';
    badge.style.color = '#fff';
    badge.style.border = '1px solid #16a34a';
  } else if (verdict === 'SUSPICIOUS') {
    badge.innerText = `⚠ SUSPICIOUS (${Math.round(confidence)}%)`;
    badge.style.background = 'rgba(217, 119, 6, 0.9)';
    badge.style.color = '#fff';
    badge.style.border = '1px solid #d97706';
  } else {
    badge.innerText = `☠ DEEPFAKE (${Math.round(confidence)}%)`;
    badge.style.background = 'rgba(220, 38, 38, 0.9)';
    badge.style.color = '#fff';
    badge.style.border = '1px solid #dc2626';
  }
}

// Automatically check for new images dynamically (SPA navigation support)
const observer = new MutationObserver(() => {
  injectImageBadges();
});

observer.observe(document.body, { childList: true, subtree: true });

// Run initial injection
injectImageBadges();
