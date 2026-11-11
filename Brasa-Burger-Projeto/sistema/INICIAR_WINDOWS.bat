@echo off
cd /d "%~dp0backend"
if not exist "venv\Scripts\python.exe" (
    py -3.14 -m venv venv
)
"venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (pause & exit /b 1)
start "" http://127.0.0.1:8000
"venv\Scripts\python.exe" -m uvicorn app.main:app --reload --port 8000
pause
