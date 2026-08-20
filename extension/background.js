// DeepGuard Chrome Service Worker (Manifest V3)

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

async function scanUrl(targetUrl) {
  try {
    const res = await fetch("http://localhost:8000/api/v1/scan/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: targetUrl })
    });
    const data = await res.json();
    chrome.storage.local.set({ lastResult: data });
    chrome.action.openPopup();
  } catch (err) {
    console.error("DeepGuard Extension Scan Error:", err);
  }
}

async function scanImageUrl(srcUrl) {
  try {
    const res = await fetch("http://localhost:8000/api/v1/scan/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: srcUrl })
    });
    const data = await res.json();
    chrome.storage.local.set({ lastResult: data });
  } catch (err) {
    console.error("DeepGuard Extension Image Scan Error:", err);
  }
}
