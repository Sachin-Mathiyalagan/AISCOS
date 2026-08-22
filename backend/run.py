import os
import sys
import uvicorn

# Ensure backend directory is in python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    is_prod = os.environ.get("ENV") == "production"
    print(f"[AISCOS] Starting AISCOS API Server on http://0.0.0.0:{port} ...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=not is_prod)

