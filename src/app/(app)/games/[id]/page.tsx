import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { game, gameEvent, gameParticipant, player } from "@/lib/db/schema";
import { requireUser } from "@/lib/session";
import { X01Board } from "./modes/x01";
import { CricketBoard } from "./modes/cricket";
import { KillerBoard } from "./modes/killer";
import { ComingSoonBoard } from "./modes/coming-soon";

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const [g] = await db
    .select()
    .from(game)
    .where(and(eq(game.id, id), eq(game.userId, user.id)));
  if (!g) notFound();

  const participants = await db
    .select({
      id: gameParticipant.id,
      playerId: gameParticipant.playerId,
      position: gameParticipant.position,
      finalStats: gameParticipant.finalStats,
      name: player.name,
    })
    .from(gameParticipant)
    .innerJoin(player, eq(player.id, gameParticipant.playerId))
    .where(eq(gameParticipant.gameId, g.id))
    .orderBy(asc(gameParticipant.position));

  const events = await db
    .select()
    .from(gameEvent)
    .where(eq(gameEvent.gameId, g.id))
    .orderBy(asc(gameEvent.roundIndex), asc(gameEvent.createdAt));

  if (g.mode === "x01") {
    return <X01Board game={g} participants={participants} events={events} />;
  }
  if (g.mode === "cricket") {
    return <CricketBoard game={g} participants={participants} events={events} />;
  }
  if (g.mode === "killer") {
    return <KillerBoard game={g} participants={participants} events={events} />;
  }
  return <ComingSoonBoard mode={g.mode} />;
}
