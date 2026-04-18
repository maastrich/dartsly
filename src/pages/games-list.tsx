import { Link } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";

export default function GamesListPage() {
  const data = useLiveQuery(async () => {
    const games = await db.games.orderBy("startedAt").reverse().limit(50).toArray();
    const gameIds = games.map((g) => g.id);
    const participants =
      gameIds.length === 0
        ? []
        : await db.participants.where("gameId").anyOf(gameIds).toArray();
    const playerIds = [...new Set(participants.map((p) => p.playerId))];
    const players = await db.players.where("id").anyOf(playerIds).toArray();
    const playerName = new Map(players.map((p) => [p.id, p.name]));
    const byGame = new Map<string, { id: string; name: string; position: number }[]>();
    for (const p of participants) {
      const arr = byGame.get(p.gameId) ?? [];
      arr.push({ id: p.id, name: playerName.get(p.playerId) ?? "?", position: p.position });
      byGame.set(p.gameId, arr);
    }
    return { games, byGame };
  }, []);

  if (!data) return null;
  const { games, byGame } = data;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 w-full flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Game history</h1>
      {games.length === 0 && (
        <p className="text-sm text-muted-foreground">No games yet.</p>
      )}
      <ul className="flex flex-col gap-3">
        {games.map((g) => {
          const ps = (byGame.get(g.id) ?? []).sort((a, b) => a.position - b.position);
          const winner = ps.find((p) => p.id === g.winnerParticipantId);
          return (
            <li key={g.id}>
              <Link to={`/games/${g.id}`}>
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
