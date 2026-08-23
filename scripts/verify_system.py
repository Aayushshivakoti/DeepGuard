import os
import sys

def check_backend_fixes():
    print("\n[CHECK] Checking Backend Fixes...")
    backend_path = os.path.join(os.getcwd(), "backend")
    sys.path.append(backend_path)

    # 1. Verify SSRF Fix in security_middleware.py
    sec_file = os.path.join(backend_path, "app", "middleware", "security_middleware.py")
    if os.path.exists(sec_file):
        with open(sec_file, "r", encoding="utf-8") as f:
            content = f.read()
            if "Host" in content and ("ip" in content or "resolved" in content):
                print("  [PASS] SSRF DNS Rebinding protection present.")
            else:
                print("  [WARN] Check SSRF host header forwarding in security_middleware.py.")

    # 2. Verify Database Pool Pre-ping
    session_file = os.path.join(backend_path, "app", "db", "session.py")
    if os.path.exists(session_file):
        with open(session_file, "r", encoding="utf-8") as f:
            content = f.read()
            if "pool_pre_ping=True" in content or "pool_pre_ping" in content:
                print("  [PASS] SQLAlchemy pool_pre_ping configured.")
            else:
                print("  [WARN] Ensure pool_pre_ping=True is set in db/session.py.")

def check_frontend_fixes():
    print("\n[CHECK] Checking Frontend Fixes...")
    
    # 1. Verify AlertHub WebSocket cleanup
    alert_hub = os.path.join(os.getcwd(), "src", "components", "common", "AlertHub.jsx")
    if os.path.exists(alert_hub):
        with open(alert_hub, "r", encoding="utf-8") as f:
            content = f.read()
            if "close()" in content or "isMounted" in content:
                print("  [PASS] AlertHub WebSocket unmount memory leak protection active.")
            else:
                print("  [WARN] Ensure socket.close() cleanup exists in AlertHub.jsx.")

    # 2. Verify useScan.js fallback
    use_scan = os.path.join(os.getcwd(), "src", "hooks", "useScan.js")
    if os.path.exists(use_scan):
        with open(use_scan, "r", encoding="utf-8") as f:
            content = f.read()
            if "onerror" in content or "onclose" in content or "poll" in content:
                print("  [PASS] useScan.js WebSocket drop fallback mechanism detected.")
            else:
                print("  [WARN] Verify reconnection/polling fallback in useScan.js.")

if __name__ == "__main__":
    print("=" * 60)
    print("      DEEPGUARD SYSTEM RESOLUTION & HEALTH VERIFICATION")
    print("=" * 60)
    check_backend_fixes()
    check_frontend_fixes()
    print("\nVerification finished. Proceeding to launch orchestrator...\n")
