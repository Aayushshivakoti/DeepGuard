# Architectural Decision Record (ADR)

## ADR 1: Unified Neural/Heuristic Ensemble Gating Network

### Status
Accepted

### Context
Deepfake and phishing verification requires processing diverse media channels (image spatial anomalies, audio cloned voiceprints, HTML/email text, URL redirect hierarchies). Combining these into a single authentic/suspicious/manipulated verdict can cause false positives if heuristics are weighted naively.

### Decision
We implement a unified gate network ensemble (`ensemble_engine.py`) that uses a weighted matrix combining neural probability logs (ONNX classifiers) with structural heuristic violation scores. If the overall gated score crosses the activation threshold (>65% for audio/PDF, >70% for vision), the verdict evaluates to suspicious/deepfake.

## ADR 2: Double-Submit CSRF & Sandbox SSRF Filtering

### Status
Accepted

### Context
Gateway REST APIs are vulnerable to cross-site scripting/request-forgeries if cookies are stored. Furthermore, URL scanning tools can be abused for Server-Side Request Forgery (SSRF) targeting internal private services (e.g. AWS Instance Metadata Service).

### Decision
We hardcoded Double-Submit cookie validation for all cookies/headers mutations and forced resolved URL DNS validation against private RFC 1918 networks inside standard FastAPI routing.
