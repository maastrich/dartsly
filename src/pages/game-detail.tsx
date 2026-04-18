import { useParams } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { X01Board } from "./mode-x01";
import { CricketBoard } from "./mode-cricket";
import { KillerBoard } from "./mode-killer";
import { ComingSoonBoard } from "./mode-coming-soon";

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();

  const data = useLiveQuery(async () => {
    if (!id) return null;
    const g = await db.games.get(id);
    if (!g) return { notFound: true as const };
    const parts = await db.participants.where("gameId").equals(id).sortBy("position");
    const playerIds = parts.map((p) => p.playerId);
    const players = await db.players.where("id").anyOf(playerIds).toArray();
    const playerName = new Map(players.map((p) => [p.id, p.name]));
    const participants = parts.map((p) => ({
      id: p.id,
      playerId: p.playerId,
      position: p.position,
      finalStats: p.finalStats,
      name: playerName.get(p.playerId) ?? "?",
    }));
    const events = await db.events.where("gameId").equals(id).sortBy("createdAt");
    events.sort((a, b) => {
      const t = a.roundIndex - b.roundIndex;
      if (t !== 0) return t;
      return a.createdAt - b.createdAt;
    });
    return { g, participants, events };
  }, [id]);

  if (!data) return null;
  if ("notFound" in data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 w-full">
        <h1 className="text-2xl font-semibold">Game not found</h1>
      </div>
    );
  }
  const { g, participants, events } = data;

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
