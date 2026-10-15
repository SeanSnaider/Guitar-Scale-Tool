"""Tests for environment-driven settings parsing."""
from app.config import Settings


class TestCorsOrigins:
    """CORS_ORIGINS accepts the formats documented in .env.example/README."""

    def test_comma_separated(self, monkeypatch):
        """A comma-separated value (the .env.example format) parses to a list."""
        monkeypatch.setenv(
            "CORS_ORIGINS", "http://localhost:5173, http://127.0.0.1:5173,"
        )
        settings = Settings(_env_file=None)
        assert settings.cors_origins == [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]

    def test_single_origin(self, monkeypatch):
        """A single bare origin (previously a startup crash) parses."""
        monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173")
        settings = Settings(_env_file=None)
        assert settings.cors_origins == ["http://localhost:5173"]

    def test_json_list(self, monkeypatch):
        """A JSON list is still accepted."""
        monkeypatch.setenv("CORS_ORIGINS", '["http://a.test", "http://b.test"]')
        settings = Settings(_env_file=None)
        assert settings.cors_origins == ["http://a.test", "http://b.test"]

    def test_defaults_include_dev_and_preview(self, monkeypatch):
        """Defaults cover the Vite dev server on both hosts and vite preview."""
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        settings = Settings(_env_file=None)
        assert "http://localhost:5173" in settings.cors_origins
        assert "http://127.0.0.1:5173" in settings.cors_origins
        assert "http://localhost:4173" in settings.cors_origins

    def test_env_example_parses(self):
        """The shipped .env.example loads without error."""
        from pathlib import Path

        env_example = Path(__file__).resolve().parent.parent / ".env.example"
        settings = Settings(_env_file=env_example)
        assert "http://localhost:5173" in settings.cors_origins
