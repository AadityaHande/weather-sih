from contextlib import contextmanager
from backend.settings import settings
import psycopg
from psycopg_pool import ConnectionPool

import logging

logger = logging.getLogger(__name__)

# Global connection pool and in-memory fallback store
_pool = None
_in_memory_prefs = {}
_in_memory_cache = {}

def init_pool():
    global _pool
    if _pool is None and settings.database_url:
        try:
            _pool = ConnectionPool(
                conninfo=settings.database_url,
                max_idle=30,
                timeout=1.0,
                open=False,
                check=ConnectionPool.check_connection
            )
            _pool.open(wait=False)
        except Exception as e:
            logger.warning(f"Could not initialize connection pool: {e}")
            _pool = None

def close_pool():
    global _pool
    if _pool is not None:
        try:
            _pool.close(timeout=1.0)
        except Exception:
            pass
        _pool = None

@contextmanager
def get_connection():
    if _pool is None:
        if settings.database_url:
            with psycopg.connect(settings.database_url, connect_timeout=1) as conn:
                yield conn
        else:
            raise ConnectionError("No DATABASE_URL configured")
    else:
        with _pool.connection(timeout=1.0) as conn:
            yield conn

def init_db():
    """Initializes the database schema using Neon Postgres."""
    try:
        with get_connection() as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS preferences (
                  device_id TEXT PRIMARY KEY,
                  personas TEXT NOT NULL,
                  health_flags TEXT NOT NULL,
                  saved_locations TEXT,
                  updated_at TEXT NOT NULL
                );
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS signal_cache (
                  cache_key TEXT PRIMARY KEY,
                  value_json TEXT NOT NULL,
                  source TEXT NOT NULL,
                  fetched_at TEXT NOT NULL,
                  confidence REAL NOT NULL,
                  freshness_min INTEGER
                );
            ''')
            conn.commit()

            # In case the table is altered since 14/15/16 docs had a slight difference
            # Execute each alter sequentially wrapped in a savepoint rollback wrapper
            for col, col_def in [("confidence", "REAL NOT NULL DEFAULT 1.0"), ("freshness_min", "INTEGER")]:
                try:
                    with conn.transaction():
                        conn.execute(f"ALTER TABLE signal_cache ADD COLUMN {col} {col_def};")
                except Exception:
                    pass
    except Exception as e:
        logger.warning(f"Failed to init db: {e}")
