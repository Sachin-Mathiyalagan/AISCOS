#!/usr/bin/env bash
echo "========================================================"
echo "  AISCOS — AI-Powered Smart Clinic & Hospital OS"
echo "========================================================"

# Launch Backend in background
python backend/run.py &
BACKEND_PID=$!

# Launch Frontend
cd frontend && npm run dev &
FRONTEND_PID=$!

echo "AISCOS Services Started:"
echo " - Backend API: http://localhost:8000"
echo " - API Docs:    http://localhost:8000/api/v1/docs"
echo " - Frontend UI: http://localhost:5173"

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
