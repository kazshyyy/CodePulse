@echo off
echo.
echo  ⚡ CodePulse – IBM Bob 2.0 Hackathon Demo
echo  ==========================================
echo.

cd /d "%~dp0backend"

echo  Starting CodePulse server...
echo  Open http://localhost:8000 in your browser
echo.
echo  Press Ctrl+C to stop.
echo.

python -m uvicorn main:app --host 0.0.0.0 --port 8000
