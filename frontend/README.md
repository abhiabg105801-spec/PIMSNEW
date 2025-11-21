Frontend (Vite + React + Tailwind)
---------------------------------
Requirements:
- Node.js (16+)
- npm

Install:
    cd frontend
    npm install

Dev:
    npm run dev   # runs at http://localhost:3000 and proxies /api to http://localhost:8080

Build:
    npm run build
    npm run preview

Notes:
- The dev server proxies API calls to http://localhost:8080 (backend). Make sure backend is running.
- Login: admin / pims@123
