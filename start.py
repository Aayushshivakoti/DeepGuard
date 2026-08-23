import os
import sys
import subprocess
import shutil
import time

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")

def log(msg, symbol="🚀"):
    print(f"\n{symbol} [DeepGuard Launcher] {msg}")

def check_and_setup_env():
    log("Step 1/4: Checking & Preparing Environment Files...", "⚙️")
    
    # 1. Backend .env check
    backend_env = os.path.join(BACKEND_DIR, ".env")
    backend_env_example = os.path.join(BACKEND_DIR, ".env.example")
    if not os.path.exists(backend_env) and os.path.exists(backend_env_example):
        shutil.copy(backend_env_example, backend_env)
        log("Created backend/.env from .env.example", "✅")

    # 2. Virtualenv check
    venv_dir = os.path.join(BACKEND_DIR, "venv")
    if not os.path.exists(venv_dir):
        log("Creating Python virtual environment...", "📦")
        subprocess.run([sys.executable, "-m", "venv", venv_dir], check=True)

    # Determine Python executable inside venv
    if sys.platform == "win32":
        python_bin = os.path.join(venv_dir, "Scripts", "python.exe")
        pip_bin = os.path.join(venv_dir, "Scripts", "pip.exe")
    else:
        python_bin = os.path.join(venv_dir, "bin", "python")
        pip_bin = os.path.join(venv_dir, "bin", "pip")

    # Install Backend Dependencies if needed
    log("Verifying backend Python dependencies...", "📦")
    subprocess.run([pip_bin, "install", "-q", "-r", os.path.join(BACKEND_DIR, "requirements.txt")], check=True)

    # Install Frontend Dependencies if needed
    node_modules = os.path.join(ROOT_DIR, "node_modules")
    if not os.path.exists(node_modules):
        log("Installing frontend NPM dependencies...", "📦")
        subprocess.run(["npm", "install"], cwd=ROOT_DIR, shell=(sys.platform == "win32"), check=True)

    return python_bin

def init_database(python_bin):
    log("Step 2/4: Initializing & Seeding Database Schemas...", "🗄️")
    try:
        subprocess.run([python_bin, "-m", "app.db.init_db"], cwd=BACKEND_DIR, check=True)
        log("Database schema initialized and seed users verified!", "✅")
    except Exception as e:
        log(f"Database initialization warning (proceeding): {e}", "⚠️")

def launch_services(python_bin):
    log("Step 3/4: Spawning Parallel Services (Celery Worker, FastAPI, Vite Frontend)...", "⚡")
    
    processes = []
    
    # Environment variables
    env = os.environ.copy()
    env["PYTHONPATH"] = BACKEND_DIR

    # Binaries for uvicorn & celery inside venv
    bin_dir = os.path.dirname(python_bin)
    if sys.platform == "win32":
        uvicorn_bin = os.path.join(bin_dir, "uvicorn.exe")
        celery_bin = os.path.join(bin_dir, "celery.exe")
    else:
        uvicorn_bin = os.path.join(bin_dir, "uvicorn")
        celery_bin = os.path.join(bin_dir, "celery")

    try:
        # 1. Start Celery Worker (Or fallback grace if Redis is not running)
        log("Starting Celery Background Worker...", "⚙️")
        celery_cmd = [celery_bin, "-A", "app.core.celery_app", "worker", "--loglevel=info", "--pool=solo"]
        p_celery = subprocess.Popen(celery_cmd, cwd=BACKEND_DIR, env=env, shell=(sys.platform == "win32"))
        processes.append(p_celery)

        # 2. Start FastAPI Uvicorn Server
        log("Starting FastAPI Backend (Port 8000)...", "🔥")
        uvicorn_cmd = [uvicorn_bin, "main:app", "--reload", "--port", "8000"]
        p_backend = subprocess.Popen(uvicorn_cmd, cwd=BACKEND_DIR, env=env, shell=(sys.platform == "win32"))
        processes.append(p_backend)

        # 3. Start Vite React Frontend Server
        log("Starting React Frontend Dashboard (Port 5173)...", "💻")
        p_frontend = subprocess.Popen(["npm", "run", "dev"], cwd=ROOT_DIR, shell=(sys.platform == "win32"))
        processes.append(p_frontend)

        time.sleep(3)
        log("Step 4/4: DeepGuard Stack Successfully Running!", "🎉")
        print("\n" + "="*70)
        print("  🌐 FRONTEND DASHBOARD:  http://localhost:5173")
        print("  📚 API SWAGGER DOCS:   http://localhost:8000/docs")
        print("  🔑 ADMIN ACCOUNT:      admin@example.com / AdminPass123!")
        print("  👤 USER ACCOUNT:       user@example.com / UserPass123!")
        print("="*70 + "\n")
        print("Press Ctrl+C to stop all services cleanly.\n")

        # Keep alive and watch for Ctrl+C
        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        log("Shutting down all DeepGuard processes...", "🛑")
        for p in processes:
            try:
                p.terminate()
            except Exception:
                pass
        for p in processes:
            try:
                p.wait()
            except Exception:
                pass
        log("All services stopped cleanly. Goodbye!", "👋")

if __name__ == "__main__":
    py_executable = check_and_setup_env()
    init_database(py_executable)
    launch_services(py_executable)
