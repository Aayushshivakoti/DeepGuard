"""
deepguard_sdk.py — DeepGuard Forensic API SDK for Python
Provides unified client access to upload files, verify links, and query metrics.
"""
from __future__ import annotations

import httpx
from typing import Dict, Any, Optional

class DeepGuardClient:
    def __init__(self, base_url: str = "http://localhost:8000/api/v1", api_key: Optional[str] = None):
        self.base_url = base_url
        self.api_key = api_key
        self.headers = {}
        if api_key:
            self.headers["X-API-Key"] = api_key

    def _get_client(self) -> httpx.Client:
        return httpx.Client(base_url=self.base_url, headers=self.headers, timeout=30.0)

    def scan_url(self, url: str) -> Dict[str, Any]:
        """Scan a URL link for phishing indicators."""
        with self._get_client() as client:
            resp = client.post("/scan/url", json={"url": url})
            resp.raise_for_status()
            return resp.json()

    def scan_file(self, file_path: str, mime_type: Optional[str] = None) -> Dict[str, Any]:
        """Scan an image/audio/video/PDF file for manipulations."""
        with open(file_path, "rb") as f:
            file_bytes = f.read()
        
        filename = file_path.split("/")[-1]
        files = {
            "file": (filename, file_bytes, mime_type or "application/octet-stream")
        }
        
        with self._get_client() as client:
            resp = client.post("/scan/file", files=files)
            resp.raise_for_status()
            return resp.json()

    def get_history(self, limit: int = 50, offset: int = 0) -> Dict[str, Any]:
        """Retrieve paginated verification history."""
        with self._get_client() as client:
            resp = client.get(f"/scan/history?limit={limit}&offset={offset}")
            resp.raise_for_status()
            return resp.json()
