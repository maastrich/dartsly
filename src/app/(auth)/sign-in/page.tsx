"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await signIn.email({
      email: String(data.get("email")),
      password: String(data.get("password")),
    });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Sign-in failed");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="font-display text-xs tracking-[0.4em] uppercase text-muted-foreground">
          Welcome back
        </div>
        <h1 className="font-display font-black text-4xl uppercase mt-1 leading-none">
          Step up.
        </h1>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="font-display uppercase text-[0.7rem] tracking-[0.3em]">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="h-12"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label
            htmlFor="password"
            className="font-display uppercase text-[0.7rem] tracking-[0.3em]"
          >
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="h-12"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="h-12 font-display uppercase tracking-[0.25em] text-sm bg-[var(--dart-gold)] text-[var(--field)] hover:bg-[var(--dart-gold)]/90"
        >
          {loading ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-sm text-muted-foreground text-center">
          No account?{" "}
          <Link href="/sign-up" className="text-foreground underline underline-offset-4">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
