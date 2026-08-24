import os
import sys
import subprocess
import shutil
import time

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")

def resolve_python():
    """Finds a safe, stable Python interpreter (3.10 - 3.12)."""
    venv_py = os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe") if sys.platform == "win32" else os.path.join(BACKEND_DIR, "venv", "bin", "python")
    if os.path.exists(venv_py):
        return venv_py
    
    # Try Windows Python Launcher for stable Python versions
    for ver in ["-3.12", "-3.11", "-3.10"]:
        try:
            res = subprocess.run(["py", ver, "-c", "import sys; print(sys.version_info.major)"], capture_output=True, text=True)
            if res.returncode == 0:
                return f"py {ver}"
        except Exception:
            continue
            
    return sys.executable

def check_and_setup_env(base_python):
    print("\n📦 [1/3] Checking Environment & Dependencies Safely...")
    
    # Copy .env
    backend_env = os.path.join(BACKEND_DIR, ".env")
    if not os.path.exists(backend_env) and os.path.exists(os.path.join(BACKEND_DIR, ".env.example")):
        shutil.copy(os.path.join(BACKEND_DIR, ".env.example"), backend_env)

    # Recreate venv safely
    venv_dir = os.path.join(BACKEND_DIR, "venv")
    if not os.path.exists(venv_dir):
        print("Creating lightweight virtual environment...")
        if "py " in base_python:
            subprocess.run(f"{base_python} -m venv \"{venv_dir}\"", shell=True, check=True)
        else:
            subprocess.run([base_python, "-m", "venv", venv_dir], check=True)

    venv_py = os.path.join(venv_dir, "Scripts", "python.exe") if sys.platform == "win32" else os.path.join(venv_dir, "bin", "python")
    venv_pip = os.path.join(venv_dir, "Scripts", "pip.exe") if sys.platform == "win32" else os.path.join(venv_dir, "bin", "pip")

    # Install Wheel & Upgraded Pip first
    subprocess.run([venv_pip, "install", "--quiet", "pip", "wheel", "setuptools"], check=False)

    # Safe Pip Install
    requirements_file = os.path.join(BACKEND_DIR, "requirements.txt")
    if os.path.exists(requirements_file):
        print("Syncing backend requirements (using binary wheels where available)...")
        subprocess.run([venv_pip, "install", "--quiet", "-r", requirements_file], check=False)

    # Frontend install
    if not os.path.exists(os.path.join(ROOT_DIR, "node_modules")):
        print("Installing frontend Node packages...")
        subprocess.run(["npm", "install", "--quiet"], cwd=ROOT_DIR, shell=(sys.platform == "win32"), check=True)

    return venv_py

def init_database(venv_py):
    print("\n🗄️ [2/3] Initializing Database...")
    try:
        env = os.environ.copy()
        env["PYTHONPATH"] = BACKEND_DIR
        subprocess.run([venv_py, "-m", "app.db.init_db"], cwd=BACKEND_DIR, env=env, check=False)
        print("✅ Database ready.")
    except Exception as e:
        print(f"⚠️ Notice: {e}")

def launch_services(venv_py):
    print("\n⚡ [3/3] Spawning Lightweight Stack Services...")
    
    processes = []
    env = os.environ.copy()
    env["PYTHONPATH"] = BACKEND_DIR
    bin_dir = os.path.dirname(venv_py)
    uvicorn_bin = os.path.join(bin_dir, "uvicorn")

    try:
        # 1. Backend API (FastAPI)
        print("Starting FastAPI Backend (Port 8000)...")
        p_backend = subprocess.Popen(
            [uvicorn_bin, "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"],
            cwd=BACKEND_DIR, env=env, shell=(sys.platform == "win32")
        )
        processes.append(p_backend)

        # 1.5 Celery Worker (Optional)
        print("Starting Celery Worker (Solo Pool)...")
        celery_bin = os.path.join(bin_dir, "celery")
        if os.path.exists(celery_bin) or os.path.exists(celery_bin + ".exe"):
            try:
                p_celery = subprocess.Popen(
                    [celery_bin, "-A", "app.core.celery_app", "worker", "--loglevel=info", "-c", "1", "--pool=solo"],
                    cwd=BACKEND_DIR, env=env, shell=(sys.platform == "win32")
                )
                processes.append(p_celery)
            except Exception as e:
                print(f"⚠️ Notice: Could not start Celery ({e})")

        # 2. Frontend React Client
        print("Starting Vite Frontend (Port 5173)...")
        p_frontend = subprocess.Popen(
            ["npm", "run", "dev"], cwd=ROOT_DIR, shell=(sys.platform == "win32")
        )
        processes.append(p_frontend)

        time.sleep(2)
        print("\n" + "="*60)
        print("  🎉 DEEPGUARD STACK OPERATIONAL (SAFE DEV MODE)")
        print("="*60)
        print("  💻 REACT DASHBOARD:    http://localhost:5173")
        print("  📚 API SWAGGER DOCS:   http://localhost:8000/docs")
        print("  🔑 ADMIN ACCOUNT:      admin@example.com / AdminPass123!")
        print("="*60 + "\n")

        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n🛑 Stopping all services...")
        for p in processes:
            p.terminate()
        for p in processes:
            p.wait()
        print("👋 Services stopped safely.")

if __name__ == "__main__":
    py_cmd = resolve_python()
    active_py = check_and_setup_env(py_cmd)
    init_database(active_py)
    launch_services(active_py)
