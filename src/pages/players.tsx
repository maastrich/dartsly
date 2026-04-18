import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuid } from "uuid";
import { toast } from "sonner";
import { Trash2, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";

export default function PlayersPage() {
  const players = useLiveQuery(() => db.players.orderBy("name").toArray(), [], []);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) return toast.error("Name is required");
    if (name.length > 40) return toast.error("Name too long");
    setPending(true);
    try {
      const exists = await db.players.where("name").equalsIgnoreCase(name).first();
      if (exists) {
        toast.error("A player with that name already exists");
        return;
      }
      await db.players.add({ id: uuid(), name, createdAt: Date.now() });
      formRef.current?.reset();
    } finally {
      setPending(false);
    }
  }

  async function onDelete(id: string, name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    await db.players.delete(id);
  }

  const canSubmit = !pending;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6 w-full">
      <div>
        <div className="font-display text-xs tracking-[0.4em] uppercase text-muted-foreground">
          Roster
        </div>
        <h1 className="font-display font-black text-4xl uppercase tracking-tight leading-none mt-2">
          Players
        </h1>
      </div>

      <form ref={formRef} onSubmit={onSubmit} className="flex gap-2">
        <Input
          name="name"
          placeholder="Add a player"
          required
          maxLength={40}
          className="h-11 bg-card/60"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="h-11 px-4 rounded-lg bg-[var(--dart-gold)] text-[var(--field)] font-display font-extrabold uppercase tracking-[0.2em] text-xs inline-flex items-center gap-2 transition-all active:translate-y-px disabled:bg-[var(--field-raised)] disabled:text-muted-foreground disabled:cursor-not-allowed"
        >
          <UserPlus className="size-4" strokeWidth={2.5} />
          {pending ? "Adding…" : "Add"}
        </button>
      </form>

      {players.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-8 text-center">
          <div className="font-display text-xs tracking-[0.3em] uppercase text-muted-foreground">
            Empty oche
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Add at least two players to start a game.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-border/70 bg-card/60 px-4 py-3 transition-colors hover:border-border"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  aria-hidden
                  className="grid place-items-center size-8 rounded-md bg-[var(--field-raised)] font-display font-black text-sm uppercase text-muted-foreground tabular"
                >
                  {p.name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{p.name}</span>
              </div>
              <button
                type="button"
                onClick={() => onDelete(p.id, p.name)}
                aria-label={`Delete ${p.name}`}
                className="grid place-items-center size-9 rounded-md text-muted-foreground transition-colors hover:text-[var(--dart-red)] hover:bg-[var(--dart-red-dim)]/20 active:translate-y-px"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
