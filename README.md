# DeepGuard — Multi-Modal Deepfake & Phishing Media Verification Platform

## 1. Project Overview & Highlights

**DeepGuard** is a high‑accuracy AI‑driven platform that verifies images, audio, video, PDFs and URLs for deepfakes and phishing content.  The system is engineered to **eliminate false‑positives on real photographs** by leveraging a novel **dual‑stream spatial‑frequency architecture** that fuses semantic RGB cues with spectral fingerprint analysis.

---

## 2. Detailed Algorithms & Technical Design (Why & How)

### Dual‑Stream Fusion Architecture
Real‑world smartphone photos differ dramatically from the clean, often down‑sampled images used to train naïve RGB‑only classifiers.  Camera‑sensor noise, compression artifacts, and lighting variations cause a classic single‑stream CNN to mis‑classify authentic images as AI‑generated (domain‑shift).  By **combining a spatial stream with a frequency stream**, DeepGuard learns both high‑level semantic features *and* the subtle high‑frequency patterns that generative models imprint on their outputs.

### Spatial Stream (Backbone)
- **Algorithm**: EfficientNet‑B4 (or ConvNeXt) fine‑tuned for a 2‑class problem (Authentic vs Deepfake).
- **Mechanics**: Extracts semantic representations, detects lighting inconsistencies, facial boundary blending artefacts, and structural anatomical flaws.  The backbone is frozen on ImageNet weights and then trained on the fused dataset.

### Frequency Stream (Spectral Fingerprinting)
- **Algorithms**: 2‑D Fast Fourier Transform (FFT) and Error Level Analysis (ELA).
- **Mechanics**: Computes the magnitude spectrum of the RGB image, producing a high‑frequency map that reveals periodic grid‑like artefacts left by GAN up‑samplers and diffusion pipelines.  ELA highlights compression‑level differences that are invisible in the RGB domain.

### Feature Fusion & Calibration Head
- **Fusion**: Concatenates the spatial feature vector (≈1280 dims) with the frequency feature vector (matched dimension via a lightweight CNN).
- **Calibration**: Applies temperature scaling (Platt scaling) and trains with **Focal Loss** + **Label Smoothing** to avoid over‑confidence on noisy real photos.
- **Decision Logic**:
  - **Real**: probability < **40 %**
  - **Uncertain**: **40 % – 85 %** (suggest manual review)
  - **AI‑Generated**: > **85 %**

---

## 3. Model Training & Pipeline Datasets

### Multi‑Domain Dataset Integration
- **Real Images**: Flickr, COCO, and a curated collection of raw smartphone photos (varied lighting, ISO, motion blur).
- **AI‑Generated Images**: Midjourney (v4‑v6), Stable Diffusion (1.5, XL, 3), DALL‑E 3, Flux.1, StyleGAN, and other public diffusion/GAN repos.

### Noise Augmentation Pipeline (Albumentations)
```python
import albumentations as A

transform = A.Compose([
    A.Resize(380, 380),
    A.RandomCrop(350, 350),
    A.Resize(380, 380),
    A.JpegCompression(quality_lower=30, quality_upper=95),
    A.GaussNoise(var_limit=(10.0, 50.0)),
    A.MotionBlur(p=0.2),
    A.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1),
    A.Normalize(mean=(0.485,0.456,0.406), std=(0.229,0.224,0.225)),
    A.pytorch.transforms.ToTensorV2(),
])
```
The augmentation forces the model to learn **invariant forgery fingerprints** rather than mistaking ordinary camera noise for AI artefacts.

---

## 4. Architecture & Multi‑Process Stack

- **FastAPI (Async)** – Primary HTTP API, authentication, and Swagger UI.
- **Celery + Redis** – Background processing for large files, video/audio jobs, and batch ZIP scans.
- **PostgreSQL** – Persistent storage of scan results, user accounts, and audit logs.
- **Vite + React** – Modern, highly‑responsive dashboard for uploads, visual heatmaps (Grad‑CAM), and detailed forensic reports.
- **Nginx (optional)** – Serves the compiled frontend in production and proxies to the FastAPI backend.

---

## 5. Prerequisites

| Component | Minimum Version |
|-----------|-----------------|
| **OS** | Windows 10+, macOS 12+, Linux (any distro) |
| **Python** | 3.10 – 3.12 (strictly, to avoid Rust/C‑wheel compilation issues) |
| **Node.js** | v18+ |
| **Docker & Docker‑Compose** | Latest stable (optional, for containerised deployment) |
| **Git** | Any recent version |

---

## 6. Quick‑Start Guide (Local Development)

### Single‑Command Launch
```cmd
# Windows (double‑click or from PowerShell)
start.bat
```
or
```bash
# Cross‑platform
python start.py
```
The smart launcher performs the following automatically:
1. Detects a compatible Python interpreter (bypasses the Windows Store alias).
2. Creates / updates the backend virtual environment (`backend/venv`).
3. Installs backend dependencies (`pip install -r requirements.txt`).
4. Installs frontend dependencies (`npm ci`).
5. Runs any pending Alembic migrations and seeds the default admin/user accounts.
6. Starts **FastAPI** on **port 8000**, a **Celery worker**, and the **Vite** dev server on **port 5173** concurrently.

---

## 7. Containerised Deployment (Docker)

```bash
docker-compose up --build
```
### Services Overview
| Service | Port | Role |
|---------|------|------|
| **api** | 8000 | FastAPI backend (Uvicorn) |
| **worker** | – | Celery worker processing async jobs |
| **redis** | 6379 | Message broker for Celery |
| **postgres** | 5432 | Persistent relational store |
| **frontend** | 80 | Nginx serving the compiled React app |

The `docker/` directory contains production‑ready `Dockerfile`s and a `docker-compose.yml` that wires the services together.

---

## 8. Default Credentials & Access URLs
- **Web Dashboard**: `http://localhost:5173`
- **API Swagger Docs**: `http://localhost:8000/docs`

### Pre‑seeded Test Accounts
| Role | Email | Password |
|------|-------|----------|
| **System Admin** | `admin@example.com` | `AdminPass123!` |
| **Standard User** | `user@example.com` | `UserPass123!` |

---

## 9. Environment Variables & Configuration
Create a `.env` file in the project root (backend) and a `.env.development` / `.env.production` in the `frontend/` folder.

### Backend (`.env`)
```dotenv
# FastAPI
HOST=0.0.0.0
PORT=8000
# Database (Postgres)
DATABASE_URL=postgresql+asyncpg://deepguard:deepguard@postgres:5432/deepguard
# Redis broker for Celery
REDIS_URL=redis://redis:6379/0
# Model paths
SPATIAL_MODEL_PATH=backend/weights/dual_stream_effb4.pt
# Feature flags
USE_MOCK_MODELS=False
DEEPFAKE_CLASS_INDEX=1
# Security
SECRET_KEY=super‑secret‑key‑change‑me
```

### Frontend (`frontend/.env.development`)
```dotenv
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
```
Adjust the values for production as needed.

---

## 10. Project Structure
```
DeepfakeandPhishingMediaVerificationsystem/
├─ backend/                         # FastAPI backend
│  ├─ app/
│  │  ├─ api/                      # Route definitions (v1/scan.py, …)
│  │  ├─ core/                     # Config, security, utilities
│  │  ├─ db/                       # SQLAlchemy models & session
│  │  ├─ ml_models/                # Vision, audio, text model wrappers
│  │  ├─ services/                 # Orchestrator, engines, Celery tasks
│  │  └─ schemas/                  # Pydantic request/response models
│  ├─ requirements.txt
│  ├─ start.py                     # Python launcher (env‑aware)
│  └─ start.bat                    # Windows batch launcher
├─ frontend/                        # Vite React workspace
│  ├─ src/
│  ├─ public/
│  ├─ vite.config.ts
│  └─ package.json
├─ docker/                          # Production Dockerfiles & compose
│  ├─ Dockerfile.api
│  ├─ Dockerfile.worker
│  └─ docker-compose.yml
├─ data/                            # Optional local dataset folder
├─ weights/                         # Trained model checkpoints
├─ scripts/                         # Helper utilities, training scripts
├─ .gitignore
├─ README.md                       # ← **This file**
└─ pyproject.toml / setup.cfg (if any)
```

---

## 11. Contributing
1. Fork the repository and create a feature branch.
2. Follow the coding style enforced by `ruff` and `black` (run `pre‑commit install`).
3. Add unit & integration tests for new functionality.
4. Open a Pull Request targeting `main`.  CI will run linting, test suites, and a Docker build verification.

---

## 12. License
This project is licensed under the **MIT License**. See the `LICENSE` file for full terms.

---

*Documentation generated by Antigravity AI – your partner for modern, production‑grade codebases.*