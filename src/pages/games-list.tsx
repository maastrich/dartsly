import { Link } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Target, Crosshair, Skull, Trophy } from "lucide-react";
import { db } from "@/lib/db";

const MODE_ACCENT: Record<string, { color: string; Icon: typeof Target; label: string }> = {
  x01: { color: "var(--dart-gold)", Icon: Target, label: "X01" },
  cricket: { color: "var(--dart-green)", Icon: Crosshair, label: "Cricket" },
  killer: { color: "var(--dart-red)", Icon: Skull, label: "Killer" },
};

function formatWhen(ts: number) {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  const day = 24 * 60 * 60 * 1000;
  if (diff < day && d.getDate() === new Date(now).getDate())
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (diff < 7 * day) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function GamesListPage() {
  const data = useLiveQuery(async () => {
    const games = await db.games.orderBy("startedAt").reverse().limit(50).toArray();
    const gameIds = games.map((g) => g.id);
    const participants =
      gameIds.length === 0 ? [] : await db.participants.where("gameId").anyOf(gameIds).toArray();
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
      <div>
        <div className="font-display text-xs tracking-[0.4em] uppercase text-muted-foreground">
          Past legs
        </div>
        <h1 className="font-display font-black text-4xl uppercase tracking-tight leading-none mt-2">
          History
        </h1>
      </div>

      {games.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-8 text-center">
          <div className="font-display text-xs tracking-[0.3em] uppercase text-muted-foreground">
            No games yet
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Finished legs and their winners will show up here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {games.map((g) => {
            const ps = (byGame.get(g.id) ?? []).sort((a, b) => a.position - b.position);
            const winner = ps.find((p) => p.id === g.winnerParticipantId);
            const mode = MODE_ACCENT[g.mode] ?? MODE_ACCENT.x01;
            const status = g.status.replace("_", " ");
            return (
              <li key={g.id}>
                <Link
                  to={`/games/${g.id}`}
                  className="group relative block rounded-xl border border-border/70 bg-card/60 p-4 pl-5 overflow-hidden transition-all hover:border-border hover:-translate-y-px active:translate-y-0"
                >
                  <span
                    aria-hidden
                    className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full"
                    style={{ background: mode.color }}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <mode.Icon
                        className="size-5 shrink-0"
                        style={{ color: mode.color }}
                        strokeWidth={2.25}
                      />
                      <div className="min-w-0">
                        <div className="font-display font-black text-sm uppercase tracking-[0.15em] leading-none">
                          {mode.label}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          {ps.map((p) => p.name).join(" · ")}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                        {formatWhen(g.startedAt)}
                      </div>
                      {winner ? (
                        <div
                          className="flex items-center justify-end gap-1 mt-1 font-display text-xs uppercase tracking-[0.15em]"
                          style={{ color: mode.color }}
                        >
                          <Trophy className="size-3" strokeWidth={2.5} />
                          <span className="truncate max-w-[10rem]">{winner.name}</span>
                        </div>
                      ) : (
                        <div className="mt-1 font-display text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground capitalize">
                          {status}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
