import { v4 as uuid } from "uuid";
import { db, type Game, type GameEvent, type Participant } from "@/lib/db";
import { defaultConfig, type GameMode } from "@/lib/games-shared";

export async function startGame(input: {
  mode: GameMode;
  playerIds: string[];
  config?: unknown;
}): Promise<{ ok?: true; id?: string; error?: string }> {
  if (!["x01", "cricket", "killer"].includes(input.mode)) {
    return { error: "Invalid game mode" };
  }
  if (input.playerIds.length < 2) {
    return { error: "Pick at least 2 players" };
  }
  const owned = await db.players.where("id").anyOf(input.playerIds).toArray();
  if (owned.length !== input.playerIds.length) return { error: "Unknown players" };

  const config = input.config ?? defaultConfig(input.mode);
  const gameId = uuid();
  const now = Date.now();

  await db.transaction("rw", db.games, db.participants, async () => {
    const g: Game = {
      id: gameId,
      mode: input.mode,
      status: "in_progress",
      config,
      winnerParticipantId: null,
      startedAt: now,
      finishedAt: null,
    };
    await db.games.add(g);
    const participants: Participant[] = input.playerIds.map((playerId, i) => ({
      id: uuid(),
      gameId,
      playerId,
      position: i,
      finalStats: {},
    }));
    await db.participants.bulkAdd(participants);
  });

  return { ok: true, id: gameId };
}

export async function recordThrow(input: {
  gameId: string;
  participantId: string;
  roundIndex: number;
  throwIndex: number;
  value: number;
  multiplier: 1 | 2 | 3;
  endsVisit?: boolean;
}): Promise<{ ok?: true; eventId?: string; error?: string }> {
  const g = await db.games.get(input.gameId);
  if (!g) return { error: "Game not found" };
  if (g.status !== "in_progress") return { error: "Game is not active" };
  const id = uuid();
  const ev: GameEvent = {
    id,
    gameId: input.gameId,
    participantId: input.participantId,
    roundIndex: input.roundIndex,
    data: {
      value: input.value,
      multiplier: input.multiplier,
      throwIndex: input.throwIndex,
      endsVisit: input.endsVisit ?? false,
    },
    createdAt: Date.now(),
  };
  await db.events.add(ev);
  return { ok: true, eventId: id };
}

export async function endVisitEarly(input: {
  gameId: string;
  eventId: string;
}): Promise<{ ok?: true; error?: string }> {
  const g = await db.games.get(input.gameId);
  if (!g) return { error: "Game not found" };
  if (g.status !== "in_progress") return { error: "Game is not active" };
  const ev = await db.events.get(input.eventId);
  if (!ev) return { error: "Throw not found" };
  const data = ev.data as Record<string, unknown>;
  await db.events.update(input.eventId, { data: { ...data, endsVisit: true } });
  return { ok: true };
}

export async function undoLastThrow(gameId: string): Promise<{ ok?: true; error?: string }> {
  const g = await db.games.get(gameId);
  if (!g) return { error: "Game not found" };
  if (g.status !== "in_progress") return { error: "Game is not active" };
  const events = await db.events.where("gameId").equals(gameId).sortBy("createdAt");
  const last = events[events.length - 1];
  if (!last) return { ok: true };
  await db.events.delete(last.id);
  return { ok: true };
}

export async function finishGame(input: {
  gameId: string;
  winnerParticipantId: string;
  participantStats: Record<string, Record<string, unknown>>;
}): Promise<{ ok?: true; error?: string }> {
  const g = await db.games.get(input.gameId);
  if (!g) return { error: "Game not found" };
  await db.transaction("rw", db.games, db.participants, async () => {
    await db.games.update(input.gameId, {
      status: "finished",
      winnerParticipantId: input.winnerParticipantId,
      finishedAt: Date.now(),
    });
    for (const [participantId, stats] of Object.entries(input.participantStats)) {
      await db.participants.update(participantId, { finalStats: stats });
    }
  });
  return { ok: true };
}

export async function abandonGame(gameId: string): Promise<{ ok?: true; error?: string }> {
  const g = await db.games.get(gameId);
  if (!g) return { error: "Game not found" };
  await db.games.update(gameId, { status: "abandoned", finishedAt: Date.now() });
  return { ok: true };
}
