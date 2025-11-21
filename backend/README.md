Backend (FastAPI + MongoDB)
---------------------------
Requirements:
- Python 3.9+
- MongoDB running on localhost:27017

Install:
    python -m venv venv
    venv\Scripts\activate   # Windows
    pip install -r requirements.txt

Run:
    uvicorn main:app --host 0.0.0.0 --port 8080 --reload

Notes:
- API requires a simple header-based auth. Add header:
    Authorization: admin:pims@123
- Endpoints:
    POST /api/reports/         (add daily report)
    GET  /api/reports/{date}   (get daily reports)
    GET  /api/aggregate/month/{year}/{month}
    GET  /api/aggregate/year/{year}
