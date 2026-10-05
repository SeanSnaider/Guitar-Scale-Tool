"""Application configuration loaded from environment variables.

Reads settings from environment or a .env file. All values have sensible
defaults so the app can start without any external configuration.
"""
import json
from typing import Annotated, Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Central settings object for the Guitar Learning Tool API.

    Attributes:
        database_url: SQLAlchemy async database URL. Defaults to a local
            SQLite file named ``guitar_learning.db`` in the working directory.
        cors_origins: Allowed CORS origin list for the frontend. In the
            environment it may be a single origin, a comma-separated list,
            or a JSON array.
    """

    model_config = SettingsConfigDict(env_file=".env")

    database_url: str = "sqlite+aiosqlite:///./guitar_learning.db"
    # NoDecode stops pydantic-settings from requiring JSON for this list
    # field, so the plain ``CORS_ORIGINS=http://...`` form in .env.example works.
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value: Any) -> Any:
        """Accept a JSON array or a comma-separated string of origins.

        Args:
            value: Raw value from the environment or a Python default.

        Returns:
            A list of origin strings, or ``value`` unchanged if it is not
            a string (letting normal list validation handle it).
        """
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        if stripped.startswith("["):
            return json.loads(stripped)
        return [origin.strip() for origin in stripped.split(",") if origin.strip()]


settings = Settings()
