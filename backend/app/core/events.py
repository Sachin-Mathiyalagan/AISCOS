import asyncio
import json
from typing import Dict, List, Set
from fastapi import WebSocket

class WebSocketConnectionManager:
    def __init__(self):
        # Maps channel (e.g. "clinic:1:queue", "patient:5") to active WebSockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.lock = asyncio.Lock()

    async def connect(self, channel: str, websocket: WebSocket):
        await websocket.accept()
        async with self.lock:
            if channel not in self.active_connections:
                self.active_connections[channel] = set()
            self.active_connections[channel].add(websocket)

    async def disconnect(self, channel: str, websocket: WebSocket):
        async with self.lock:
            if channel in self.active_connections:
                self.active_connections[channel].discard(websocket)
                if not self.active_connections[channel]:
                    del self.active_connections[channel]

    async def broadcast_to_channel(self, channel: str, message: dict):
        async with self.lock:
            websockets = list(self.active_connections.get(channel, []))
            # Also broadcast to global "all" channel
            all_websockets = list(self.active_connections.get("all", []))
        
        payload_str = json.dumps(message)
        
        for ws in set(websockets + all_websockets):
            try:
                await ws.send_text(payload_str)
            except Exception:
                # Disconnect stale sockets gracefully
                pass

ws_manager = WebSocketConnectionManager()
