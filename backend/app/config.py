from __future__ import annotations

import os
import shutil
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
DATA_DIR = BACKEND_DIR / "data"
AUTISM_DIR = PROJECT_ROOT / "Autism"
LEGACY_DB_PATH = BACKEND_DIR / "medisonar_memory.db"
DB_PATH = DATA_DIR / "medisonar.db"


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if LEGACY_DB_PATH.exists() and not DB_PATH.exists():
        shutil.copyfile(LEGACY_DB_PATH, DB_PATH)


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str
    chat_model: str = "gemini-2.5-flash-lite"
    grounded_model: str = "gemini-2.5-flash"
    advisories_cache_ttl_seconds: int = 20 * 60
    fingerprint_serial_port: str = ""
    db_path: Path = DB_PATH


def load_settings() -> Settings:
    env_path = BACKEND_DIR / ".env"
    load_dotenv(dotenv_path=env_path)
    _ensure_data_dir()
    return Settings(
        gemini_api_key=os.environ.get("GEMINI_API_KEY", ""),
        fingerprint_serial_port=os.environ.get("FINGERPRINT_SERIAL_PORT", ""),
    )

