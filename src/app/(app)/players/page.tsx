import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { player } from "@/lib/db/schema";
import { requireUser } from "@/lib/session";
import { NewPlayerForm, DeletePlayerButton } from "./ui";

export default async function PlayersPage() {
  const user = await requireUser();
  const players = await db
    .select()
    .from(player)
    .where(eq(player.userId, user.id))
    .orderBy(asc(player.name));

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Players</h1>
      </div>
      <NewPlayerForm />
      <ul className="divide-y rounded-lg border">
        {players.length === 0 && (
          <li className="p-4 text-sm text-muted-foreground">No players yet.</li>
        )}
        {players.map((p) => (
          <li key={p.id} className="flex items-center justify-between p-3">
            <span>{p.name}</span>
            <DeletePlayerButton id={p.id} name={p.name} />
          </li>
        ))}
      </ul>
    </div>
  );
}
