# router_logic.py
import sqlite3
import json
from fastapi import APIRouter
from pydantic import BaseModel

DB = "logic_diagrams.db"
router = APIRouter(prefix="/logic", tags=["Logic-Diagram"])


# ---------------- Init DB ----------------
def init_db():
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS diagrams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            data TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


init_db()


# ---------------- Models ----------------
class Diagram(BaseModel):
    name: str
    data: dict


# ---------------- Helper ----------------
def sanitize_diagram(raw_data: dict):
    clean_nodes = []
    for n in raw_data.get("nodes", []):
        clean_nodes.append({
            "id": n.get("id"),
            "type": n.get("type"),
            "position": n.get("position"),
            "data": n.get("data", {})
        })

    clean_edges = []
    for e in raw_data.get("edges", []):
        clean_edges.append({
            "id": e.get("id"),
            "source": e.get("source"),
            "target": e.get("target"),
            "sourceHandle": e.get("sourceHandle"),
            "targetHandle": e.get("targetHandle"),
        })

    return {"nodes": clean_nodes, "edges": clean_edges}


# ---------------- Routes ----------------
@router.post("/save")
def save_diagram(diagram: Diagram):
    clean_data = sanitize_diagram(diagram.data)
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO diagrams(name, data)
        VALUES(?, ?)
        ON CONFLICT(name)
        DO UPDATE SET data=excluded.data
    """, (diagram.name, json.dumps(clean_data)))

    conn.commit()
    conn.close()
    return {"status": "saved", "name": diagram.name}


@router.get("/load/{name}")
def load_diagram(name: str):
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("SELECT data FROM diagrams WHERE name=?", (name,))
    row = cur.fetchone()
    conn.close()

    if not row:
        return {"exists": False}

    return {"exists": True, "data": json.loads(row["data"])}


@router.get("/list")
def list_diagrams():
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    cur.execute("SELECT name FROM diagrams ORDER BY id DESC")
    names = [r[0] for r in cur.fetchall()]
    conn.close()
    return names


@router.delete("/delete/{name}")
def delete_diagram(name: str):
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    cur.execute("DELETE FROM diagrams WHERE name=?", (name,))
    conn.commit()
    deleted = cur.rowcount
    conn.close()

    return {"status": "deleted" if deleted else "not_found", "name": name}
