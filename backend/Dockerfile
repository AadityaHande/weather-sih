# Production image for the Mausam FastAPI backend.
# Build context must be the repository root (not backend/), since the app
# imports across top-level packages (backend, engine, adapters, cache):
#
#   docker build -f backend/Dockerfile -t mausam-backend .
#   docker run --env-file backend/.env -p 8000:8000 mausam-backend

FROM python:3.12-slim

WORKDIR /app

# Install dependencies first for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy only the packages the backend actually needs at runtime.
COPY backend ./backend
COPY engine ./engine
COPY adapters ./adapters
COPY cache ./cache

# Not baked into the image — provided at deploy time via the platform's
# secret/env store (see backend/.env.example for the required keys).
ENV PYTHONUNBUFFERED=1 \
    ADAPTER_MODE=live

EXPOSE 8000

# Single worker by default: in-memory rate limiter and explanation cache
# (backend/routers/homepage.py, backend/main.py) are process-local. Scaling
# to multiple workers/replicas requires moving that state to a shared store
# (e.g. Redis) first -- see the comments at those call sites.
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
