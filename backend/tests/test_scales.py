"""Tests for the /scales endpoints.

Covers scale mastery business logic (consecutive-correct tracking, the
learned threshold, stickiness of is_learned) as well as the mastery
query endpoints.
"""
import pytest


class TestRecordAttempt:
    """POST /scales/attempt records a scale practice attempt and updates mastery."""

    async def test_first_correct_attempt(self, client):
        """A single correct attempt sets consecutive_correct=1, is_learned=False."""
        response = await client.post(
            "/scales/attempt",
            json={"scale_key": "C_major", "bpm": 120, "correct": True},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        mastery = body["data"]["mastery"]
        assert mastery["consecutive_correct"] == 1
        assert mastery["is_learned"] is False
        assert mastery["total_attempts"] == 1
        assert body["data"]["just_learned"] is False

    async def test_first_incorrect_attempt(self, client):
        """A single incorrect attempt sets consecutive_correct=0."""
        response = await client.post(
            "/scales/attempt",
            json={"scale_key": "C_major", "bpm": 120, "correct": False},
        )
        assert response.status_code == 200
        mastery = response.json()["data"]["mastery"]
        assert mastery["consecutive_correct"] == 0
        assert mastery["is_learned"] is False

    async def test_three_consecutive_correct_at_120bpm_marks_learned(self, client):
        """Three consecutive correct attempts at exactly 120 BPM sets is_learned=True."""
        for i in range(2):
            resp = await client.post(
                "/scales/attempt",
                json={"scale_key": "A_minor", "bpm": 120, "correct": True},
            )
            assert resp.json()["data"]["just_learned"] is False

        # Third attempt should flip is_learned
        resp = await client.post(
            "/scales/attempt",
            json={"scale_key": "A_minor", "bpm": 120, "correct": True},
        )
        assert resp.status_code == 200
        result = resp.json()["data"]
        assert result["mastery"]["is_learned"] is True
        assert result["mastery"]["learned_at"] is not None
        assert result["just_learned"] is True

    async def test_three_consecutive_correct_above_120bpm_marks_learned(self, client):
        """Three consecutive correct attempts above 120 BPM also triggers learned."""
        for _ in range(3):
            resp = await client.post(
                "/scales/attempt",
                json={"scale_key": "G_major", "bpm": 160, "correct": True},
            )
        assert resp.json()["data"]["mastery"]["is_learned"] is True

    async def test_three_correct_below_120bpm_not_learned(self, client):
        """Three consecutive correct attempts below 120 BPM does NOT set is_learned."""
        for _ in range(3):
            resp = await client.post(
                "/scales/attempt",
                json={"scale_key": "D_major", "bpm": 100, "correct": True},
            )
        assert resp.status_code == 200
        result = resp.json()["data"]
        assert result["mastery"]["is_learned"] is False
        assert result["just_learned"] is False

    async def test_incorrect_resets_consecutive(self, client):
        """Two correct then one incorrect resets consecutive_correct to 0."""
        for correct in (True, True, False):
            resp = await client.post(
                "/scales/attempt",
                json={"scale_key": "E_minor", "bpm": 120, "correct": correct},
            )
        assert resp.status_code == 200
        mastery = resp.json()["data"]["mastery"]
        assert mastery["consecutive_correct"] == 0
        assert mastery["total_attempts"] == 3

    async def test_already_learned_stays_learned_after_incorrect(self, client):
        """Once a scale is learned, sending an incorrect attempt does not revert is_learned."""
        # Learn the scale first
        for _ in range(3):
            await client.post(
                "/scales/attempt",
                json={"scale_key": "B_minor", "bpm": 120, "correct": True},
            )

        # Now send an incorrect attempt
        resp = await client.post(
            "/scales/attempt",
            json={"scale_key": "B_minor", "bpm": 120, "correct": False},
        )
        assert resp.status_code == 200
        mastery = resp.json()["data"]["mastery"]
        assert mastery["is_learned"] is True  # sticky

    async def test_just_learned_is_false_on_subsequent_correct(self, client):
        """After the scale is learned, further correct attempts return just_learned=False."""
        for _ in range(3):
            await client.post(
                "/scales/attempt",
                json={"scale_key": "F_major", "bpm": 120, "correct": True},
            )

        # Fourth attempt
        resp = await client.post(
            "/scales/attempt",
            json={"scale_key": "F_major", "bpm": 120, "correct": True},
        )
        assert resp.json()["data"]["just_learned"] is False

    async def test_attempt_stores_history(self, client):
        """Each attempt is appended to the attempts array."""
        for _ in range(2):
            await client.post(
                "/scales/attempt",
                json={"scale_key": "C_major", "bpm": 120, "correct": True},
            )
        resp = await client.post(
            "/scales/attempt",
            json={"scale_key": "C_major", "bpm": 120, "correct": False},
        )
        mastery = resp.json()["data"]["mastery"]
        assert mastery["total_attempts"] == 3
        assert len(mastery["attempts"]) == 3


class TestMasteryQueries:
    """GET endpoints for querying scale mastery records."""

    async def test_get_all_mastery_empty(self, client):
        """GET /scales/mastery returns an empty list when no attempts have been made."""
        response = await client.get("/scales/mastery")
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["data"] == []

    async def test_get_all_mastery(self, client):
        """GET /scales/mastery returns all mastery documents."""
        await client.post(
            "/scales/attempt",
            json={"scale_key": "C_major", "bpm": 120, "correct": True},
        )
        await client.post(
            "/scales/attempt",
            json={"scale_key": "G_major", "bpm": 120, "correct": True},
        )

        response = await client.get("/scales/mastery")
        assert response.status_code == 200
        data = response.json()["data"]
        scale_keys = {item["scale_key"] for item in data}
        assert "C_major" in scale_keys
        assert "G_major" in scale_keys

    async def test_get_single_mastery(self, client):
        """GET /scales/mastery/{key} returns the mastery document for that scale."""
        await client.post(
            "/scales/attempt",
            json={"scale_key": "A_major", "bpm": 120, "correct": True},
        )

        response = await client.get("/scales/mastery/A_major")
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["scale_key"] == "A_major"
        assert data["total_attempts"] == 1

    async def test_get_single_mastery_not_found(self, client):
        """GET /scales/mastery/{key} returns 404 for an unknown scale key."""
        response = await client.get("/scales/mastery/nonexistent_scale")
        assert response.status_code == 404

    async def test_get_learned_scales(self, client):
        """GET /scales/learned returns only scales where is_learned=True."""
        # Learn C_major
        for _ in range(3):
            await client.post(
                "/scales/attempt",
                json={"scale_key": "C_major", "bpm": 120, "correct": True},
            )
        # Only 1 attempt on G_major (not learned)
        await client.post(
            "/scales/attempt",
            json={"scale_key": "G_major", "bpm": 120, "correct": True},
        )

        response = await client.get("/scales/learned")
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 1
        assert data[0]["scale_key"] == "C_major"
        assert data[0]["is_learned"] is True

    async def test_get_learned_scales_empty(self, client):
        """GET /scales/learned returns empty list when no scales are learned."""
        response = await client.get("/scales/learned")
        assert response.status_code == 200
        assert response.json()["data"] == []
