"""Tests for the /chords endpoints.

Covers recording individual chord detections, listing them in order,
and the aggregated statistics endpoint.
"""
import pytest


class TestRecordChord:
    """POST /chords records a single chord detection event."""

    async def test_record_chord(self, client):
        """A valid chord detection is stored and returned with detected_at set."""
        response = await client.post(
            "/chords",
            json={
                "chord": "Am7",
                "confidence": 0.92,
                "root": "A",
                "quality": "minor7",
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        data = body["data"]
        assert data["id"] is not None
        assert data["chord"] == "Am7"
        assert data["confidence"] == 0.92
        assert data["root"] == "A"
        assert data["quality"] == "minor7"
        assert data["detected_at"] is not None
        assert data["practice_session_id"] is None

    async def test_record_chord_with_session(self, client):
        """A chord can be linked to a practice session ID."""
        response = await client.post(
            "/chords",
            json={
                "chord": "C",
                "confidence": 0.75,
                "root": "C",
                "quality": "major",
                "practice_session_id": "abc123",
            },
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["practice_session_id"] == "abc123"

    async def test_record_chord_invalid_confidence_too_high(self, client):
        """Confidence above 1.0 is rejected with a 422 validation error."""
        response = await client.post(
            "/chords",
            json={
                "chord": "G",
                "confidence": 1.5,
                "root": "G",
                "quality": "major",
            },
        )
        assert response.status_code == 422

    async def test_record_chord_invalid_confidence_negative(self, client):
        """Negative confidence is rejected with a 422 validation error."""
        response = await client.post(
            "/chords",
            json={
                "chord": "G",
                "confidence": -0.1,
                "root": "G",
                "quality": "major",
            },
        )
        assert response.status_code == 422

    async def test_record_chord_missing_required_fields(self, client):
        """Omitting required fields (chord, root, quality) returns 422."""
        response = await client.post(
            "/chords",
            json={"confidence": 0.8},
        )
        assert response.status_code == 422


class TestListChords:
    """GET /chords returns a paginated list of chord detection records."""

    async def test_list_chords_empty(self, client):
        """When no chords have been recorded the list is empty."""
        response = await client.get("/chords")
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["data"] == []
        assert body["meta"]["total"] == 0

    async def test_list_chords_newest_first(self, client):
        """Chords are returned newest first."""
        await client.post(
            "/chords",
            json={"chord": "C", "confidence": 0.8, "root": "C", "quality": "major"},
        )
        await client.post(
            "/chords",
            json={"chord": "Am", "confidence": 0.9, "root": "A", "quality": "minor"},
        )

        response = await client.get("/chords")
        assert response.status_code == 200
        chords = response.json()["data"]
        assert len(chords) == 2
        assert chords[0]["chord"] == "Am"
        assert chords[1]["chord"] == "C"

    async def test_list_chords_pagination_meta(self, client):
        """Pagination meta is correctly populated."""
        for i in range(5):
            await client.post(
                "/chords",
                json={
                    "chord": f"chord_{i}",
                    "confidence": 0.8,
                    "root": "C",
                    "quality": "major",
                },
            )

        response = await client.get("/chords?page=1&limit=3")
        assert response.status_code == 200
        meta = response.json()["meta"]
        assert meta["total"] == 5
        assert meta["page"] == 1
        assert meta["limit"] == 3


class TestChordStats:
    """GET /chords/stats returns aggregated chord detection statistics."""

    async def test_chord_stats_empty(self, client):
        """When no chords have been recorded the totals are zero."""
        response = await client.get("/chords/stats")
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        data = body["data"]
        assert data["total_detections"] == 0
        assert data["most_common"] == []
        assert data["detection_by_quality"] == []

    async def test_chord_stats_most_common(self, client):
        """The most-common list ranks chords by detection count descending."""
        # Record Am7 three times and C once
        for _ in range(3):
            await client.post(
                "/chords",
                json={
                    "chord": "Am7",
                    "confidence": 0.9,
                    "root": "A",
                    "quality": "minor7",
                },
            )
        await client.post(
            "/chords",
            json={"chord": "C", "confidence": 0.8, "root": "C", "quality": "major"},
        )

        response = await client.get("/chords/stats")
        assert response.status_code == 200
        most_common = response.json()["data"]["most_common"]
        assert most_common[0]["chord"] == "Am7"
        assert most_common[0]["count"] == 3
        assert most_common[1]["chord"] == "C"
        assert most_common[1]["count"] == 1

    async def test_chord_stats_total_detections(self, client):
        """total_detections equals the number of recorded chord events."""
        for _ in range(4):
            await client.post(
                "/chords",
                json={
                    "chord": "G",
                    "confidence": 0.7,
                    "root": "G",
                    "quality": "major",
                },
            )

        response = await client.get("/chords/stats")
        assert response.json()["data"]["total_detections"] == 4

    async def test_chord_stats_by_quality(self, client):
        """detection_by_quality groups results by chord quality with avg confidence."""
        await client.post(
            "/chords",
            json={
                "chord": "Am",
                "confidence": 0.8,
                "root": "A",
                "quality": "minor",
            },
        )
        await client.post(
            "/chords",
            json={
                "chord": "Em",
                "confidence": 0.6,
                "root": "E",
                "quality": "minor",
            },
        )
        await client.post(
            "/chords",
            json={"chord": "C", "confidence": 0.9, "root": "C", "quality": "major"},
        )

        response = await client.get("/chords/stats")
        assert response.status_code == 200
        by_quality = response.json()["data"]["detection_by_quality"]
        quality_map = {item["quality"]: item for item in by_quality}

        assert "minor" in quality_map
        assert quality_map["minor"]["count"] == 2
        assert abs(quality_map["minor"]["avg_confidence"] - 0.7) < 0.01

        assert "major" in quality_map
        assert quality_map["major"]["count"] == 1
        assert abs(quality_map["major"]["avg_confidence"] - 0.9) < 0.01


class TestChordValidation:
    """Pagination and string-length bounds on /chords."""

    async def test_pagination_bounds(self, client):
        for query in ("page=0", "limit=0", "limit=101"):
            assert (await client.get(f"/chords?{query}")).status_code == 422, query

    async def test_string_lengths(self, client):
        base = {"chord": "C", "confidence": 0.5, "root": "C", "quality": "major"}
        for field in ("chord", "root", "quality"):
            for bad in ("", "x" * 65):
                response = await client.post("/chords", json={**base, field: bad})
                assert response.status_code == 422, (field, len(bad))

    async def test_detected_at_is_utc(self, client):
        await client.post(
            "/chords",
            json={"chord": "C", "confidence": 0.5, "root": "C", "quality": "major"},
        )
        row = (await client.get("/chords")).json()["data"][0]
        assert row["detected_at"].endswith(("Z", "+00:00"))
