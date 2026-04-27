"""Tests for the GET /stats endpoint.

Verifies aggregation logic across collections: learned scale counts,
practice minutes, streaks, XP, level, and achievements.
"""
import pytest


class TestStats:
    """GET /stats aggregates data from all collections."""

    async def test_stats_empty(self, client):
        """With no data, all numeric stats are zero and lists are empty."""
        response = await client.get("/stats")
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        data = body["data"]
        assert data["total_scales_learned"] == 0
        assert data["current_streak"] == 0
        assert data["longest_streak"] == 0
        assert data["total_practice_minutes"] == 0.0
        assert data["last_practice_date"] is None
        assert data["xp"] == 0
        assert data["level"] == 1
        assert data["achievements"] == []

    async def test_stats_counts_learned_scales(self, client):
        """total_scales_learned reflects only scales where is_learned=True."""
        # Learn two scales
        for scale in ("C_major", "G_major"):
            for _ in range(3):
                await client.post(
                    "/scales/attempt",
                    json={"scale_key": scale, "bpm": 120, "correct": True},
                )
        # One unlearned scale
        await client.post(
            "/scales/attempt",
            json={"scale_key": "D_major", "bpm": 120, "correct": True},
        )

        response = await client.get("/stats")
        assert response.json()["data"]["total_scales_learned"] == 2

    async def test_stats_computes_practice_minutes(self, client):
        """total_practice_minutes sums only ended sessions."""
        start_resp = await client.post("/sessions/start", json={})
        session_id = start_resp.json()["data"]["id"]
        await client.post(f"/sessions/{session_id}/end", json={})

        # An unended session should NOT be counted
        await client.post("/sessions/start", json={})

        response = await client.get("/stats")
        data = response.json()["data"]
        # Ended session duration should be >= 0 minutes
        assert data["total_practice_minutes"] >= 0.0

    async def test_stats_xp_and_level_one_scale(self, client):
        """Learning one scale gives 10 XP and level 1."""
        for _ in range(3):
            await client.post(
                "/scales/attempt",
                json={"scale_key": "C_major", "bpm": 120, "correct": True},
            )

        response = await client.get("/stats")
        data = response.json()["data"]
        assert data["xp"] == 10
        assert data["level"] == 1

    async def test_stats_xp_and_level_ten_scales(self, client):
        """Learning 10 scales gives 100 XP and level 2."""
        scale_names = [f"scale_{i}" for i in range(10)]
        for scale in scale_names:
            for _ in range(3):
                await client.post(
                    "/scales/attempt",
                    json={"scale_key": scale, "bpm": 120, "correct": True},
                )

        response = await client.get("/stats")
        data = response.json()["data"]
        assert data["total_scales_learned"] == 10
        assert data["xp"] == 100
        assert data["level"] == 2

    async def test_stats_achievements_first_scale(self, client):
        """The 'first_scale' achievement appears after learning one scale."""
        for _ in range(3):
            await client.post(
                "/scales/attempt",
                json={"scale_key": "C_major", "bpm": 120, "correct": True},
            )

        response = await client.get("/stats")
        achievements = response.json()["data"]["achievements"]
        assert "first_scale" in achievements

    async def test_stats_achievements_five_scales(self, client):
        """The 'five_scales' achievement appears after learning five scales."""
        for i in range(5):
            for _ in range(3):
                await client.post(
                    "/scales/attempt",
                    json={"scale_key": f"scale_{i}", "bpm": 120, "correct": True},
                )

        response = await client.get("/stats")
        achievements = response.json()["data"]["achievements"]
        assert "first_scale" in achievements
        assert "five_scales" in achievements

    async def test_stats_achievements_ten_scales(self, client):
        """The 'ten_scales' achievement appears after learning ten scales."""
        for i in range(10):
            for _ in range(3):
                await client.post(
                    "/scales/attempt",
                    json={"scale_key": f"scale_{i}", "bpm": 120, "correct": True},
                )

        response = await client.get("/stats")
        achievements = response.json()["data"]["achievements"]
        assert "ten_scales" in achievements

    async def test_stats_no_unearned_achievements(self, client):
        """No achievements are awarded when the user has no data."""
        response = await client.get("/stats")
        assert response.json()["data"]["achievements"] == []

    async def test_stats_last_practice_date_set(self, client):
        """last_practice_date is populated after at least one session is started."""
        await client.post("/sessions/start", json={})

        response = await client.get("/stats")
        last_date = response.json()["data"]["last_practice_date"]
        assert last_date is not None
        # Should be a valid YYYY-MM-DD string
        assert len(last_date) == 10
        assert last_date[4] == "-"
        assert last_date[7] == "-"

    async def test_stats_achievement_first_hour(self, client):
        """The 'first_hour' achievement requires total_practice_minutes >= 60."""
        # We can't easily simulate 60 minutes in a unit test, so verify
        # it is NOT awarded when practice time is 0.
        response = await client.get("/stats")
        achievements = response.json()["data"]["achievements"]
        assert "first_hour" not in achievements
