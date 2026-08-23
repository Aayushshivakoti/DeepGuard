"""
locustfile.py — Load Testing Script for DeepGuard Forensic Gateway
Runs high-concurrency API performance testing for file scans and URL lookups.
"""
from __future__ import annotations

import io
import random
from locust import HttpUser, task, between

class DeepGuardLoadTestUser(HttpUser):
    wait_time = between(1.0, 3.0)

    @task(3)
    def test_health_check(self):
        """Monitor gateway latency on simple endpoints."""
        self.client.get("/health")
        self.client.get("/readiness")

    @task(5)
    def test_url_scan(self):
        """Simulate high-concurrency URL scanning requests."""
        payload = {
            "url": f"https://phish-target-{random.randint(1000, 9999)}.xyz/verify"
        }
        self.client.post("/api/v1/scan/url", json=payload)

    @task(2)
    def test_file_scan_light(self):
        """Simulate small media file uploads (100KB dummy image)."""
        file_content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100000 # Dummy PNG bytes
        file_obj = io.BytesIO(file_content)
        
        files = {
            "file": ("test_image.png", file_obj, "image/png")
        }
        self.client.post("/api/v1/scan/file", files=files)

    @task(1)
    def test_scan_history(self):
        """Query paginated results."""
        self.client.get("/api/v1/scan/history?limit=20&offset=0")
