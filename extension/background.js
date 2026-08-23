// DeepGuard Chrome Service Worker (Manifest V3)
// Intercepts context menus, handles auth sync, and routes scanner API requests.

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "deepguard_verify_image",
    title: "Verify Image with DeepGuard",
    contexts: ["image"]
  });

  chrome.contextMenus.create({
    id: "deepguard_verify_link",
    title: "Scan Link for Phishing with DeepGuard",
    contexts: ["link"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "deepguard_verify_link" && info.linkUrl) {
    scanUrl(info.linkUrl);
  } else if (info.menuItemId === "deepguard_verify_image" && info.srcUrl) {
    scanImageUrl(info.srcUrl);
  }
});

// Listener for messages from popup.js and content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SYNC_AUTH') {
    // Save authentication details to extension storage
    chrome.storage.local.set({ 
      token: message.token,
      apiKey: message.apiKey
    }, () => {
      console.log('DeepGuard Extension Auth Synced.');
    });
  }
  
  if (message.action === 'SCAN_IMAGE_URL') {
    // Scan page image url requested by badge click
    performImageScan(message.url).then(res => {
      sendResponse(res);
    }).catch(err => {
      sendResponse({ error: err.message });
    });
    return true; // Keep message channel open for async response
  }
});

async function getAuthHeaders() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['token', 'apiKey'], (data) => {
      const headers = { "Content-Type": "application/json" };
      if (data.apiKey) {
        headers["X-API-Key"] = data.apiKey;
      } else if (data.token) {
        headers["Authorization"] = `Bearer ${data.token}`;
      }
      resolve(headers);
    });
  });
}

async function getGatewayUrl() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiGatewayUrl'], (data) => {
      resolve(data.apiGatewayUrl || 'http://localhost:8000/api/v1');
    });
  });
}

async function scanUrl(targetUrl) {
  try {
    const headers = await getAuthHeaders();
    const gateway = await getGatewayUrl();
    const res = await fetch(`${gateway}/scan/url`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ url: targetUrl })
    });
    const data = await res.json();
    chrome.storage.local.set({ lastResult: data });
  } catch (err) {
    console.error("DeepGuard Extension Scan Error:", err);
  }
}

async function scanImageUrl(srcUrl) {
  try {
    const headers = await getAuthHeaders();
    const gateway = await getGatewayUrl();
    const res = await fetch(`${gateway}/scan/url`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ url: srcUrl })
    });
    const data = await res.json();
    chrome.storage.local.set({ lastResult: data });
  } catch (err) {
    console.error("DeepGuard Extension Image Scan Error:", err);
  }
}

async function performImageScan(srcUrl) {
  const headers = await getAuthHeaders();
  const gateway = await getGatewayUrl();
  const res = await fetch(`${gateway}/scan/url`, {
    method: "POST",
    headers: headers,
    body: JSON.stringify({ url: srcUrl })
  });
  if (!res.ok) {
    throw new Error('API request failed');
  }
  return await res.json();
}
