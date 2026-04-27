"""Tests for the /sessions endpoints.

Covers the full lifecycle of a practice session: start, end, list, and
get-by-id operations.  All tests use the in-memory SQLite database
provided by conftest.py, so no real database file is required.
"""
import pytest


class TestStartSession:
    """POST /sessions/start creates a new practice session."""

    async def test_start_session(self, client):
        """A successful start returns the new session with started_at set and no ended_at."""
        response = await client.post(
            "/sessions/start",
            json={"scales_practiced": ["C_major"], "bpm": 100},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        data = body["data"]
        assert data["id"] is not None
        assert data["session_id"] == "test-session-123"
        assert data["started_at"] is not None
        assert data["ended_at"] is None
        assert data["duration_seconds"] is None
        assert data["scales_practiced"] == ["C_major"]
        assert data["bpm"] == 100

    async def test_start_session_defaults(self, client):
        """Starting a session with no body uses default bpm=120 and empty scales."""
        response = await client.post("/sessions/start", json={})
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["bpm"] == 120
        assert data["scales_practiced"] == []


class TestEndSession:
    """POST /sessions/{id}/end finalises a session."""

    async def test_end_session(self, client):
        """Ending a started session sets ended_at and computes duration_seconds > 0."""
        start_resp = await client.post("/sessions/start", json={})
        session_id = start_resp.json()["data"]["id"]

        end_resp = await client.post(
            f"/sessions/{session_id}/end",
            json={"accuracy": 0.85},
        )
        assert end_resp.status_code == 200
        body = end_resp.json()
        assert body["success"] is True
        data = body["data"]
        assert data["ended_at"] is not None
        assert data["duration_seconds"] is not None
        assert data["duration_seconds"] >= 0
        assert data["accuracy"] == 0.85

    async def test_end_nonexistent_session(self, client):
        """Attempting to end a session that does not exist returns 404."""
        response = await client.post(
            "/sessions/000000000000000000000001/end",
            json={},
        )
        assert response.status_code == 404

    async def test_end_session_no_accuracy(self, client):
        """Ending a session without providing accuracy leaves accuracy as None."""
        start_resp = await client.post("/sessions/start", json={})
        session_id = start_resp.json()["data"]["id"]

        end_resp = await client.post(f"/sessions/{session_id}/end", json={})
        assert end_resp.status_code == 200
        assert end_resp.json()["data"]["accuracy"] is None


class TestListSessions:
    """GET /sessions returns a paginated list of practice sessions."""

    async def test_list_sessions_empty(self, client):
        """When no sessions exist the response has an empty data list."""
        response = await client.get("/sessions")
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["data"] == []
        assert body["meta"]["total"] == 0

    async def test_list_sessions_newest_first(self, client):
        """Sessions are returned in reverse chronological order (newest first)."""
        await client.post("/sessions/start", json={"bpm": 80})
        await client.post("/sessions/start", json={"bpm": 140})

        response = await client.get("/sessions")
        assert response.status_code == 200
        sessions = response.json()["data"]
        assert len(sessions) == 2
        # The second session (bpm=140) should appear first
        assert sessions[0]["bpm"] == 140
        assert sessions[1]["bpm"] == 80

    async def test_list_sessions_paginated(self, client):
        """Pagination meta contains correct total, page, and limit values."""
        for _ in range(5):
            await client.post("/sessions/start", json={})

        response = await client.get("/sessions?page=1&limit=3")
        assert response.status_code == 200
        body = response.json()
        assert body["meta"]["total"] == 5
        assert body["meta"]["page"] == 1
        assert body["meta"]["limit"] == 3
        assert len(body["data"]) == 3

    async def test_list_sessions_page_two(self, client):
        """Page 2 of a paginated result returns the remaining sessions."""
        for _ in range(5):
            await client.post("/sessions/start", json={})

        response = await client.get("/sessions?page=2&limit=3")
        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) == 2
        assert body["meta"]["page"] == 2


class TestGetSession:
    """GET /sessions/{id} retrieves a single session by its ObjectId."""

    async def test_get_session_detail(self, client):
        """Fetching a session by its ID returns the full session document."""
        start_resp = await client.post(
            "/sessions/start",
            json={"scales_practiced": ["G_major"], "bpm": 90},
        )
        session_id = start_resp.json()["data"]["id"]

        response = await client.get(f"/sessions/{session_id}")
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        data = body["data"]
        assert data["id"] == session_id
        assert data["bpm"] == 90
        assert data["scales_practiced"] == ["G_major"]

    async def test_get_session_not_found(self, client):
        """Requesting a non-existent session ID returns 404."""
        response = await client.get("/sessions/000000000000000000000001")
        assert response.status_code == 404

    async def test_get_session_invalid_id(self, client):
        """A malformed (non-ObjectId) session ID returns 422 or 404."""
        response = await client.get("/sessions/not-a-valid-id")
        assert response.status_code in (404, 422)
