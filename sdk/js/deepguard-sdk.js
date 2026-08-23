/**
 * deepguard-sdk.js — DeepGuard Client SDK for JavaScript/Node.js
 */
class DeepGuardClient {
  constructor(baseUrl = 'http://localhost:8000/api/v1', apiKey = null) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    return headers;
  }

  async scanUrl(url) {
    const headers = await this.getHeaders();
    const res = await fetch(`${this.baseUrl}/scan/url`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url })
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return res.json();
  }

  async scanFile(fileBlob, filename = 'upload.bin', mimeType = 'application/octet-stream') {
    const headers = {};
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    
    const formData = new FormData();
    formData.append('file', fileBlob, filename);
    formData.append('media_type', mimeType);

    const res = await fetch(`${this.baseUrl}/scan/file`, {
      method: 'POST',
      headers,
      body: formData
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return res.json();
  }

  async getHistory(limit = 50, offset = 0) {
    const headers = await this.getHeaders();
    const res = await fetch(`${this.baseUrl}/scan/history?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return res.json();
  }
}

export { DeepGuardClient };
export default DeepGuardClient;
