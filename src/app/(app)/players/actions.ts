"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { player } from "@/lib/db/schema";
import { requireUser } from "@/lib/session";

export async function createPlayer(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required" };
  if (name.length > 40) return { error: "Name too long" };

  try {
    await db.insert(player).values({ userId: user.id, name });
  } catch {
    return { error: "A player with that name already exists" };
  }
  revalidatePath("/players");
  return { ok: true };
}

export async function deletePlayer(playerId: string) {
  const user = await requireUser();
  await db.delete(player).where(and(eq(player.id, playerId), eq(player.userId, user.id)));
  revalidatePath("/players");
}
