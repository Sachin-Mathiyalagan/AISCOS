@echo off
echo ========================================================
echo   AISCOS — AI-Powered Smart Clinic & Hospital OS
echo ========================================================
echo Starting AISCOS Backend & Frontend services...

start "AISCOS Backend (FastAPI)" cmd /k "python backend/run.py"
start "AISCOS Frontend (Vite)" cmd /k "cd frontend && npm run dev"

echo.
echo AISCOS is running:
echo  - Backend API: http://localhost:8000
echo  - API Docs:    http://localhost:8000/api/v1/docs
echo  - Frontend UI: http://localhost:5173
echo.
echo Press any key to exit this launcher window...
pause >nul
