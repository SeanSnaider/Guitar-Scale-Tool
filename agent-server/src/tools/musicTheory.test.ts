/**
 * Regression tests for POST /api/tools/music-theory.
 *
 * Exercised over HTTP (real Express app on an ephemeral port) so the tests
 * pin down the tool contract the Subconscious agent relies on: field names,
 * status codes, and correctly spelled note names, intervals and chord
 * qualities.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postJson, startTestServer } from "../test/httpHelpers.js";
import type { TestServer } from "../test/httpHelpers.js";

/** Subset of the scale_info response used by these tests. */
interface ScaleInfoResponse {
  name: string;
  key: string;
  notes: string[];
  intervals: string[];
  all_frets: Record<string, number[]>;
}

/** Subset of the chord_progression response used by these tests. */
interface ChordProgressionResponse {
  key: string;
  chords: { degree: string; chord: string; quality: string }[];
  common_progressions: { name: string; chords: string[] }[];
}

/** Subset of the chord_info response used by these tests. */
interface ChordInfoResponse {
  root: string;
  notes: string[];
  intervals: string[];
}

/** Subset of the intervals response used by these tests. */
interface IntervalsResponse {
  key: string;
  intervals: { semitones: number; shorthand: string; note: string }[];
}

let server: TestServer;

/**
 * Call the music theory tool and return status + parsed JSON.
 *
 * @param body - Tool request body.
 * @returns HTTP status and decoded JSON body.
 */
async function lookup<T>(body: Record<string, unknown>): Promise<{ status: number; data: T }> {
  const res = await postJson(`${server.baseUrl}/api/tools/music-theory`, body);
  return { status: res.status, data: (await res.json()) as T };
}

/**
 * Fetch scale_info and return the response body, asserting HTTP 200.
 *
 * @param key - Root key.
 * @param scale - Scale type.
 */
async function scaleInfo(key: string, scale: string): Promise<ScaleInfoResponse> {
  const { status, data } = await lookup<ScaleInfoResponse>({ query_type: "scale_info", key, scale });
  expect(status).toBe(200);
  return data;
}

/**
 * Fetch chord_progression and return the response body, asserting HTTP 200.
 *
 * @param key - Root key.
 * @param scale - Scale type.
 */
async function progression(key: string, scale: string): Promise<ChordProgressionResponse> {
  const { status, data } = await lookup<ChordProgressionResponse>({
    query_type: "chord_progression",
    key,
    scale,
  });
  expect(status).toBe(200);
  return data;
}

/**
 * Fetch chord_info and return the response body, asserting HTTP 200.
 *
 * @param chord - Chord symbol.
 */
async function chordInfo(chord: string): Promise<ChordInfoResponse> {
  const { status, data } = await lookup<ChordInfoResponse>({ query_type: "chord_info", chord });
  expect(status).toBe(200);
  return data;
}

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

describe("scale_info note spelling", () => {
  it.each([
    ["Bb", "major", ["Bb", "C", "D", "Eb", "F", "G", "A"]],
    ["F", "major", ["F", "G", "A", "Bb", "C", "D", "E"]],
    ["E", "major", ["E", "F#", "G#", "A", "B", "C#", "D#"]],
    ["F#", "major", ["F#", "G#", "A#", "B", "C#", "D#", "E#"]],
    ["A", "minor_pentatonic", ["A", "C", "D", "E", "G"]],
    ["C", "blues", ["C", "Eb", "F", "Gb", "G", "Bb"]],
    ["D", "dorian", ["D", "E", "F", "G", "A", "B", "C"]],
    ["Eb", "natural_minor", ["Eb", "F", "Gb", "Ab", "Bb", "Cb", "Db"]],
  ])("spells %s %s with one note per letter", async (key, scale, expected) => {
    expect((await scaleInfo(key, scale)).notes).toEqual(expected);
  });

  it("still maps fretboard positions by pitch class for flat keys", async () => {
    const data = await scaleInfo("Bb", "major");
    expect(data.all_frets.E_low).toEqual([1, 3, 5, 6, 8, 10, 11]);
  });

  it("rejects an unknown scale with 400", async () => {
    const { status } = await lookup({ query_type: "scale_info", key: "C", scale: "klingon" });
    expect(status).toBe(400);
  });
});

describe("scale_info intervals", () => {
  it("reports #4 for lydian", async () => {
    expect((await scaleInfo("F", "lydian")).intervals).toEqual(["1", "2", "3", "#4", "5", "6", "7"]);
  });

  it("reports #4 and #5 for whole tone", async () => {
    expect((await scaleInfo("C", "whole_tone")).intervals).toEqual(["1", "2", "3", "#4", "#5", "b7"]);
  });
});

describe("key parsing", () => {
  it.each([
    ["a", "A"],
    ["bb", "Bb"],
    ["f#", "F#"],
    ["B♭", "Bb"],
    ["C♯", "C#"],
  ])("accepts key %s and displays it as %s", async (raw, display) => {
    const data = await scaleInfo(raw, "major");
    expect(data.key).toBe(display);
    expect(data.notes[0]).toBe(display);
  });

  it("rejects a key that is not a note name with 400", async () => {
    const { status } = await lookup({ query_type: "scale_info", key: "H", scale: "major" });
    expect(status).toBe(400);
  });
});

describe("chord_progression qualities", () => {
  it("computes D dorian triads from the mode itself", async () => {
    const data = await progression("D", "dorian");
    expect(data.chords.map((c) => c.degree)).toEqual(["i", "ii", "III", "IV", "v", "vi°", "VII"]);
    expect(data.chords.map((c) => c.chord)).toEqual(["Dm", "Em", "F", "G", "Am", "Bdim", "C"]);
  });

  it("computes A harmonic minor triads including the augmented III and major V", async () => {
    const data = await progression("A", "harmonic_minor");
    expect(data.chords.map((c) => c.degree)).toEqual(["i", "ii°", "III+", "iv", "V", "VI", "vii°"]);
    expect(data.chords.map((c) => c.chord)).toEqual(["Am", "Bdim", "Caug", "Dm", "E", "F", "G#dim"]);
    expect(data.chords[2].quality).toBe("aug");
  });

  it("gives C mixolydian a minor v and a major bVII", async () => {
    const data = await progression("C", "mixolydian");
    expect(data.chords.map((c) => c.chord)).toEqual(["C", "Dm", "Edim", "F", "Gm", "Am", "Bb"]);
  });

  it("gives F lydian a major II and diminished #iv", async () => {
    const data = await progression("F", "lydian");
    expect(data.chords.map((c) => c.chord)).toEqual(["F", "G", "Am", "Bdim", "C", "Dm", "Em"]);
  });

  it("gives C phrygian a major bII", async () => {
    const data = await progression("C", "phrygian");
    expect(data.chords.map((c) => c.chord)).toEqual(["Cm", "Db", "Eb", "Fm", "Gdim", "Ab", "Bbm"]);
  });

  it("gives A melodic minor a major IV and V", async () => {
    const data = await progression("A", "melodic_minor");
    expect(data.chords.map((c) => c.chord)).toEqual(["Am", "Bm", "Caug", "D", "E", "F#dim", "G#dim"]);
  });

  it("keeps the familiar C major result and progression names", async () => {
    const data = await progression("C", "major");
    expect(data.chords.map((c) => c.chord)).toEqual(["C", "Dm", "Em", "F", "G", "Am", "Bdim"]);
    expect(data.common_progressions).toEqual([
      { name: "I–IV–V–I", chords: ["C", "F", "G", "C"] },
      { name: "I–V–vi–IV", chords: ["C", "G", "Am", "F"] },
      { name: "ii–V–I", chords: ["Dm", "G", "C"] },
    ]);
  });

  it("names progressions from the actual numerals in a minor key", async () => {
    const data = await progression("A", "natural_minor");
    expect(data.common_progressions[0]).toEqual({
      name: "i–iv–v–i",
      chords: ["Am", "Dm", "Em", "Am"],
    });
  });

  it("maps minor pentatonic to its natural minor parent", async () => {
    const data = await progression("A", "minor_pentatonic");
    expect(data.chords.map((c) => c.chord)).toEqual(["Am", "Bdim", "C", "Dm", "Em", "F", "G"]);
  });

  it("maps major pentatonic to its major parent", async () => {
    const data = await progression("G", "major_pentatonic");
    expect(data.chords.map((c) => c.chord)).toEqual(["G", "Am", "Bm", "C", "D", "Em", "F#dim"]);
  });

  it.each(["whole_tone", "diminished"])("rejects %s with a clear 400 error", async (scale) => {
    const { status, data } = await lookup<{ error: string }>({
      query_type: "chord_progression",
      key: "C",
      scale,
    });
    expect(status).toBe(400);
    expect(data.error).toMatch(/seven-note scale/);
  });

  it("rejects an unknown scale instead of silently using major", async () => {
    const { status } = await lookup({ query_type: "chord_progression", key: "C", scale: "klingon" });
    expect(status).toBe(400);
  });
});

describe("chord_info", () => {
  it("spells E# major with letter-correct tones", async () => {
    expect((await chordInfo("E#")).notes).toEqual(["E#", "G##", "B#"]);
  });

  it("spells B#m without undefined tones", async () => {
    expect((await chordInfo("B#m")).notes).toEqual(["B#", "D#", "F##"]);
  });

  it("spells Bbm7 with flats", async () => {
    const data = await chordInfo("Bbm7");
    expect(data.notes).toEqual(["Bb", "Db", "F", "Ab"]);
    expect(data.intervals).toEqual(["1", "b3", "5", "b7"]);
  });

  it("supports m7b5 chords", async () => {
    expect((await chordInfo("Bm7b5")).notes).toEqual(["B", "D", "F", "A"]);
  });

  it("supports dim7 chords with a double-flat seventh", async () => {
    const data = await chordInfo("Bdim7");
    expect(data.notes).toEqual(["B", "D", "F", "Ab"]);
    expect(data.intervals).toEqual(["1", "b3", "b5", "bb7"]);
  });

  it("accepts a lowercase root", async () => {
    expect((await chordInfo("am7")).notes).toEqual(["A", "C", "E", "G"]);
  });

  it("rejects an unknown root with 400", async () => {
    const { status } = await lookup({ query_type: "chord_info", chord: "H7" });
    expect(status).toBe(400);
  });
});

describe("intervals", () => {
  it("spells the chromatic intervals from C with interval-appropriate letters", async () => {
    const { status, data } = await lookup<IntervalsResponse>({ query_type: "intervals", key: "C" });
    expect(status).toBe(200);
    expect(data.intervals).toHaveLength(12);
    expect(data.intervals.map((i) => i.note)).toEqual([
      "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
    ]);
  });

  it("spells the minor 3rd above Bb as Db", async () => {
    const { data } = await lookup<IntervalsResponse>({ query_type: "intervals", key: "bb" });
    expect(data.key).toBe("Bb");
    expect(data.intervals[3]).toMatchObject({ semitones: 3, shorthand: "b3", note: "Db" });
  });
});
