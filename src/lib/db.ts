import Dexie, { type EntityTable } from "dexie";
import type { GameMode } from "./games-shared";

export type Player = {
  id: string;
  name: string;
  createdAt: number;
};

export type GameStatus = "in_progress" | "finished" | "abandoned";

export type Game = {
  id: string;
  mode: GameMode;
  status: GameStatus;
  config: unknown;
  winnerParticipantId: string | null;
  startedAt: number;
  finishedAt: number | null;
};

export type Participant = {
  id: string;
  gameId: string;
  playerId: string;
  position: number;
  finalStats: unknown;
};

export type GameEvent = {
  id: string;
  gameId: string;
  participantId: string;
  roundIndex: number;
  data: unknown;
  createdAt: number;
};

export const db = new Dexie("dartsly") as Dexie & {
  players: EntityTable<Player, "id">;
  games: EntityTable<Game, "id">;
  participants: EntityTable<Participant, "id">;
  events: EntityTable<GameEvent, "id">;
};

db.version(1).stores({
  players: "id, name, createdAt",
  games: "id, status, startedAt",
  participants: "id, gameId, playerId, [gameId+position]",
  events: "id, gameId, participantId, [gameId+roundIndex]",
});
