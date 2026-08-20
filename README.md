# Deepfake & Phishing Media Verification Gateway

A production-grade, multi-modal security gateway that detects AI-generated deepfakes (image, audio, video), identifies phishing links/documents, and logs audit operations.

---

## 🔑 Default Access Credentials

Use the following credentials to access the **Standard User Workspace** and **Admin Operations Center**:

| Role | Email Address | Password | Accessible Workspace |
| :--- | :--- | :--- | :--- |
| **Standard User** | `test@example.com` | `password` | User Verification Workspace (`/dashboard`) |
| **Admin Operator** | `admin@example.com` | `password` | Admin Operations Control Center (`/admin`) |

---

## 🏗️ Architecture & Workspace Layout

The project is structured as a monorepo containing a Vite-bundled React frontend at the root and an asynchronous FastAPI backend inside the `/backend` folder:

```
├── backend/                       # Python FastAPI Backend
│   ├── app/
│   │   ├── api/                   # REST Endpoints (scan.py, admin.py, auth.py)
│   │   ├── core/                  # Configuration, security, logging
│   │   ├── db/                    # Async SQLAlchemy session and SQLite schema mapping
│   │   ├── schemas/               # Pydantic data schemas
│   │   └── services/              # Modality forensic engines (FFT, Mel-Spectrogram, EXIF, etc.)
│   ├── tests/                     # Backend Pytest suite
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── main.py                    # Uvicorn server entrypoint
│   └── requirements.txt           # Backend python dependencies
├── src/                           # React Frontend Source
│   ├── api/                       # API client (scanApi.js)
│   ├── components/                # React Dashboard UI (Admin, Workspace, Common)
│   ├── context/                   # Global React State Context
│   └── pages/                     # Main Views (WorkspacePage, AdminPage)
├── tailwind.config.js             # Tailwind CSS Configuration
├── package.json                   # React package dependencies
└── README.md                      # Documentation
```

---

## 🛠️ Modality Verification Engines

### 1. Spatial Image Engine (`spatial_engine.py`)
- **FFT Spectral Analysis**: Extracts 2D Fast Fourier Transform magnitude spectra of images, calculating high-frequency anomalies typical in GAN-generated and Diffusion boundaries.
- **Face Detection**: Integrates a robust Haar-cascade face crop pipeline.
- **Neural Network Inference**: Employs a pre-configured **EfficientNet-B4** classification head.
- **Grad-CAM Overlay**: Backpropagates class gradients to compute spatial attention maps, returning a base64-encoded PNG overlay highlighting modified facial boxes.

### 2. Audio Voice Clone Engine (`audio_engine.py`)
- **2D Mel-Spectrograms**: Loads raw waveforms with Librosa and extracts Log-Mel features.
- **Vocal Tract Heuristics**: Analyzes Zero-Crossing Rates (ZCR), Spectral Flatness, Phase Discontinuity, and MFCC Deltas to detect vocoder artifacts (e.g. ElevenLabs, Tacotron, VITS).

### 3. Temporal Video Engine (`temporal_engine.py`)
- **Frame Sampler**: Extracts frame buffers using OpenCV.
- **Eye-Blink Tracker**: Computes eye metrics over temporal frame indices, flagging absent/aberrant blink frequencies.
- **Lip-Sync Alignment**: Tracks lip region motion variance compared to speech frequencies.

### 4. Phishing & Metadata Engine (`phishing_engine.py`)
- **EXIF Extraction**: Inspects date/time metadata fields, camera hardware signatures, and editing software software tags (Photoshop, Midjourney).
- **Typosquatting Scanner**: Measures Levenshtein distances against major brand names.
- **URL & PDF Scanner**: Inspects domain age, TLD risk, embedded JavaScript strings, and launch action commands.

---

## 🚀 Setup & Execution

### 1. Backend Server Setup
Requires Python 3.11+.

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
py -3 -m venv venv

# Activate virtual environment (Windows)
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env config
cp .env.example .env

# Run FastAPI server
uvicorn main:app --reload --port 8000
```
Swagger UI will be active at `http://localhost:8000/docs`.

### 2. Frontend Development Setup
Requires Node.js 18+.

```bash
# From workspace root
npm install

# Run Vite dev server
npm run dev
```
Open `http://localhost:5173/` in your browser.

### 3. Docker Launch (Alternative)
Launch the entire stack (database, redis, backend server, celery background worker) in one command:
```bash
cd backend
docker-compose up --build
```

---

## 🧪 Testing

We use Pytest to run async unit and integration tests.

```bash
cd backend
.\venv\Scripts\activate
pytest
```
Currently passes **38/38 tests** validating schema parsing, typosquatting logic, image FFTs, audio structures, and REST endpoints.
