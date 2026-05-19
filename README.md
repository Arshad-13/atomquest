# AtomQuest

AtomQuest is a lightweight goal-setting and performance tracking application built with a FastAPI backend and a React + Vite TypeScript frontend. It provides role-based access controls (RBAC), goal lifecycle management, check-ins, and manager analytics suitable for small teams and internal HR workflows.

![Architecture diagram](@file:image.svg)

## Key Features
- Role-based access control: Employee, Manager, Admin
- Goal creation, submission, approval, return, and locking
- Check-ins with quarterly tracking and simple analytics
- Audit logs and administrative consoles

## Tech Stack
- Backend: Python, FastAPI, SQLAlchemy
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Auth: JWT (python-jose), bcrypt for password hashing
- Persistence: SQLite (dev) or PostgreSQL (recommended for production)

## Quickstart (Development)

Prerequisites:
- Python 3.11+ (or compatible)
- Node 18+ and npm

Backend (from project root):

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# edit .env to configure DATABASE_URL and SECRET_KEY
python -m uvicorn main:app --reload
```

Frontend (from project root):

```bash
cd frontend
npm ci
npm run dev
```

## Environment / Production Notes
- Always set `APP_ENV=production` and provide a secure `SECRET_KEY` (32+ random bytes hex).
- Use `DATABASE_URL` with a managed PostgreSQL instance in production.
- Set `ALLOWED_ORIGINS` to your frontend domain(s) for CORS.
- Do not commit `.env` files. Keep only `.env.example` in the repo.

## Building for Production
- Build frontend assets:

```bash
cd frontend
npm ci --production
npm run build
# serve the `dist` folder from a CDN or static web server
```

- Run backend behind a process manager (systemd) or inside a container. Ensure environment variables are injected at runtime.

## Security Checklist
- Rotate `SECRET_KEY` if suspected compromise.
- Use HTTPS and set HSTS in fronting proxy.
- Limit `ALLOWED_ORIGINS` to production domains.

## Contributing
- Fork the repo, create a feature branch, run linters and tests, open a pull request.

## License
- MIT

If you'd like, I can create a small `image.png` architecture diagram and add it to the repo. Tell me the preferred layout (boxes, arrows, labels) and I'll generate a placeholder image file.
