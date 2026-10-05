"""Regression tests for input validation and correctness fixes.

Each test class pins down one defect found during the repository audit:

- ``TestCorsOriginsConfig``: the documented ``CORS_ORIGINS=http://...``
  form in ``.env.example`` used to crash ``Settings()`` at import time.
- ``TestPaginationValidation``: non-positive ``page``/``limit`` values were
  passed straight into SQL (``LIMIT -1`` returns every row in SQLite).
- ``TestSessionEndValidation``: ending a session twice silently overwrote
  its duration, and ``accuracy`` accepted values outside ``[0, 1]``.
- ``TestBpmValidation``: absurd BPM values were accepted and could count
  towards mastery.
- ``TestStreakTimezone``: streak/date bucketing used a mix of UTC dates and
  the server's local "today", and ignored the user's timezone entirely.
"""
from datetime import date, datetime, timedelta, timezone

import pytest
from pydantic_settings import SettingsConfigDict

from app.config import Settings
from app.routers.stats import _compute_streaks


class _EnvOnlySettings(Settings):
    """Settings variant that ignores any ``.env`` file on disk.

    Lets the tests exercise environment-variable parsing without being
    affected by the developer's local ``backend/.env``.
    """

    model_config = SettingsConfigDict(env_file=None)


class TestCorsOriginsConfig:
    """CORS_ORIGINS accepts both the documented plain form and JSON."""

    def test_single_plain_origin(self, monkeypatch):
        """The exact value shipped in .env.example parses to a one-item list."""
        monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173")
        assert _EnvOnlySettings().cors_origins == ["http://localhost:5173"]

    def test_comma_separated_origins(self, monkeypatch):
        """Comma-separated origins are split and whitespace-trimmed."""
        monkeypatch.setenv(
            "CORS_ORIGINS", "http://localhost:5173, http://127.0.0.1:5173"
        )
        assert _EnvOnlySettings().cors_origins == [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]

    def test_json_list_still_supported(self, monkeypatch):
        """Existing .env files that use a JSON list keep working."""
        monkeypatch.setenv("CORS_ORIGINS", '["http://localhost:5173"]')
        assert _EnvOnlySettings().cors_origins == ["http://localhost:5173"]


class TestPaginationValidation:
    """page and limit must be positive and limit is capped."""

    @pytest.mark.parametrize("path", ["/sessions", "/chords"])
    @pytest.mark.parametrize(
        "query", ["page=0", "page=-1", "limit=0", "limit=-1", "limit=101"]
    )
    async def test_rejects_out_of_range_pagination(self, client, path, query):
        """Out-of-range pagination parameters are rejected with 422."""
        response = await client.get(f"{path}?{query}")
        assert response.status_code == 422

    async def test_negative_limit_does_not_dump_all_rows(self, client):
        """limit=-1 used to return every row (SQLite treats it as no limit)."""
        for _ in range(3):
            await client.post("/sessions/start", json={})
        response = await client.get("/sessions?limit=-1")
        assert response.status_code == 422


class TestSessionEndValidation:
    """A session can only be ended once, with a valid accuracy."""

    async def test_ending_twice_is_rejected(self, client):
        """A second end call returns 409 and leaves the first duration intact."""
        session_id = (await client.post("/sessions/start", json={})).json()["data"]["id"]
        first = await client.post(f"/sessions/{session_id}/end", json={"accuracy": 0.5})
        assert first.status_code == 200
        original_end = first.json()["data"]["ended_at"]

        second = await client.post(f"/sessions/{session_id}/end", json={"accuracy": 0.9})
        assert second.status_code == 409

        stored = (await client.get(f"/sessions/{session_id}")).json()["data"]
        assert stored["ended_at"] == original_end
        assert stored["accuracy"] == 0.5

    @pytest.mark.parametrize("accuracy", [-0.1, 1.5, 85])
    async def test_accuracy_outside_unit_interval_rejected(self, client, accuracy):
        """accuracy is documented as 0-1; other values are rejected."""
        session_id = (await client.post("/sessions/start", json={})).json()["data"]["id"]
        response = await client.post(
            f"/sessions/{session_id}/end", json={"accuracy": accuracy}
        )
        assert response.status_code == 422


class TestBpmValidation:
    """BPM values must fall inside the metronome's 20-300 range."""

    @pytest.mark.parametrize("bpm", [0, -120, 100000])
    async def test_scale_attempt_rejects_invalid_bpm(self, client, bpm):
        """An impossible tempo cannot be recorded (or count towards mastery)."""
        response = await client.post(
            "/scales/attempt",
            json={"scale_key": "C_major", "bpm": bpm, "correct": True},
        )
        assert response.status_code == 422

    @pytest.mark.parametrize("bpm", [0, 100000])
    async def test_session_start_rejects_invalid_bpm(self, client, bpm):
        """Sessions cannot be started at an impossible tempo."""
        response = await client.post("/sessions/start", json={"bpm": bpm})
        assert response.status_code == 422

    async def test_scale_attempt_rejects_empty_scale_key(self, client):
        """An empty scale_key would create an orphan mastery row."""
        response = await client.post(
            "/scales/attempt",
            json={"scale_key": "", "bpm": 120, "correct": True},
        )
        assert response.status_code == 422


class TestStreakTimezone:
    """Streaks and dates are computed in the user's timezone."""

    def test_streak_alive_when_last_practice_was_yesterday(self):
        """Practising yesterday keeps the current streak alive today."""
        assert _compute_streaks(["2026-10-04"], today=date(2026, 10, 5)) == (1, 1)

    def test_streak_broken_after_missed_day(self):
        """A full missed day resets the current streak but not the longest."""
        dates = ["2026-10-01", "2026-10-02", "2026-10-03"]
        assert _compute_streaks(dates, today=date(2026, 10, 5)) == (0, 3)

    @pytest.mark.parametrize("utc_offset_minutes", [-720, 840])
    async def test_dates_bucketed_in_client_timezone(self, client, utc_offset_minutes):
        """last_practice_date and current_streak use the client's local day.

        At any moment, at least one of UTC-12 or UTC+14 is on a different
        calendar day from UTC, so this asserts the offset is really applied.
        """
        await client.post("/sessions/start", json={})
        local_today = (
            datetime.now(timezone.utc) + timedelta(minutes=utc_offset_minutes)
        ).date()

        response = await client.get(
            f"/stats?utc_offset_minutes={utc_offset_minutes}"
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["last_practice_date"] == local_today.isoformat()
        assert data["current_streak"] == 1

    @pytest.mark.parametrize("utc_offset_minutes", [-841, 841])
    async def test_rejects_impossible_offsets(self, client, utc_offset_minutes):
        """Offsets beyond real-world timezones (UTC-14..UTC+14) are rejected."""
        response = await client.get(f"/stats?utc_offset_minutes={utc_offset_minutes}")
        assert response.status_code == 422
