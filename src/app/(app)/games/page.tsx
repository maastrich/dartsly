import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { game, gameParticipant, player } from "@/lib/db/schema";
import { requireUser } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";

export default async function GamesPage() {
  const user = await requireUser();

  const games = await db
    .select()
    .from(game)
    .where(eq(game.userId, user.id))
    .orderBy(desc(game.startedAt))
    .limit(50);

  const gameIds = games.map((g) => g.id);
  const participants =
    gameIds.length === 0
      ? []
      : await db
          .select({
            gameId: gameParticipant.gameId,
            participantId: gameParticipant.id,
            position: gameParticipant.position,
            name: player.name,
          })
          .from(gameParticipant)
          .innerJoin(player, eq(player.id, gameParticipant.playerId))
          .where(inArray(gameParticipant.gameId, gameIds));

  const byGame = new Map<string, typeof participants>();
  for (const r of participants) {
    if (!byGame.has(r.gameId)) byGame.set(r.gameId, []);
    byGame.get(r.gameId)!.push(r);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 w-full flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Game history</h1>
      {games.length === 0 && (
        <p className="text-sm text-muted-foreground">No games yet.</p>
      )}
      <ul className="flex flex-col gap-3">
        {games.map((g) => {
          const ps = (byGame.get(g.id) ?? []).sort((a, b) => a.position - b.position);
          const winner = ps.find((p) => p.participantId === g.winnerParticipantId);
          return (
            <li key={g.id}>
              <Link href={`/games/${g.id}`}>
                <Card className="hover:border-foreground/30 transition-colors">
                  <CardContent className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <div className="font-medium capitalize">{g.mode}</div>
                      <div className="text-sm text-muted-foreground">
                        {ps.map((p) => p.name).join(" · ")}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="capitalize">{g.status.replace("_", " ")}</div>
                      {winner && (
                        <div className="text-muted-foreground">Winner: {winner.name}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
