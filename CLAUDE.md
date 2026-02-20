# AI Accountant - Claude Code Configuration

## Self-Management
- Claude is allowed to edit this CLAUDE.md file to add rules, context, or reminders discovered during development.
- Claude is allowed to edit `~/.claude/settings.json` to add new permissions as needed.

## Project Overview
- AI-powered accounting system for Canadian small businesses
- Backend: Python 3.11+ / FastAPI / PostgreSQL 16 / SQLAlchemy
- Frontend: React 18 / TypeScript / Tailwind CSS / Vite
- AI: Self-hosted Ollama with Llama 3.2 + Tesseract OCR
- Infrastructure: Docker Compose / Caddy reverse proxy

## Key Directories
- `backend/` - FastAPI application (models, services, endpoints, config)
- `frontend/` - React/TypeScript application
- `docker-compose.yml` - Development environment
- `docker-compose.prod.yml` / `docker-compose.vps.yml` - Production

## Development Commands
- Backend: `pip install -r backend/requirements.txt`
- Frontend: `cd frontend && npm install && npm run dev`
- Docker dev: `docker-compose up --build`
- Tests: `pytest` (test suite needs to be created)

## Rules
- Always run tests before pushing. Never push without confirming tests pass first.

## Conventions
- Double-entry bookkeeping: every transaction must have balanced debits and credits
- Canadian tax compliance: GST/HST tracking, T2125 mapping, CRA-aligned categories
- All financial amounts stored as floats (consider Decimal migration)
