"""Per-browser data isolation tests.

The frontend sends a persistent per-browser UUID in the ``X-Session-ID``
header.  Every read and write must be scoped to that value so two browsers
sharing one backend never see (or modify) each other's sessions, mastery,
chord history or stats.

Each test uses two clients from the ``client_factory`` fixture.  Both talk
to the same in-memory database, so any leak between them is a real
cross-browser leak rather than an artefact of separate databases.
"""
from collections.abc import Callable

import pytest_asyncio
from httpx import AsyncClient

BROWSER_A_ID = "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
BROWSER_B_ID = "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

# Attempts at this tempo count towards the learned threshold.
_LEARNING_BPM = 120

# Correct attempts in a row needed to learn a scale.
_ATTEMPTS_TO_LEARN = 3


@pytest_asyncio.fixture
async def browser_a(client_factory: Callable[[str], AsyncClient]) -> AsyncClient:
    """Return a client acting as the first browser.

    Args:
        client_factory: Factory fixture that builds per-browser clients.

    Returns:
        A client sending ``BROWSER_A_ID`` as its ``X-Session-ID``.
    """
    return client_factory(BROWSER_A_ID)


@pytest_asyncio.fixture
async def browser_b(client_factory: Callable[[str], AsyncClient]) -> AsyncClient:
    """Return a client acting as a second, unrelated browser.

    Args:
        client_factory: Factory fixture that builds per-browser clients.

    Returns:
        A client sending ``BROWSER_B_ID`` as its ``X-Session-ID``.
    """
    return client_factory(BROWSER_B_ID)


async def _record_attempt(
    browser: AsyncClient, scale_key: str, correct: bool = True
) -> dict:
    """Post one scale attempt at the learning tempo and return its payload.

    Args:
        browser: Client to send the attempt from.
        scale_key: Scale the attempt is for.
        correct: Whether the attempt was correct.

    Returns:
        The ``data`` object of the attempt response.
    """
    response = await browser.post(
        "/scales/attempt",
        json={"scale_key": scale_key, "bpm": _LEARNING_BPM, "correct": correct},
    )
    assert response.status_code == 200, response.text
    return response.json()["data"]


async def _learn_scale(browser: AsyncClient, scale_key: str) -> None:
    """Record enough correct attempts for ``browser`` to learn ``scale_key``.

    Args:
        browser: Client to send the attempts from.
        scale_key: Scale to learn.
    """
    for _ in range(_ATTEMPTS_TO_LEARN):
        await _record_attempt(browser, scale_key)


async def _record_chord(browser: AsyncClient, chord: str, quality: str) -> None:
    """Post one chord detection from ``browser``.

    Args:
        browser: Client to send the detection from.
        chord: Chord name; also used as the root for simplicity.
        quality: Chord quality string.
    """
    response = await browser.post(
        "/chords",
        json={"chord": chord, "confidence": 0.9, "root": chord, "quality": quality},
    )
    assert response.status_code == 200, response.text


async def _start_session(browser: AsyncClient) -> str:
    """Start a practice session from ``browser`` and return its id.

    Args:
        browser: Client to start the session from.

    Returns:
        The new session's ``id`` field.
    """
    response = await browser.post("/sessions/start", json={})
    assert response.status_code == 200, response.text
    return response.json()["data"]["id"]


class TestSessionIsolation:
    """Practice sessions are visible only to the browser that started them."""

    async def test_list_sessions_returns_only_own_sessions(self, browser_a, browser_b):
        """Each browser's list and total count only its own sessions."""
        await _start_session(browser_a)
        await _start_session(browser_a)
        await _start_session(browser_b)

        body_a = (await browser_a.get("/sessions")).json()
        body_b = (await browser_b.get("/sessions")).json()

        assert body_a["meta"]["total"] == 2
        assert {s["session_id"] for s in body_a["data"]} == {BROWSER_A_ID}
        assert body_b["meta"]["total"] == 1
        assert {s["session_id"] for s in body_b["data"]} == {BROWSER_B_ID}

    async def test_get_other_browsers_session_returns_404(self, browser_a, browser_b):
        """Fetching another browser's session looks exactly like a missing one."""
        session_id = await _start_session(browser_a)

        response = await browser_b.get(f"/sessions/{session_id}")

        assert response.status_code == 404
        assert response.json()["detail"] == "Session not found"

    async def test_end_other_browsers_session_returns_404_and_leaves_it_open(
        self, browser_a, browser_b
    ):
        """Another browser cannot end a session; the owner still sees it active."""
        session_id = await _start_session(browser_a)

        response = await browser_b.post(
            f"/sessions/{session_id}/end", json={"accuracy": 0.1}
        )

        assert response.status_code == 404
        owned = (await browser_a.get(f"/sessions/{session_id}")).json()["data"]
        assert owned["ended_at"] is None
        assert owned["accuracy"] is None

    async def test_owner_can_still_get_and_end_own_session(self, browser_a, browser_b):
        """Scoping does not stop the owning browser from managing its session."""
        session_id = await _start_session(browser_a)
        await _start_session(browser_b)

        ended = await browser_a.post(f"/sessions/{session_id}/end", json={})

        assert ended.status_code == 200
        assert ended.json()["data"]["ended_at"] is not None


class TestScaleMasteryIsolation:
    """Scale mastery is tracked per (browser, scale_key)."""

    async def test_both_browsers_can_record_the_same_scale_key(
        self, browser_a, browser_b
    ):
        """Two browsers each get their own C_major row instead of sharing one."""
        first = await _record_attempt(browser_a, "C_major")
        second = await _record_attempt(browser_b, "C_major")

        assert first["mastery"]["total_attempts"] == 1
        assert second["mastery"]["total_attempts"] == 1
        assert second["mastery"]["id"] != first["mastery"]["id"]
        assert len(second["mastery"]["attempts"]) == 1

    async def test_streak_progress_is_not_shared_between_browsers(
        self, browser_a, browser_b
    ):
        """Another browser's correct attempts cannot complete my learning streak."""
        await _record_attempt(browser_a, "C_major")
        await _record_attempt(browser_a, "C_major")

        result = await _record_attempt(browser_b, "C_major")

        assert result["mastery"]["consecutive_correct"] == 1
        assert result["mastery"]["is_learned"] is False
        assert result["just_learned"] is False

    async def test_mastery_list_returns_only_own_rows(self, browser_a, browser_b):
        """GET /scales/mastery lists only the caller's scales."""
        await _record_attempt(browser_a, "C_major")
        await _record_attempt(browser_a, "G_major")
        await _record_attempt(browser_b, "D_minor")

        mastery_a = (await browser_a.get("/scales/mastery")).json()["data"]
        mastery_b = (await browser_b.get("/scales/mastery")).json()["data"]

        assert {m["scale_key"] for m in mastery_a} == {"C_major", "G_major"}
        assert {m["scale_key"] for m in mastery_b} == {"D_minor"}

    async def test_mastery_by_key_for_other_browsers_scale_returns_404(
        self, browser_a, browser_b
    ):
        """A scale only another browser has practised is 'not found' for me."""
        await _record_attempt(browser_a, "A_major")

        response = await browser_b.get("/scales/mastery/A_major")

        assert response.status_code == 404

    async def test_mastery_attempt_history_excludes_other_browsers(
        self, browser_a, browser_b
    ):
        """The attempts array only contains the caller's own attempts."""
        await _record_attempt(browser_a, "C_major")
        await _record_attempt(browser_a, "C_major", correct=False)
        await _record_attempt(browser_b, "C_major")

        own = (await browser_a.get("/scales/mastery/C_major")).json()["data"]
        other = (await browser_b.get("/scales/mastery/C_major")).json()["data"]

        assert own["total_attempts"] == 2
        assert len(own["attempts"]) == 2
        assert other["total_attempts"] == 1
        assert len(other["attempts"]) == 1

    async def test_learned_returns_only_own_learned_scales(self, browser_a, browser_b):
        """A scale learned in one browser is not learned in another."""
        await _learn_scale(browser_a, "C_major")
        await _record_attempt(browser_b, "C_major")

        learned_a = (await browser_a.get("/scales/learned")).json()["data"]
        learned_b = (await browser_b.get("/scales/learned")).json()["data"]

        assert [m["scale_key"] for m in learned_a] == ["C_major"]
        assert learned_b == []


class TestChordIsolation:
    """Chord detection history and stats are per browser."""

    async def test_chord_list_returns_only_own_detections(self, browser_a, browser_b):
        """GET /chords lists and counts only the caller's detections."""
        await _record_chord(browser_a, "Am", "minor")
        await _record_chord(browser_a, "C", "major")
        await _record_chord(browser_b, "G", "major")

        body_a = (await browser_a.get("/chords")).json()
        body_b = (await browser_b.get("/chords")).json()

        assert body_a["meta"]["total"] == 2
        assert {c["chord"] for c in body_a["data"]} == {"Am", "C"}
        assert body_b["meta"]["total"] == 1
        assert [c["chord"] for c in body_b["data"]] == ["G"]

    async def test_chord_stats_count_only_own_detections(self, browser_a, browser_b):
        """GET /chords/stats aggregates only the caller's detections."""
        for _ in range(3):
            await _record_chord(browser_a, "Am", "minor")
        await _record_chord(browser_b, "G", "major")

        stats_b = (await browser_b.get("/chords/stats")).json()["data"]

        assert stats_b["total_detections"] == 1
        assert stats_b["most_common"] == [{"chord": "G", "count": 1}]
        assert [q["quality"] for q in stats_b["detection_by_quality"]] == ["major"]

    async def test_chord_stats_empty_for_browser_with_no_detections(
        self, browser_a, browser_b
    ):
        """A browser that detected nothing sees empty stats, not someone else's."""
        await _record_chord(browser_a, "Am", "minor")

        stats_b = (await browser_b.get("/chords/stats")).json()["data"]

        assert stats_b["total_detections"] == 0
        assert stats_b["most_common"] == []


class TestStatsIsolation:
    """GET /stats aggregates only the caller's sessions and mastery."""

    async def test_stats_count_only_own_learned_scales(self, browser_a, browser_b):
        """XP, level and achievements come from the caller's learned scales only."""
        await _learn_scale(browser_a, "C_major")
        await _learn_scale(browser_a, "G_major")

        stats_a = (await browser_a.get("/stats")).json()["data"]
        stats_b = (await browser_b.get("/stats")).json()["data"]

        assert stats_a["total_scales_learned"] == 2
        assert stats_a["xp"] == 20
        assert stats_b["total_scales_learned"] == 0
        assert stats_b["xp"] == 0
        assert stats_b["achievements"] == []

    async def test_stats_ignore_other_browsers_sessions(self, browser_a, browser_b):
        """Streaks, dates and practice time ignore other browsers' sessions."""
        session_id = await _start_session(browser_a)
        await browser_a.post(f"/sessions/{session_id}/end", json={})

        stats_a = (await browser_a.get("/stats")).json()["data"]
        stats_b = (await browser_b.get("/stats")).json()["data"]

        assert stats_a["last_practice_date"] is not None
        assert stats_a["current_streak"] == 1
        assert stats_b["last_practice_date"] is None
        assert stats_b["current_streak"] == 0
        assert stats_b["longest_streak"] == 0
        assert stats_b["total_practice_minutes"] == 0.0


class TestSessionHeaderValidation:
    """The X-Session-ID value must be usable as a data-scoping key."""

    async def test_empty_session_id_header_is_rejected(self, client_factory):
        """An empty header would put every such client in one shared bucket."""
        anonymous = client_factory("")

        response = await anonymous.get("/sessions")

        assert response.status_code == 422

    async def test_missing_session_id_header_is_rejected(self, client):
        """Requests without the header at all are still rejected."""
        del client.headers["X-Session-ID"]

        response = await client.get("/sessions")

        assert response.status_code == 422
