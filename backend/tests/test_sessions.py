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


OTHER_CLIENT = {"X-Session-ID": "someone-else-456"}


class TestSessionScoping:
    """Sessions are scoped to the caller's X-Session-ID header."""

    async def test_list_only_returns_callers_sessions(self, client):
        """GET /sessions counts and returns only the caller's own sessions."""
        await client.post("/sessions/start", json={"bpm": 100})
        await client.post("/sessions/start", json={"bpm": 150}, headers=OTHER_CLIENT)

        mine = (await client.get("/sessions")).json()
        assert mine["meta"]["total"] == 1
        assert [s["bpm"] for s in mine["data"]] == [100]
        assert {s["session_id"] for s in mine["data"]} == {"test-session-123"}

        theirs = (await client.get("/sessions", headers=OTHER_CLIENT)).json()
        assert theirs["meta"]["total"] == 1
        assert {s["session_id"] for s in theirs["data"]} == {"someone-else-456"}

    async def test_get_other_clients_session_is_404(self, client):
        """GET /sessions/{id} for another client's row returns 404."""
        sid = (await client.post("/sessions/start", json={})).json()["data"]["id"]
        response = await client.get(f"/sessions/{sid}", headers=OTHER_CLIENT)
        assert response.status_code == 404
        assert "test-session-123" not in response.text

    async def test_end_other_clients_session_is_404_and_unchanged(self, client):
        """POST /sessions/{id}/end for another client's row returns 404 and does not end it."""
        sid = (await client.post("/sessions/start", json={})).json()["data"]["id"]
        response = await client.post(
            f"/sessions/{sid}/end", json={"accuracy": 0.5}, headers=OTHER_CLIENT
        )
        assert response.status_code == 404
        data = (await client.get(f"/sessions/{sid}")).json()["data"]
        assert data["ended_at"] is None
        assert data["accuracy"] is None


class TestEndSessionTwice:
    """Ending an already-ended session is a no-op."""

    async def test_second_end_returns_row_unchanged(self, client):
        sid = (await client.post("/sessions/start", json={})).json()["data"]["id"]
        first = await client.post(f"/sessions/{sid}/end", json={"accuracy": 0.9})
        assert first.status_code == 200
        second = await client.post(f"/sessions/{sid}/end", json={"accuracy": 0.1})
        assert second.status_code == 200
        assert second.json()["data"] == first.json()["data"]
        assert second.json()["data"]["accuracy"] == 0.9


class TestSessionTimestamps:
    """Serialised timestamps carry an explicit UTC offset."""

    async def test_started_and_ended_at_are_utc(self, client):
        sid = (await client.post("/sessions/start", json={})).json()["data"]["id"]
        await client.post(f"/sessions/{sid}/end", json={})
        data = (await client.get(f"/sessions/{sid}")).json()["data"]
        assert data["started_at"].endswith(("Z", "+00:00"))
        assert data["ended_at"].endswith(("Z", "+00:00"))

        listed = (await client.get("/sessions")).json()["data"][0]
        assert listed["started_at"].endswith(("Z", "+00:00"))


class TestSessionValidation:
    """Pagination, body, path and header bounds are enforced as 4xx, never 500."""

    async def test_pagination_bounds(self, client):
        for query in ("page=0", "page=-1", "limit=0", "limit=101", "limit=-1"):
            response = await client.get(f"/sessions?{query}")
            assert response.status_code == 422, query

    async def test_pagination_limit_max_ok(self, client):
        response = await client.get("/sessions?limit=100")
        assert response.status_code == 200

    async def test_huge_page_is_rejected_not_500(self, client):
        response = await client.get(f"/sessions?page={10**20}")
        assert response.status_code == 422

    async def test_bpm_bounds(self, client):
        for bpm in (19, 401, 0, -5):
            response = await client.post("/sessions/start", json={"bpm": bpm})
            assert response.status_code == 422, bpm
        for bpm in (20, 400):
            response = await client.post("/sessions/start", json={"bpm": bpm})
            assert response.status_code == 200, bpm

    async def test_accuracy_bounds(self, client):
        sid = (await client.post("/sessions/start", json={})).json()["data"]["id"]
        for accuracy in (-0.01, 1.01, 5):
            response = await client.post(
                f"/sessions/{sid}/end", json={"accuracy": accuracy}
            )
            assert response.status_code == 422, accuracy

    async def test_scales_practiced_limits(self, client):
        too_many = [f"s{i}" for i in range(51)]
        assert (
            await client.post("/sessions/start", json={"scales_practiced": too_many})
        ).status_code == 422
        assert (
            await client.post("/sessions/start", json={"scales_practiced": ["x" * 65]})
        ).status_code == 422
        assert (
            await client.post("/sessions/start", json={"scales_practiced": [""]})
        ).status_code == 422

    async def test_id_above_int64_is_404(self, client):
        for raw in (str(2**63), "99999999999999999999"):
            assert (await client.get(f"/sessions/{raw}")).status_code == 404
            assert (
                await client.post(f"/sessions/{raw}/end", json={})
            ).status_code == 404

    async def test_session_header_length(self, client):
        assert (
            await client.get("/sessions", headers={"X-Session-ID": "x" * 65})
        ).status_code == 422
        assert (
            await client.post(
                "/sessions/start", json={}, headers={"X-Session-ID": ""}
            )
        ).status_code == 422
        assert (
            await client.get("/sessions", headers={"X-Session-ID": "x" * 64})
        ).status_code == 200
