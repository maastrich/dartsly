import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { player } from "@/lib/db/schema";
import { requireUser } from "@/lib/session";
import { NewGameForm } from "./ui";
import type { GameMode } from "@/lib/games/shared";

const MODE_LABEL: Record<GameMode, string> = {
  x01: "X01",
  cricket: "Cricket",
  killer: "Killer",
};

export default async function NewGamePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const user = await requireUser();
  const { mode: modeParam } = await searchParams;
  const mode: GameMode =
    modeParam === "cricket" || modeParam === "killer" ? modeParam : "x01";

  const players = await db
    .select()
    .from(player)
    .where(eq(player.userId, user.id))
    .orderBy(asc(player.name));

  if (players.length < 2) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 pt-6 pb-6 w-full flex flex-col gap-4">
          <Heading mode={mode} />
          <p className="text-sm text-muted-foreground">
            You need at least 2 players.{" "}
            <Link href="/players" className="text-foreground underline underline-offset-4">
              Add players
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <NewGameForm
      mode={mode}
      players={players.map((p) => ({ id: p.id, name: p.name }))}
      heading={<Heading mode={mode} />}
    />
  );
}

function Heading({ mode }: { mode: GameMode }) {
  return (
    <div>
      <div className="font-display text-xs tracking-[0.4em] uppercase text-muted-foreground">
        New leg
      </div>
      <h1 className="font-display font-black text-4xl uppercase mt-1 leading-none">
        {MODE_LABEL[mode]}
      </h1>
    </div>
  );
}
