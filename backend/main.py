import logging
import time
from collections import defaultdict, deque

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from backend.db import init_db, init_pool, close_pool, get_connection
from backend.settings import settings
from backend.routers import preferences, homepage, explain, insights

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("mausam.backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        init_pool()
        init_db()
    except Exception as e:
        logger.warning(f"DB initialization error: {e}")
    yield
    # Shutdown
    try:
        close_pool()
    except Exception as e:
        logger.warning(f"DB pool close error: {e}")

app = FastAPI(title="Mausam Personalized Homepage API", lifespan=lifespan)

origins = [o.strip() for o in settings.cors_allowed_origins.split(",") if o.strip()]
if not origins:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if "*" not in origins else ["*"],
    allow_credentials=True if "*" not in origins else False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------------------------------------------------------------
# Lightweight per-IP rate limiting.
#
# /homepage triggers several outbound calls to external live weather/AQI/UV
# APIs per request, so an unthrottled endpoint is both an abuse vector and a
# cost/latency risk. This is a simple in-memory sliding-window limiter (no
# new dependency) suitable for a single-process deployment; a multi-worker
# or multi-replica deployment should move this to a shared store (e.g.
# Redis) instead, same caveat as the explain_db note in homepage.py.
# ----------------------------------------------------------------------------
RATE_LIMIT_MAX_REQUESTS = 60
RATE_LIMIT_WINDOW_SECONDS = 60
_request_log: dict[str, deque] = defaultdict(deque)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Health checks and docs are exempt so uptime monitors are never throttled.
    if request.url.path in ("/health", "/docs", "/openapi.json", "/redoc"):
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    window = _request_log[client_ip]

    while window and now - window[0] > RATE_LIMIT_WINDOW_SECONDS:
        window.popleft()

    if len(window) >= RATE_LIMIT_MAX_REQUESTS:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Please slow down and try again shortly."},
            headers={"Retry-After": str(RATE_LIMIT_WINDOW_SECONDS)},
        )

    window.append(now)
    return await call_next(request)


# ----------------------------------------------------------------------------
# Global exception handler.
#
# Any unhandled exception previously propagated as FastAPI's default 500
# response, which (in debug-adjacent setups) can leak stack traces/internal
# details to the client. Log the full exception server-side, return a clean,
# generic JSON error to the caller.
# ----------------------------------------------------------------------------
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again."},
    )


app.include_router(preferences.router)
app.include_router(homepage.router)
app.include_router(explain.router)
app.include_router(insights.router)

@app.get("/health")
def health():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        return {"status": "ok", "db": "connected"}
    except Exception:
        # We catch exceptions to prevent crash, instead returning degraded status.
        # Do not expose exception str() to UI to protect potential secrets in DSN traces.
        return JSONResponse(status_code=503, content={"status": "degraded", "db": "unavailable"})
