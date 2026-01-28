from fastapi import WebSocket
from typing import List

class ClickerManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.global_count = 0

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        # Send current count immediately on connect
        await websocket.send_text(str(self.global_count))

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def increment(self):
        self.global_count += 1
        return self.global_count

    async def broadcast_count(self):
        for connection in self.active_connections:
            try:
                await connection.send_text(str(self.global_count))
            except:
                # If sending fails, we might remove the connection, or just ignore
                pass
