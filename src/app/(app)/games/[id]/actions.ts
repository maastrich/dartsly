"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { game, gameEvent, gameParticipant } from "@/lib/db/schema";
import { requireUser } from "@/lib/session";

async function loadOwnedGame(gameId: string, userId: string) {
  const [g] = await db
    .select()
    .from(game)
    .where(and(eq(game.id, gameId), eq(game.userId, userId)));
  return g;
}

export async function recordThrow(input: {
  gameId: string;
  participantId: string;
  roundIndex: number;
  throwIndex: number;
  value: number;
  multiplier: 1 | 2 | 3;
  endsVisit?: boolean;
}) {
  const user = await requireUser();
  const g = await loadOwnedGame(input.gameId, user.id);
  if (!g) return { error: "Game not found" };
  if (g.status !== "in_progress") return { error: "Game is not active" };

  await db.insert(gameEvent).values({
    gameId: input.gameId,
    participantId: input.participantId,
    roundIndex: input.roundIndex,
    data: {
      value: input.value,
      multiplier: input.multiplier,
      throwIndex: input.throwIndex,
      endsVisit: input.endsVisit ?? false,
    },
  });
  revalidatePath(`/games/${input.gameId}`);
  return { ok: true };
}

export async function endVisitEarly(input: { gameId: string; eventId: string }) {
  const user = await requireUser();
  const g = await loadOwnedGame(input.gameId, user.id);
  if (!g) return { error: "Game not found" };
  if (g.status !== "in_progress") return { error: "Game is not active" };

  const [ev] = await db
    .select()
    .from(gameEvent)
    .where(and(eq(gameEvent.gameId, input.gameId), eq(gameEvent.id, input.eventId)));
  if (!ev) return { error: "Throw not found" };

  const data = ev.data as Record<string, unknown>;
  await db
    .update(gameEvent)
    .set({ data: { ...data, endsVisit: true } })
    .where(eq(gameEvent.id, input.eventId));
  revalidatePath(`/games/${input.gameId}`);
  return { ok: true };
}

export async function undoLastThrow(gameId: string) {
  const user = await requireUser();
  const g = await loadOwnedGame(gameId, user.id);
  if (!g) return { error: "Game not found" };
  if (g.status !== "in_progress") return { error: "Game is not active" };

  const [last] = await db
    .select()
    .from(gameEvent)
    .where(eq(gameEvent.gameId, gameId))
    .orderBy(desc(gameEvent.createdAt))
    .limit(1);
  if (!last) return { ok: true };
  await db.delete(gameEvent).where(eq(gameEvent.id, last.id));
  revalidatePath(`/games/${gameId}`);
  return { ok: true };
}

export async function finishGame(input: {
  gameId: string;
  winnerParticipantId: string;
  participantStats: Record<string, Record<string, unknown>>;
}) {
  const user = await requireUser();
  const g = await loadOwnedGame(input.gameId, user.id);
  if (!g) return { error: "Game not found" };

  await db
    .update(game)
    .set({
      status: "finished",
      winnerParticipantId: input.winnerParticipantId,
      finishedAt: new Date(),
    })
    .where(eq(game.id, input.gameId));

  for (const [participantId, stats] of Object.entries(input.participantStats)) {
    await db
      .update(gameParticipant)
      .set({ finalStats: stats })
      .where(eq(gameParticipant.id, participantId));
  }
  revalidatePath(`/games/${input.gameId}`);
  revalidatePath(`/games`);
  return { ok: true };
}

export async function abandonGame(gameId: string) {
  const user = await requireUser();
  const g = await loadOwnedGame(gameId, user.id);
  if (!g) return { error: "Game not found" };
  await db
    .update(game)
    .set({ status: "abandoned", finishedAt: new Date() })
    .where(eq(game.id, gameId));
  revalidatePath(`/games`);
  return { ok: true };
}
