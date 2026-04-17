"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPlayer, deletePlayer } from "./actions";

export function NewPlayerForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  return (
    <form
      ref={formRef}
      action={(fd) =>
        start(async () => {
          const res = await createPlayer(fd);
          if (res?.error) {
            toast.error(res.error);
            return;
          }
          formRef.current?.reset();
        })
      }
      className="flex gap-2"
    >
      <Input name="name" placeholder="Player name" required maxLength={40} />
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
    </form>
  );
}

export function DeletePlayerButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (!confirm(`Delete ${name}?`)) return;
          await deletePlayer(id);
        })
      }
    >
      Delete
    </Button>
  );
}
