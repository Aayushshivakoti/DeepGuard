# DeepGuard — Multi-Modal Deepfake & Phishing Media Verification Platform

## 1. Project Overview
DeepGuard delivers high-accuracy AI verification for images, audio, video, PDFs, and URLs. Its core mission is to eliminate false-positives on authentic smartphone photos by fusing spatial-RGB and frequency-spectral analyses.

## 2. Detailed Algorithm Architecture
### The False-Positive Challenge
Standard RGB-only CNNs misinterpret sensor noise and compression artifacts as generative cues, especially on uncompressed or phone-taken images, causing systematic misclassifications.

### Spatial Feature Stream
- **Model**: EfficientNet-B4 (or ConvNeXt) backbone.
- **Function**: Extracts semantic patterns, detects lighting inconsistencies, edge-blending anomalies, and anatomical defects.

### Frequency Feature Stream
- **Algorithms**: 2-D Fast Fourier Transform (FFT) and Error Level Analysis (ELA).
- **Function**: Generates high-frequency magnitude maps and compression-variance visualisations to expose periodic up-sampling grids left by GANs, diffusion models, Flux, and Midjourney that are invisible in RGB space.

### Fusion & Calibration Head
- **Fusion**: Concatenates spatial and frequency embeddings.
- **Calibration**: Applies temperature scaling (Platt) and trains with focal loss plus label smoothing, producing statistically reliable probabilities.

### Dynamic Decision Boundaries
- **Real**: probability < 40%.
- **Uncertain**: 40% - 85% (recommend manual review).
- **AI-Generated**: > 85%.
These thresholds replace a rigid 0.5 cutoff.

## 3. Model Training & Dataset Pipeline
### Multi-Domain Dataset Blending
- **Real Images**: Flickr, COCO, and raw smartphone collections covering varied lighting, ISO levels, and social-media re-uploads.
- **Synthetic Images**: Midjourney (v4-v6), Stable Diffusion (1.5, XL, 3), DALL-E 3, Flux 1, StyleGAN variants.

### On-The-Fly Noise Augmentation (Albumentations)
```python
import albumentations as A
transform = A.Compose([
    A.Resize(380, 380),
    A.RandomCrop(350, 350),
    A.Resize(380, 380),
    A.JpegCompression(30, 95),
    A.GaussNoise(10, 50),
    A.MotionBlur(0.2),
    A.ColorJitter(0.2, 0.2, 0.2, 0.1),
    A.Normalize(mean=(0.485,0.456,0.406), std=(0.229,0.224,0.225)),
    A.pytorch.transforms.ToTensorV2(),
])
```
These augmentations force the model to focus on genuine generative artifacts rather than ordinary camera noise.

## 4. High-Level System Architecture
```mermaid
graph TD
    UI[User Client<br/>Vite React Dashboard] -->|REST API & WebSockets| API[API Gateway / Router<br/>FastAPI Backend]
    API -->|Enqueues Job| Broker[Message Broker<br/>Redis]
    Broker -->|Dispatches Task| Worker[Async Task Queue<br/>Celery Worker Node]
    
    subgraph ML_Pipeline [ML Pipeline Engine]
        Worker -->|Image Tensor| Spatial[Stream A:<br/>Spatial RGB Backbone<br/>EfficientNet / ConvNeXt]
        Worker -->|Image Tensor| Freq[Stream B:<br/>Frequency Spectrum Analyzer<br/>2D FFT + ELA]
        Spatial --> Fusion[Decision Fusion Head]
        Freq --> Fusion
    end
    
    Fusion -->|Saves Results| DB[(Primary Database<br/>PostgreSQL / SQLite via SQLAlchemy)]
    API <-->|Reads/Writes| DB
```

## 5. End-to-End Media Scan Workflow
```mermaid
sequenceDiagram
    participant Client as React Dashboard
    participant API as FastAPI Backend
    participant Redis as Redis Queue
    participant Worker as Celery Worker
    participant ML as Dual-Stream ML Engine
    participant DB as Database

    Client->>API: POST /api/v1/scan/upload (Raw Media Payload)
    API->>API: Validate file headers & compute SHA-256 hash
    API->>API: Save raw payload
    API->>Redis: Dispatch async job to Redis queue
    API-->>Client: Return Job ID immediately
    Client->>API: Open WebSocket (ws://localhost:8000/ws/scans/{job_id})
    Redis->>Worker: Worker picks up job
    Worker->>ML: Pass image tensor through ML Engine
    par Dual-Stream Analysis
        ML->>ML: Stream A: Spatial RGB Backbone
        ML->>ML: Stream B: Frequency Spectrum Analyzer
    end
    ML->>ML: Decision Fusion Head (Calibrate metrics)
    ML-->>Worker: spatial_confidence, frequency_artifact_score, overall_verdict
    Worker->>DB: Save Results to Database
    Worker->>API: Push completion payload via WebSocket
    API-->>Client: Real-time UI update with forensic visual breakdown
```

## 6. Data Flow & Transformation Map
- **Raw File Upload** → **Preprocessed RGB Tensor** (Normalized ImageNet range `[0.0, 1.0]`).
- **Spatial Extraction** → **High-level feature vectors** mapping semantic and anatomical structures.
- **Frequency Extraction** → **2D FFT Magnitude Spectra** & **ELA variance maps** to expose periodic anomalies.
- **Logits Calibration** → **Platt Scaling & Dynamic Decision Boundaries** (`<40%` Real, `40-85%` Uncertain, `>85%` AI).

## 16. Security & Authentication (New)

### WebSocket JWT Protection
- All real‑time channels (`/ws/scans/{job_id}` and `/ws/admin/alerts`) now require a **signed JWT** in the `Authorization: Bearer <token>` header.
- The token is verified by `backend/app/core/security.py` using the `JWT_SECRET` environment variable.
- Invalid or missing tokens cause the server to close the socket with WebSocket code **1008** (policy violation).

### Environment Variables
| Variable | Description | Default / Example |
|----------|-------------|-------------------|
| `JWT_SECRET` | Secret key used to sign/verify JWTs (must be a strong 256‑bit string). | `super-secret-256bit-key` |
| `REDIS_URL` | Redis connection string (includes password). | `redis://redis:6379/0` |
| `REDIS_PASSWORD` | Password used by the Redis container (`docker‑compose.yml`). | `defaultpass` |
| `RATE_LIMIT_REDIS_URL` | Optional separate Redis instance for rate‑limit data. | `redis://redis:6379/1` |

> **Note:** The `RateLimitMiddleware` now falls back to an in‑memory store if the Redis connection fails, guaranteeing uninterrupted operation.

## 7. System State Transition Diagram
```mermaid
stateDiagram-v2
    [*] --> IDLE
    IDLE --> UPLOADING : Client initiates upload
    UPLOADING --> QUEUED : File validated & dispatched to Redis
    QUEUED --> PROCESSING_SPATIAL : Celery worker begins Stream A
    PROCESSING_SPATIAL --> PROCESSING_FREQUENCY : Stream A completed
    PROCESSING_FREQUENCY --> CALIBRATING : Stream B completed
    CALIBRATING --> COMPLETED : Fusion & DB save successful
    CALIBRATING --> FAILED : Error during ML/DB operation
    COMPLETED --> [*]
    FAILED --> [*]
```

## 17. Explainable AI – Grad‑CAM Heat‑maps (New)

The dual‑stream vision model now outputs a **Grad‑CAM heat‑map** (`heatmap_b64`) that visualises the regions most responsible for the AI‑generated verdict.

### Backend
- `backend/app/services/spatial_engine.py` computes the Grad‑CAM tensor after the spatial backbone and encodes it as a base‑64 PNG string.
- The field is added to `ImageAnalysisResult` schema under `heatmap_b64`.

### Frontend
- **Component:** `frontend/src/components/HeatmapOverlay.jsx`  
  Renders the base‑64 heat‑map on top of the original media using a CSS glass‑morphism overlay.
- **Export:** `frontend/src/components/ExportReportButton.jsx` bundles the current UI (including the overlay) into a PDF using **`jspdf`** + **`html2canvas`**.

> Users can now download a certified forensic report that contains both the numerical verdict and the visual explanation.

## 8. Prerequisites & Environment Requirements
| Component | Minimum Version |
|-----------|-----------------|
| OS        | Windows 10+, macOS 12+, Linux |
| Python    | 3.10 - 3.12 (strict) |
| Node.js   | ≥ 18 |
| Docker & Docker-Compose | latest (optional) |
| Git       | any recent release |

## 18. PDF Report Export (New)

A new UI button **“Export Report”** appears on the scan results page.

- Implemented in `ExportReportButton.jsx`.
- Uses `jspdf` to create a PDF document and `html2canvas` to rasterise the DOM (including the Grad‑CAM overlay) into an image.
- The generated PDF is automatically downloaded with the filename `DeepGuard_Report_<job_id>.pdf`.

> The PDF is cryptographically hash‑signed on the backend (see `backend/app/services/report_service.py`) to guarantee integrity.

## 9. Quick-Start Guide (Local Setup)

### One-Command Launch
```cmd
start.bat
```
or
```bash
python start.py
```
The launcher automatically detects a compatible Python interpreter, sets up the virtual environment under `backend/venv`, installs backend/frontend dependencies, runs DB migrations, and starts the FastAPI server, Celery worker, and Vite client in parallel.

### Manual Setup (Step-by-Step)

#### 1. Backend Setup
Navigate to the `backend/` directory and configure the environment:
```bash
cd backend
python -m venv venv

# Activate virtual environment:
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install required dependencies (FastAPI, PyTorch, OpenCV, etc.):
pip install -r requirements.txt

# Run migrations and seed database credentials:
python -m app.db.init_db

# Start the development server:
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

#### 2. Frontend Setup
From the repository root (where the main `package.json` is located), configure and launch the Vite development server:
```bash
# Install NPM packages:
npm install

# Run the dev server:
npm run dev
```

## 19. Async Non‑Blocking Uploads (New)

The previous `scan.py` endpoint synchronously read the whole multipart payload into memory.  
It now streams the upload directly to Redis using **async generators**:

```python
async for chunk in request.stream():
    await redis.publish("uploads", chunk)
```
- Reduces memory footprint for large video/audio files.
- Enables immediate job‑ID response while the upload continues in the background.

### How to Use
```bash
curl -X POST http://localhost:8000/api/v1/scan/upload \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/video.mp4"
```
The client receives a `job_id` instantly and can open the WebSocket for real‑time progress.

## 10. Docker Deployment
```bash
docker-compose up --build
```
**Active services**: API, Celery worker, Redis broker, PostgreSQL database, and Nginx-served frontend (port 80).

## 20. Celery Worker Tuning (New)

Key performance knobs added to `backend/app/core/celery_app.py`:

| Setting | Value | Reason |
|---------|-------|--------|
| `worker_prefetch_multiplier` | `1` | Guarantees one‑task‑at‑a‑time per worker, avoiding task pile‑up and memory spikes. |
| `worker_concurrency` | `2` (default) – can be overridden via `CELERY_WORKER_CONCURRENCY` env var | Balances CPU usage with GPU inference latency. |
| `task_acks_late = True` | – | Ensures tasks are re‑queued on worker crash. |
| `worker_max_memory_per_child` | `500M` | Auto‑restarts a worker process once it exceeds 500 MiB, preventing OOM crashes. |

These settings are now reflected in `docker-compose.yml` under the `celery_worker` service (`command: celery -A app.core.celery_app worker -l info -c 2`).

## 11. 🔑 Demo Access & Credentials

| Role | Username / Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@example.com` | `AdminPass123!` | Operations Control Center, Analytics, Manual Review, Logs & SIEM |
| **Standard User** | `user@example.com` | `UserPass123!` | Verification Workspace, Scan History, Educational Hub |

- **Dashboard Interface**: `http://localhost:5173`
- **API Documentation**: `http://localhost:8000/docs`

## 21. Backend Dependencies (Updated)

The `requirements.txt` now includes:

```
fastapi
uvicorn
pydantic
redis
celery
pyjwt          # JWT creation / verification
python-magic    # MIME type detection for uploads
albumentations # Data‑augmentation pipeline used during training
timm           # Access to pretrained vision models (e.g., EfficientNet‑B4)
# … existing deps …
```
> Run `pip install -r requirements.txt` after pulling the latest changes.

## 12. Environment Configuration
Create a `.env` file at the repository root for the backend and a `.env.development` (or `.env.production`) inside `frontend/`.
### Backend (`.env`)
```dotenv
HOST=0.0.0.0
PORT=8000
DATABASE_URL=postgresql+asyncpg://deepguard:deepguard@postgres:5432/deepguard
REDIS_URL=redis://redis:6379/0
SPATIAL_MODEL_PATH=backend/weights/dual_stream_effb4.pt
USE_MOCK_MODELS=False
DEEPFAKE_CLASS_INDEX=1
SECRET_KEY=change-me-securely
```
### Frontend (`frontend/.env.development`)
```dotenv
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
```
Adjust values for production as needed.

## 22. Frontend Dependencies (Updated)

Add the following libraries to `frontend/package.json`:

```json
{
  "dependencies": {
    "jspdf": "^2.5.1",
    "html2canvas": "^1.4.1",
    // … other existing deps …
  }
}
```
Run `npm install` (or `yarn`) to make the **Export Report** button functional.

## 13. Project Directory Structure
```
DeepGuard/
├─ backend/
│  ├─ app/
│  │  ├─ api/          # FastAPI routers
│  │  ├─ core/         # Config, security utilities
│  │  ├─ db/           # SQLAlchemy models & session
│  │  ├─ ml_models/    # Vision, audio, text wrappers
│  │  ├─ services/     # Orchestrator, engines, Celery tasks
│  │  └─ schemas/      # Pydantic request/response models
│  ├─ requirements.txt
│  ├─ start.py
│  └─ start.bat
├─ frontend/
│  ├─ src/
│  ├─ public/
│  ├─ vite.config.ts
│  └─ package.json
├─ docker/
│  ├─ Dockerfile.api
│  ├─ Dockerfile.worker
│  └─ docker-compose.yml
├─ data/                # Optional local datasets
├─ weights/             # Model checkpoints
├─ scripts/             # Training utilities
├─ .gitignore
├─ README.md           # ← This file
└─ pyproject.toml / setup.cfg (if any)
```

## 23. Updated Architecture Flow (New Diagram)

```mermaid
graph TD
    UI[User Dashboard Client<br/>Vite React] -->|REST API / WebSocket (JWT)| API[API Gateway / FastAPI Backend]
    API -->|1. pHash Cache Check| Cache{pHash Deduplication<br/>Hamming Distance <= 2}
    Cache -->|Match| InstantReturn[Instant Response / Cache Hit]
    Cache -->|Miss| Preprocessing[2. Adversarial Preprocessor<br/>Blur + JPEG re-compression]
    Preprocessing -->|3. Dual-Stream ML| ML[Dual-Stream ML Engine<br/>4-Channel PyTorch / FFT]
    ML -->|4. AV Alignment| AV{Cross-Modal Alignment<br/>Consistency Checker}
    AV -->|5. Phishing Scanner| Phish[URL Sandbox Check<br/>Payload Binary Detector]
    Phish -->|Save Result| DB[(Primary Database<br/>SQLite / PostgreSQL)]
    DB -->|Read / Display| UI
```

### Docker‑Compose (Updated)

```yaml
services:
  redis:
    image: redis:7
    command: redis-server --requirepass ${REDIS_PASSWORD:-defaultpass}
    environment:
      - REDIS_PASSWORD=${REDIS_PASSWORD}
  celery_worker:
    command: celery -A app.core.celery_app worker -l info -c ${CELERY_WORKER_CONCURRENCY:-2}
```
Run the stack with:

```bash
docker-compose up --build
```
The container now starts Redis with password authentication and the Celery worker with the tuned concurrency settings.

## 24. Enterprise Security & Infrastructure Additions

DeepGuard has been upgraded with four critical enterprise-grade security and detection layers:

### 1. Adversarial Defense Layer
- **Implementation**: Preprocesses all incoming image buffers prior to neural network analysis.
- **Technique**: Applies mild Gaussian blurring (radius=0.5) and JPEG re-compression (quality=85).
- **Benefit**: Destroys high-frequency adversarial noise perturbations engineered to trick model classification parameters.

### 2. Perceptual Hash (pHash) Cache Lookup
- **Implementation**: Computes image pHash via DCT AC-coefficient thresholding.
- **Technique**: Matches incoming image hashes against historical records using Hamming distance thresholding (≤ 2).
- **Benefit**: Achieves instant response times for duplicate files and prevents redundant GPU usage.

### 3. Cross-Modal Identity Alignment
- **Implementation**: Computes facial and vocal characteristics dynamically.
- **Technique**: Compares lip-sync features and consistency metrics, returning nested `multimodal_analysis` structures.
- **Benefit**: Exposes identity mismatch anomalies in synthesized video and audio clips.

### 4. Phishing Payload Download Sandbox Check
- **Implementation**: Inspects HTTP download headers for malicious binary payload links.
- **Technique**: Identifies file download extensions (`.exe`, `.apk`, `.msi`) and appends a `+30.0` risk penalty.
- **Benefit**: Instantly flags high-risk phishing links deploying drive-by payloads.

---

## 25. Verification & Testing

DeepGuard maintains a strict verification process. All newly added features and core modules are fully tested and validated.

### Test Suites Execution
Run all verification suites via the following commands:
```powershell
# Run backend engine tests
pytest backend/tests/test_engines.py

# Run enterprise security layer tests
pytest backend/tests/test_enterprise_features.py
```

### Validation Results
All **42 unit and integration tests** pass cleanly with zero failures:
```text
================= 42 passed, 15 warnings in 81.88s (0:01:21) ==================
```

## 14. Contributing
1. Fork the repository and create a feature branch.
2. Follow the coding style enforced by `ruff` and `black` (`pre-commit install`).
3. Add unit and integration tests for new functionality.
4. Open a Pull Request targeting `main`. CI will run linting, tests, and a Docker build verification.

## 15. License
This project is licensed under the **MIT License**. See the `LICENSE` file for full terms.