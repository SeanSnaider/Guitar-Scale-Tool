"""Tests for the JSON error envelope returned on every failure path.

Every error body has ``success: false``, a string ``error`` and the
original FastAPI ``detail`` so both new and existing clients can parse it.
"""
from httpx import ASGITransport, AsyncClient

from app.database import get_database
from app.main import app


def _assert_envelope(response, status_code):
    assert response.status_code == status_code
    assert response.headers["content-type"].startswith("application/json")
    body = response.json()
    assert body["success"] is False
    assert isinstance(body["error"], str) and body["error"]
    assert "detail" in body
    return body


class TestErrorEnvelope:
    async def test_http_exception(self, client):
        """A route-raised HTTPException keeps its message in error and detail."""
        response = await client.get("/sessions/12345")
        body = _assert_envelope(response, 404)
        assert body["error"] == "Session not found"
        assert body["detail"] == "Session not found"

    async def test_unknown_route(self, client):
        """Router-level 404s use the envelope too."""
        response = await client.get("/does-not-exist")
        body = _assert_envelope(response, 404)
        assert body["detail"] == "Not Found"

    async def test_validation_error(self, client):
        """422s summarise the first error and keep FastAPI's list in detail."""
        response = await client.post(
            "/scales/attempt",
            json={"scale_key": "C_major", "bpm": 5, "correct": True},
        )
        body = _assert_envelope(response, 422)
        assert "bpm" in body["error"]
        assert isinstance(body["detail"], list)
        assert body["detail"][0]["loc"] == ["body", "bpm"]

    async def test_missing_session_header(self, client):
        """A missing X-Session-ID header is a 422 envelope, not a crash."""
        response = await client.get("/stats", headers={"X-Session-ID": ""})
        _assert_envelope(response, 422)

    async def test_unhandled_exception_is_json_500_with_cors(self, client):
        """An unexpected exception returns a JSON 500 that still carries CORS headers."""

        async def broken_database():
            raise RuntimeError("boom: secret internals")
            yield  # pragma: no cover - makes this an async generator

        app.dependency_overrides[get_database] = broken_database
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
            headers={"X-Session-ID": "test-session-123"},
        ) as c:
            response = await c.get(
                "/stats", headers={"Origin": "http://localhost:5173"}
            )
        body = _assert_envelope(response, 500)
        assert body["error"] == "Internal server error"
        assert "secret" not in response.text
        assert (
            response.headers.get("access-control-allow-origin")
            == "http://localhost:5173"
        )
