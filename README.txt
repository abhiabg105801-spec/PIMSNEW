PIMS System (FastAPI + MongoDB + Vite React)
============================================
Structure:
- backend/: FastAPI backend (run on port 8080)
- frontend/: Vite React frontend (dev server port 3000)

Quick start:
1) Start MongoDB on localhost:27017
2) Backend:
    cd backend
    python -m venv venv
    venv\Scripts\activate   # on Windows
    pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port 8080 --reload

3) Frontend:
    cd frontend
    npm install
    npm run dev

Login credentials (predefined):
    username: admin
    password: pims@123

API header-based auth:
    Add request header: Authorization: admin:pims@123

