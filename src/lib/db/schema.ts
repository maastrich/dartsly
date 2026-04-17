import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Auth tables (Better Auth defaults) ─────────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Domain tables ──────────────────────────────────────────────────────────

export const gameMode = pgEnum("game_mode", ["x01", "cricket", "killer"]);
export const gameStatus = pgEnum("game_status", [
  "in_progress",
  "finished",
  "abandoned",
]);

export const player = pgTable(
  "player",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("player_user_idx").on(t.userId),
    uniqueIndex("player_user_name_unique").on(t.userId, t.name),
  ],
);

export const game = pgTable(
  "game",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mode: gameMode("mode").notNull(),
    status: gameStatus("status").notNull().default("in_progress"),
    // Mode-specific setup, e.g. x01 = { startScore: 501, doubleOut: true }
    config: jsonb("config").notNull().default({}),
    winnerParticipantId: uuid("winner_participant_id"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    finishedAt: timestamp("finished_at"),
  },
  (t) => [index("game_user_idx").on(t.userId)],
);

export const gameParticipant = pgTable(
  "game_participant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => player.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    // Final per-mode snapshot for quick stat queries (points, closures, kills, ...)
    finalStats: jsonb("final_stats").notNull().default({}),
  },
  (t) => [
    index("participant_game_idx").on(t.gameId),
    index("participant_player_idx").on(t.playerId),
    uniqueIndex("participant_game_player_unique").on(t.gameId, t.playerId),
  ],
);

// One row per round per participant. Shape of `data` depends on game.mode.
// x01:     { score: 26, darts: [20, "T1", "D3"] }          // score = round total
// cricket: { hits: { "20": 2, "19": 1 }, pointsScored: 40 }
// killer:  { target: "D17", doublesHit: 0, kills: 1, livesLost: 0, isKiller: true }
export const gameEvent = pgTable(
  "game_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => gameParticipant.id, { onDelete: "cascade" }),
    roundIndex: integer("round_index").notNull(),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("event_game_round_idx").on(t.gameId, t.roundIndex),
    index("event_participant_idx").on(t.participantId),
  ],
);

export type User = typeof user.$inferSelect;
export type Player = typeof player.$inferSelect;
export type Game = typeof game.$inferSelect;
export type GameParticipant = typeof gameParticipant.$inferSelect;
export type GameEvent = typeof gameEvent.$inferSelect;
