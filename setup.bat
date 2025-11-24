@echo off
echo --------------------------------------------
echo   PIMS SYSTEM - FULL SETUP SCRIPT (Windows)
echo --------------------------------------------

REM ========= CHECK PYTHON ============
echo Checking Python...
python --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo ERROR: Python is not installed.
    echo Install Python 3.10+ and run again.
    pause
    exit /b
)

REM ========= CREATE BACKEND VENV ============
echo Creating Python virtual environment...
cd backend
python -m venv venv

echo Activating environment...
call venv\Scripts\activate

REM ========= INSTALL PIP PACKAGES ============
echo Installing Python requirements...
pip install --upgrade pip
pip install -r requirements.txt

REM ========= START BACKEND (FASTAPI) ============
echo Starting Backend Server at http://127.0.0.1:8002
start cmd /k "cd backend && venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8080"

cd ..

REM ========= CHECK NODE & INSTALL FRONTEND PACKAGES ============
echo Checking Node and npm...
node --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo ERROR: Node.js is not installed.
    echo Install Node.js LTS and run again.
    pause
    exit /b
)

echo Installing frontend NPM packages...
cd frontend
npm install

REM ========= START FRONTEND (React/Next.js) ============
echo Starting Frontend at http://localhost:3001
start cmd /k "cd frontend && npm run dev"

echo --------------------------------------------
echo        SETUP COMPLETE! SYSTEM IS RUNNING     
echo --------------------------------------------

pause
