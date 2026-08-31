import os
from dotenv import load_dotenv

# Load from .env if present
load_dotenv()

class Settings:
    def __init__(self):
        self.adapter_mode = os.getenv("ADAPTER_MODE", "live")
        self.fixture_scenario = os.getenv("FIXTURE_SCENARIO", "normal")
        self.cors_allowed_origins = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")

        self.database_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/mausam")

settings = Settings()
