import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@/lib/db", () => {
  type Row = Record<string, unknown> & { id: string };
  const makeTable = () => {
    const rows = new Map<string, Row>();
    return {
      rows,
      add: async (row: Row) => {
        rows.set(row.id, { ...row });
        return row.id;
      },
      bulkAdd: async (list: Row[]) => {
        for (const r of list) rows.set(r.id, { ...r });
        return list.map((r) => r.id);
      },
      get: async (id: string) => rows.get(id),
      update: async (id: string, patch: Record<string, unknown>) => {
        const existing = rows.get(id);
        if (!existing) return 0;
        rows.set(id, { ...existing, ...patch });
        return 1;
      },
      delete: async (id: string) => {
        rows.delete(id);
      },
      where: (field: string) => ({
        equals: (value: unknown) => ({
          sortBy: async (key: string) =>
            [...rows.values()]
              .filter((r) => r[field] === value)
              .sort((a, b) => Number(a[key]) - Number(b[key])),
        }),
        anyOf: (values: unknown[]) => ({
          toArray: async () => [...rows.values()].filter((r) => values.includes(r[field])),
        }),
      }),
    };
  };

  const db = {
    players: makeTable(),
    games: makeTable(),
    participants: makeTable(),
    events: makeTable(),
    transaction: async (_mode: string, ...args: unknown[]) => {
      const fn = args[args.length - 1] as () => Promise<unknown>;
      return fn();
    },
  };

  return { db };
});

import { db } from "@/lib/db";
import {
  abandonGame,
  endVisitEarly,
  finishGame,
  recordThrow,
  startGame,
  undoLastThrow,
} from "./game-actions";

type MockTable = { rows: Map<string, Record<string, unknown> & { id: string }> };
const players = db.players as unknown as MockTable;
const games = db.games as unknown as MockTable;
const participants = db.participants as unknown as MockTable;
const events = db.events as unknown as MockTable;

beforeEach(() => {
  for (const t of [players, games, participants, events]) t.rows.clear();
});

async function seedPlayers(ids: string[]) {
  for (const id of ids) {
    players.rows.set(id, { id, name: id, createdAt: 0 });
  }
}

describe("startGame", () => {
  it("rejects an unknown mode", async () => {
    const result = await startGame({
      mode: "nope" as unknown as "x01",
      playerIds: ["a", "b"],
    });
    expect(result).toEqual({ error: "Invalid game mode" });
  });

  it("requires at least two players", async () => {
    const result = await startGame({ mode: "x01", playerIds: ["a"] });
    expect(result).toEqual({ error: "Pick at least 2 players" });
  });

  it("rejects unknown player ids", async () => {
    await seedPlayers(["a"]);
    const result = await startGame({ mode: "x01", playerIds: ["a", "ghost"] });
    expect(result).toEqual({ error: "Unknown players" });
  });

  it("creates a game with default config and participant rows", async () => {
    await seedPlayers(["a", "b"]);
    const result = await startGame({ mode: "x01", playerIds: ["a", "b"] });
    expect(result.ok).toBe(true);
    expect(typeof result.id).toBe("string");

    const game = games.rows.get(result.id!) as Record<string, unknown>;
    expect(game.status).toBe("in_progress");
    expect(game.mode).toBe("x01");
    expect(game.config).toEqual({ startScore: 501, outMode: "single" });
    expect(game.winnerParticipantId).toBeNull();

    const parts = [...participants.rows.values()].filter((p) => p.gameId === result.id);
    expect(parts).toHaveLength(2);
    expect(parts.map((p) => p.position).sort()).toEqual([0, 1]);
    expect(parts.map((p) => p.playerId).sort()).toEqual(["a", "b"]);
  });

  it("accepts a caller-provided config", async () => {
    await seedPlayers(["a", "b"]);
    const config = { startScore: 301, outMode: "double" };
    const result = await startGame({ mode: "x01", playerIds: ["a", "b"], config });
    const game = games.rows.get(result.id!) as Record<string, unknown>;
    expect(game.config).toEqual(config);
  });
});

describe("recordThrow", () => {
  it("errors when the game does not exist", async () => {
    const result = await recordThrow({
      gameId: "missing",
      participantId: "p",
      roundIndex: 0,
      throwIndex: 0,
      value: 20,
      multiplier: 1,
    });
    expect(result).toEqual({ error: "Game not found" });
  });

  it("errors when the game is not active", async () => {
    games.rows.set("g1", { id: "g1", status: "finished" });
    const result = await recordThrow({
      gameId: "g1",
      participantId: "p",
      roundIndex: 0,
      throwIndex: 0,
      value: 20,
      multiplier: 1,
    });
    expect(result).toEqual({ error: "Game is not active" });
  });

  it("stores a new event with endsVisit defaulted to false", async () => {
    games.rows.set("g1", { id: "g1", status: "in_progress" });
    const result = await recordThrow({
      gameId: "g1",
      participantId: "p",
      roundIndex: 2,
      throwIndex: 1,
      value: 19,
      multiplier: 3,
    });
    expect(result.ok).toBe(true);
    const event = events.rows.get(result.eventId!) as Record<string, unknown>;
    expect(event.gameId).toBe("g1");
    expect(event.participantId).toBe("p");
    expect(event.roundIndex).toBe(2);
    expect(event.data).toMatchObject({
      value: 19,
      multiplier: 3,
      throwIndex: 1,
      endsVisit: false,
    });
  });

  it("forwards an explicit endsVisit flag", async () => {
    games.rows.set("g1", { id: "g1", status: "in_progress" });
    const result = await recordThrow({
      gameId: "g1",
      participantId: "p",
      roundIndex: 0,
      throwIndex: 0,
      value: 1,
      multiplier: 1,
      endsVisit: true,
    });
    const event = events.rows.get(result.eventId!) as Record<string, unknown>;
    expect((event.data as Record<string, unknown>).endsVisit).toBe(true);
  });
});

describe("endVisitEarly", () => {
  it("errors on a missing event", async () => {
    games.rows.set("g1", { id: "g1", status: "in_progress" });
    const result = await endVisitEarly({ gameId: "g1", eventId: "missing" });
    expect(result).toEqual({ error: "Throw not found" });
  });

  it("flips endsVisit on an existing event without losing other fields", async () => {
    games.rows.set("g1", { id: "g1", status: "in_progress" });
    events.rows.set("e1", {
      id: "e1",
      gameId: "g1",
      participantId: "p",
      roundIndex: 0,
      data: { value: 20, multiplier: 1, throwIndex: 0, endsVisit: false },
      createdAt: 1,
    });
    const result = await endVisitEarly({ gameId: "g1", eventId: "e1" });
    expect(result).toEqual({ ok: true });
    const event = events.rows.get("e1") as Record<string, unknown>;
    expect(event.data).toEqual({ value: 20, multiplier: 1, throwIndex: 0, endsVisit: true });
  });
});

describe("undoLastThrow", () => {
  it("is a no-op when there are no events", async () => {
    games.rows.set("g1", { id: "g1", status: "in_progress" });
    const result = await undoLastThrow("g1");
    expect(result).toEqual({ ok: true });
    expect(events.rows.size).toBe(0);
  });

  it("removes only the most recently created event", async () => {
    games.rows.set("g1", { id: "g1", status: "in_progress" });
    events.rows.set("old", { id: "old", gameId: "g1", createdAt: 1 });
    events.rows.set("new", { id: "new", gameId: "g1", createdAt: 2 });
    events.rows.set("other", { id: "other", gameId: "g2", createdAt: 3 });
    const result = await undoLastThrow("g1");
    expect(result).toEqual({ ok: true });
    expect(events.rows.has("new")).toBe(false);
    expect(events.rows.has("old")).toBe(true);
    expect(events.rows.has("other")).toBe(true);
  });
});

describe("finishGame", () => {
  it("marks the game finished and stores per-participant stats", async () => {
    games.rows.set("g1", { id: "g1", status: "in_progress" });
    participants.rows.set("p1", { id: "p1", gameId: "g1", finalStats: {} });
    participants.rows.set("p2", { id: "p2", gameId: "g1", finalStats: {} });
    const result = await finishGame({
      gameId: "g1",
      winnerParticipantId: "p1",
      participantStats: { p1: { score: 501 }, p2: { score: 320 } },
    });
    expect(result).toEqual({ ok: true });
    const game = games.rows.get("g1") as Record<string, unknown>;
    expect(game.status).toBe("finished");
    expect(game.winnerParticipantId).toBe("p1");
    expect(typeof game.finishedAt).toBe("number");
    expect((participants.rows.get("p1") as Record<string, unknown>).finalStats).toEqual({
      score: 501,
    });
    expect((participants.rows.get("p2") as Record<string, unknown>).finalStats).toEqual({
      score: 320,
    });
  });
});

describe("abandonGame", () => {
  it("marks the game abandoned", async () => {
    games.rows.set("g1", { id: "g1", status: "in_progress" });
    const result = await abandonGame("g1");
    expect(result).toEqual({ ok: true });
    const game = games.rows.get("g1") as Record<string, unknown>;
    expect(game.status).toBe("abandoned");
    expect(typeof game.finishedAt).toBe("number");
  });

  it("errors on missing game", async () => {
    const result = await abandonGame("ghost");
    expect(result).toEqual({ error: "Game not found" });
  });
});
