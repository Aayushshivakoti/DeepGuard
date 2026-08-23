import os
import sys
import subprocess
import shutil
import time

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")

def log(msg, symbol="[INFO]"):
    print(f"\n{symbol} [DeepGuard Launcher] {msg}")

def check_and_setup_env():
    log("Step 1/3: Verifying Virtual Environments & Dependencies...", "[CHECK]")
    
    # 1. Backend .env check
    backend_env = os.path.join(BACKEND_DIR, ".env")
    backend_env_example = os.path.join(BACKEND_DIR, ".env.example")
    if not os.path.exists(backend_env) and os.path.exists(backend_env_example):
        shutil.copy(backend_env_example, backend_env)
        log("Created backend/.env from .env.example", "[OK]")

    # 2. Virtualenv check
    venv_dir = os.path.join(BACKEND_DIR, "venv")
    if not os.path.exists(venv_dir):
        log("Creating Python virtual environment...", "[CREATE]")
        subprocess.run([sys.executable, "-m", "venv", venv_dir], check=True)

    # Determine Python & Pip paths
    if sys.platform == "win32":
        python_bin = os.path.join(venv_dir, "Scripts", "python.exe")
        pip_bin = os.path.join(venv_dir, "Scripts", "pip.exe")
    else:
        python_bin = os.path.join(venv_dir, "bin", "python")
        pip_bin = os.path.join(venv_dir, "bin", "pip")

    # Verify/Install Backend Dependencies
    requirements_file = os.path.join(BACKEND_DIR, "requirements.txt")
    if os.path.exists(requirements_file):
        log("Syncing backend Python packages...", "[SYNC]")
        try:
            subprocess.run([pip_bin, "install", "-q", "-r", requirements_file], check=True)
        except Exception as e:
            log(f"Standard package sync failed ({e}). Retrying with filtered requirements (omitting psycopg2-binary if building from source fails)...", "[WARN]")
            try:
                with open(requirements_file, "r", encoding="utf-8") as f:
                    lines = f.readlines()
                filtered_reqs = []
                for line in lines:
                    if "psycopg2-binary" not in line:
                        filtered_reqs.append(line.strip())
                temp_reqs_path = os.path.join(venv_dir, "temp_reqs.txt")
                with open(temp_reqs_path, "w", encoding="utf-8") as f:
                    f.write("\n".join(filtered_reqs))
                subprocess.run([pip_bin, "install", "-q", "-r", temp_reqs_path], check=True)
                log("Successfully installed filtered dependencies.", "[OK]")
            except Exception as e2:
                log(f"Fallback dependency sync failed: {e2}", "[ERROR]")
                raise e2

    # Verify/Install Frontend Dependencies
    node_modules = os.path.join(ROOT_DIR, "node_modules")
    if not os.path.exists(node_modules):
        log("Installing frontend NPM packages...", "[SYNC]")
        subprocess.run(["npm", "install"], cwd=ROOT_DIR, shell=(sys.platform == "win32"), check=True)

    return python_bin

def init_database(python_bin):
    log("Step 2/3: Initializing Database & Seeding Default Accounts...", "[DB]")
    try:
        env = os.environ.copy()
        env["PYTHONPATH"] = BACKEND_DIR
        subprocess.run([python_bin, "-m", "app.db.init_db"], cwd=BACKEND_DIR, env=env, check=True)
        log("Database schemas & seed users successfully initialized!", "[OK]")
    except Exception as e:
        log(f"Database initialization notice: {e}", "[WARN]")

def launch_services(python_bin):
    log("Step 3/3: Spawning Stack Services Concurrently...", "[LAUNCH]")
    
    processes = []
    env = os.environ.copy()
    env["PYTHONPATH"] = BACKEND_DIR

    bin_dir = os.path.dirname(python_bin)
    if sys.platform == "win32":
        uvicorn_bin = os.path.join(bin_dir, "uvicorn.exe")
        celery_bin = os.path.join(bin_dir, "celery.exe")
    else:
        uvicorn_bin = os.path.join(bin_dir, "uvicorn")
        celery_bin = os.path.join(bin_dir, "celery")

    try:
        # 1. Start Celery Worker
        log("Spawning Celery Task Worker...", "[CELERY]")
        celery_cmd = [
            celery_bin, "-A", "app.core.celery_app", "worker",
            "--loglevel=info", "--pool=solo",
            "-Q", "image_queue,audio_queue,video_queue,url_queue,default"
        ]
        p_celery = subprocess.Popen(celery_cmd, cwd=BACKEND_DIR, env=env, shell=(sys.platform == "win32"))
        processes.append(p_celery)

        # 2. Start FastAPI Backend Server
        log("Spawning FastAPI Uvicorn Server (Port 8000)...", "[BACKEND]")
        uvicorn_cmd = [uvicorn_bin, "main:app", "--reload", "--port", "8000"]
        p_backend = subprocess.Popen(uvicorn_cmd, cwd=BACKEND_DIR, env=env, shell=(sys.platform == "win32"))
        processes.append(p_backend)

        # 3. Start React Frontend Dashboard
        log("Spawning React Vite Client (Port 5173)...", "[FRONTEND]")
        p_frontend = subprocess.Popen(["npm", "run", "dev"], cwd=ROOT_DIR, shell=(sys.platform == "win32"))
        processes.append(p_frontend)

        time.sleep(3)
        print("\n" + "="*70)
        print("  DEEPGUARD STACK OPERATIONAL")
        print("="*70)
        print("  REACT DASHBOARD:    http://localhost:5173")
        print("  API SWAGGER DOCS:   http://localhost:8000/docs")
        print("  ADMIN ACCOUNT:      admin@example.com / AdminPass123!")
        print("  USER ACCOUNT:       user@example.com / UserPass123!")
        print("="*70)
        print("\nPress Ctrl+C to terminate all services cleanly.\n")

        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        log("Shutting down all processes...", "[SHUTDOWN]")
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
        log("All services closed. Goodbye!", "[BYE]")

if __name__ == "__main__":
    py_executable = check_and_setup_env()
    init_database(py_executable)
    launch_services(py_executable)
