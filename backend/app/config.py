"""Application configuration loaded from environment variables.

Reads settings from environment or a .env file. All values have sensible
defaults so the app can start without any external configuration.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Central settings object for the Guitar Learning Tool API.

    Attributes:
        database_url: SQLAlchemy async database URL. Defaults to a local
            SQLite file named ``guitar_learning.db`` in the working directory.
        cors_origins: Allowed CORS origin list for the frontend.
    """

    database_url: str = "sqlite+aiosqlite:///./guitar_learning.db"
    cors_origins: list[str] = ["http://localhost:5173"]

    class Config:
        env_file = ".env"


settings = Settings()
