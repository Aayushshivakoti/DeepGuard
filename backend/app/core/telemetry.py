"""
app/core/telemetry.py — Prometheus Metrics & OpenTelemetry Tracing

Provides:
  - Custom Prometheus-formatted metrics exporter (/metrics)
  - HTTP Request counter, latency histogram, and active scans tracker
  - OpenTelemetry context propagation and tracing simulation
"""
from __future__ import annotations

import time
from typing import Dict, List
from fastapi import Request, Response
from fastapi.responses import PlainTextResponse

# In-memory Prometheus registry
HTTP_REQUESTS_TOTAL = {}  # (method, path, status) -> count
HTTP_REQUEST_DURATION_SECONDS = []  # List of floats for simple avg latency
ACTIVE_SCANS = 0


def instrument_request(method: str, path: str, status_code: int, duration: float):
    """Record request latency and count for Prometheus export."""
    key = (method, path, str(status_code))
    HTTP_REQUESTS_TOTAL[key] = HTTP_REQUESTS_TOTAL.get(key, 0) + 1
    HTTP_REQUEST_DURATION_SECONDS.append(duration)
    # Keep list capped to avoid memory growth
    if len(HTTP_REQUEST_DURATION_SECONDS) > 10000:
        HTTP_REQUEST_DURATION_SECONDS.pop(0)


def increment_active_scans():
    global ACTIVE_SCANS
    ACTIVE_SCANS += 1


def decrement_active_scans():
    global ACTIVE_SCANS
    ACTIVE_SCANS = max(0, ACTIVE_SCANS - 1)


def get_prometheus_metrics() -> str:
    """Format in-memory metrics to Prometheus text format."""
    lines = []

    # 1. Requests counter
    lines.append("# HELP http_requests_total Total number of HTTP requests.")
    lines.append("# TYPE http_requests_total counter")
    for (method, path, status_code), count in HTTP_REQUESTS_TOTAL.items():
        lines.append(f'http_requests_total{{method="{method}",path="{path}",status="{status_code}"}} {count}')

    # 2. Latency metrics
    avg_latency = (sum(HTTP_REQUEST_DURATION_SECONDS) / len(HTTP_REQUEST_DURATION_SECONDS)) if HTTP_REQUEST_DURATION_SECONDS else 0.0
    lines.append("# HELP http_request_duration_seconds_avg Average HTTP request latency in seconds.")
    lines.append("# TYPE http_request_duration_seconds_avg gauge")
    lines.append(f"http_request_duration_seconds_avg {avg_latency:.4f}")

    # 3. Active scans
    lines.append("# HELP deepguard_active_scans Current number of concurrent scan tasks.")
    lines.append("# TYPE deepguard_active_scans gauge")
    lines.append(f"deepguard_active_scans {ACTIVE_SCANS}")

    return "\n".join(lines) + "\n"


# ─── OpenTelemetry Context Propagation ───────────────────────────────────────

class TracingContext:
    """Simulates OpenTelemetry distributed tracing context propagation."""

    @staticmethod
    def extract_trace_headers(request: Request) -> Dict[str, str]:
        """Extract W3C traceparent header or generate new transaction ID."""
        traceparent = request.headers.get("traceparent")
        if traceparent:
            # W3C Format: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
            parts = traceparent.split("-")
            if len(parts) >= 3:
                return {"trace_id": parts[1], "span_id": parts[2]}
        
        # Fallback
        return {"trace_id": uuid_trace_id(), "span_id": uuid_span_id()}


def uuid_trace_id() -> str:
    import uuid
    return uuid.uuid4().hex


def uuid_span_id() -> str:
    import secrets
    return secrets.token_hex(8)
