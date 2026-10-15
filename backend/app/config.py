"""Application configuration loaded from environment variables.

Reads settings from environment or a .env file. All values have sensible
defaults so the app can start without any external configuration.
"""
import json
from typing import Annotated, Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Vite dev server (localhost and 127.0.0.1) and ``vite preview``.
_DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
]


class Settings(BaseSettings):
    """Central settings object for the Guitar Learning Tool API.

    Attributes:
        database_url: SQLAlchemy async database URL. Defaults to a local
            SQLite file named ``guitar_learning.db`` in the working directory.
        cors_origins: Allowed CORS origin list for the frontend. From the
            environment it may be a comma-separated string
            (``CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173``)
            or a JSON list (``CORS_ORIGINS=["http://localhost:5173"]``).
    """

    model_config = SettingsConfigDict(env_file=".env")

    database_url: str = "sqlite+aiosqlite:///./guitar_learning.db"
    # NoDecode stops pydantic-settings from JSON-decoding the raw env value,
    # so the validator below sees the string and can accept either format.
    cors_origins: Annotated[list[str], NoDecode] = list(_DEFAULT_CORS_ORIGINS)

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value: Any) -> Any:
        """Accept a JSON list or a comma-separated string of origins."""
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("["):
                return json.loads(stripped)
            return [part.strip() for part in stripped.split(",") if part.strip()]
        return value


settings = Settings()
