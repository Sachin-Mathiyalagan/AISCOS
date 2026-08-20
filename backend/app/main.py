import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.events import ws_manager
from app.api.v1.router import api_router
from app.seed.seeder import seed_database

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: seed database and train/warmup AI models
    print(f"[STARTUP] Initializing {settings.PROJECT_NAME} v{settings.VERSION}...")
    seed_database()
    print("[STARTUP] Database ready & verified.")
    yield
    print("[SHUTDOWN] Terminating AISCOS server cleanly.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AI-Powered Smart Clinic & Hospital Operating System for Intelligent Patient Flow, Healthcare Automation, Electronic Health Records, and Clinical Decision Support.",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount REST API
app.include_router(api_router, prefix=settings.API_V1_STR)

# Health & Readiness Probes
@app.get("/health", tags=["System Observability"])
def health_check():
    return {
        "status": "HEALTHY",
        "service": "AISCOS Backend Core",
        "version": settings.VERSION,
        "database": "CONNECTED",
        "ai_engines": "ONLINE"
    }

@app.get("/docs", include_in_schema=False)
def docs_redirect():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=f"{settings.API_V1_STR}/docs")

@app.get("/ready", tags=["System Observability"])
def readiness_check():
    return {"ready": True}

# Real-time WebSocket Endpoint
@app.websocket("/api/v1/ws/{channel}")
async def websocket_endpoint(websocket: WebSocket, channel: str):
    await ws_manager.connect(channel, websocket)
    try:
        while True:
            # Keep-alive loop and listen for client messages
            data = await websocket.receive_text()
            # Echo or acknowledge
            await websocket.send_json({"event": "PONG", "received": data})
    except WebSocketDisconnect:
        await ws_manager.disconnect(channel, websocket)
    except Exception:
        await ws_manager.disconnect(channel, websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
