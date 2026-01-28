from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from clicker_manager import ClickerManager
from pydantic import BaseModel
from typing import List
import sqlite3
import os

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Manager for Golden Duck Clicks
clicker_manager = ClickerManager()

# --- DATABASE SETUP ---
DB_NAME = "games.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS scores
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  name TEXT NOT NULL, 
                  score INTEGER NOT NULL)''')
    conn.commit()
    conn.close()

init_db()

@app.get("/")
def read_root():
    return {"message": "Duck Games API is running"}

# --- WEBSOCKET FOR CLICKER ---
@app.websocket("/ws/clicker")
async def websocket_endpoint(websocket: WebSocket):
    await clicker_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "click":
                new_count = await clicker_manager.increment()
                await clicker_manager.broadcast_count() 
    except WebSocketDisconnect:
        clicker_manager.disconnect(websocket)
    except Exception as e:
        print(f"Error: {e}")
        clicker_manager.disconnect(websocket)

# --- LEADERBOARD API ---

class Score(BaseModel):
    name: str
    score: int

@app.get("/leaderboard")
def get_leaderboard():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT name, score FROM scores ORDER BY score DESC LIMIT 5")
    rows = c.fetchall()
    conn.close()
    return [{"name": row["name"], "score": row["score"]} for row in rows]

@app.post("/leaderboard")
def add_score(score: Score):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("INSERT INTO scores (name, score) VALUES (?, ?)", (score.name, score.score))
    conn.commit()
    conn.close()
    return {"message": "Score added"}
