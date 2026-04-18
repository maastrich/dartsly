import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuid } from "uuid";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Players</h1>
      </div>
      <form ref={formRef} onSubmit={onSubmit} className="flex gap-2">
        <Input name="name" placeholder="Player name" required maxLength={40} />
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </Button>
      </form>
      <ul className="divide-y rounded-lg border">
        {players.length === 0 && (
          <li className="p-4 text-sm text-muted-foreground">No players yet.</li>
        )}
        {players.map((p) => (
          <li key={p.id} className="flex items-center justify-between p-3">
            <span>{p.name}</span>
            <Button variant="ghost" size="sm" onClick={() => onDelete(p.id, p.name)}>
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
