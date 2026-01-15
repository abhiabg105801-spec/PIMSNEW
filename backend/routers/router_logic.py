# router_logic.py
import sqlite3
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

DB = "logic_diagrams.db"
router = APIRouter(prefix="/logic", tags=["Logic-Diagram"])


# ---------------- Init DB ----------------
def init_db():
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    
    # Folders table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Diagrams table with folder reference
    cur.execute("""
        CREATE TABLE IF NOT EXISTS diagrams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            folder_id INTEGER,
            data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
        )
    """)
    
    conn.commit()
    conn.close()


init_db()


# ---------------- Models ----------------
class Diagram(BaseModel):
    name: str
    folderId: Optional[int] = None
    data: dict
    id: Optional[int] = None  # Add this line


class Folder(BaseModel):
    name: str


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

# Create Folder
@router.post("/folder")
def create_folder(folder: Folder):
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    
    try:
        cur.execute("INSERT INTO folders(name) VALUES(?)", (folder.name,))
        folder_id = cur.lastrowid
        conn.commit()
        return {"status": "created", "id": folder_id, "name": folder.name}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Folder already exists")
    finally:
        conn.close()


# Get all folders with diagrams
@router.get("/folders")
def get_folders():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    cur.execute("SELECT * FROM folders ORDER BY id DESC")
    folders = []
    
    for folder_row in cur.fetchall():
        folder = dict(folder_row)
        folder_id = folder["id"]
        
        # Get diagrams for this folder
        cur.execute(
            "SELECT id, name FROM diagrams WHERE folder_id=? ORDER BY id DESC", 
            (folder_id,)
        )
        folder["diagrams"] = [dict(d) for d in cur.fetchall()]
        folder["expanded"] = False
        folders.append(folder)
    
    conn.close()
    return folders


# Delete Folder
@router.delete("/folder/{folder_id}")
def delete_folder(folder_id: int):
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    
    cur.execute("DELETE FROM folders WHERE id=?", (folder_id,))
    conn.commit()
    deleted = cur.rowcount
    conn.close()
    
    return {"status": "deleted" if deleted else "not_found", "id": folder_id}


# Save Diagram


@router.post("/save")
def save_diagram(diagram: Diagram):
    clean_data = sanitize_diagram(diagram.data)
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    # Check if updating existing diagram
    diagram_id = diagram.dict().get('id')
    
    if diagram_id:
        # Update existing
        cur.execute("""
            UPDATE diagrams 
            SET name=?, data=?, updated_at=CURRENT_TIMESTAMP 
            WHERE id=?
        """, (diagram.name, json.dumps(clean_data), diagram_id))
        conn.commit()
        conn.close()
        return {"status": "updated", "name": diagram.name, "id": diagram_id}
    else:
        # Check if diagram with same name exists in folder
        cur.execute(
            "SELECT id FROM diagrams WHERE name=? AND folder_id=?", 
            (diagram.name, diagram.folderId)
        )
        existing = cur.fetchone()
        
        if existing:
            # Update
            cur.execute("""
                UPDATE diagrams 
                SET data=?, updated_at=CURRENT_TIMESTAMP 
                WHERE id=?
            """, (json.dumps(clean_data), existing[0]))
            diagram_id = existing[0]
        else:
            # Insert new
            cur.execute("""
                INSERT INTO diagrams(name, folder_id, data)
                VALUES(?, ?, ?)
            """, (diagram.name, diagram.folderId, json.dumps(clean_data)))
            diagram_id = cur.lastrowid

        conn.commit()
        conn.close()
        return {"status": "saved", "name": diagram.name, "id": diagram_id}
    clean_data = sanitize_diagram(diagram.data)
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    # Check if diagram exists
    cur.execute(
        "SELECT id FROM diagrams WHERE name=? AND folder_id=?", 
        (diagram.name, diagram.folderId)
    )
    existing = cur.fetchone()
    
    if existing:
        # Update
        cur.execute("""
            UPDATE diagrams 
            SET data=?, updated_at=CURRENT_TIMESTAMP 
            WHERE id=?
        """, (json.dumps(clean_data), existing[0]))
    else:
        # Insert
        cur.execute("""
            INSERT INTO diagrams(name, folder_id, data)
            VALUES(?, ?, ?)
        """, (diagram.name, diagram.folderId, json.dumps(clean_data)))

    conn.commit()
    conn.close()
    return {"status": "saved", "name": diagram.name}


# Load Diagram
@router.get("/load/{diagram_id}")
def load_diagram(diagram_id: int):
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("SELECT data FROM diagrams WHERE id=?", (diagram_id,))
    row = cur.fetchone()
    conn.close()

    if not row:
        return {"exists": False}

    return {"exists": True, "data": json.loads(row["data"])}


# Delete Diagram
@router.delete("/delete/{diagram_id}")
def delete_diagram(diagram_id: int):
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    cur.execute("DELETE FROM diagrams WHERE id=?", (diagram_id,))
    conn.commit()
    deleted = cur.rowcount
    conn.close()

    return {"status": "deleted" if deleted else "not_found", "id": diagram_id}