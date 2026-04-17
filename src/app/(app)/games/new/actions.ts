"use server";

import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { game, gameParticipant, player } from "@/lib/db/schema";
import { requireUser } from "@/lib/session";
import { defaultConfig, type GameMode } from "@/lib/games/shared";

export async function startGame(input: {
  mode: GameMode;
  playerIds: string[];
  config?: unknown;
}) {
  const user = await requireUser();

  if (!["x01", "cricket", "killer"].includes(input.mode)) {
    return { error: "Invalid game mode" };
  }
  if (input.playerIds.length < 2) {
    return { error: "Pick at least 2 players" };
  }

  const ownedPlayers = await db
    .select({ id: player.id })
    .from(player)
    .where(and(eq(player.userId, user.id), inArray(player.id, input.playerIds)));

  if (ownedPlayers.length !== input.playerIds.length) {
    return { error: "Unknown players" };
  }

  const config = (input.config ?? defaultConfig(input.mode)) as Record<string, unknown>;

  const [created] = await db
    .insert(game)
    .values({ userId: user.id, mode: input.mode, config })
    .returning({ id: game.id });

  await db.insert(gameParticipant).values(
    input.playerIds.map((playerId, i) => ({
      gameId: created.id,
      playerId,
      position: i,
    })),
  );

  redirect(`/games/${created.id}`);
}
