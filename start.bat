@echo off
set PYTHONIOENCODING=utf-8
IF EXIST "backend\venv\Scripts\python.exe" (
    "backend\venv\Scripts\python.exe" start.py
) ELSE (
    py -3 start.py
)
