@echo off
set PYTHONIOENCODING=utf-8
set PYTHONUNBUFFERED=1
IF EXIST "%~dp0backend\venv\Scripts\python.exe" (
    "%~dp0backend\venv\Scripts\python.exe" "%~dp0start.py"
) ELSE (
    py -3 "%~dp0start.py"
)
