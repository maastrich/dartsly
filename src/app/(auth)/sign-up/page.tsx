"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignUpPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await signUp.email({
      name: String(data.get("name")),
      email: String(data.get("email")),
      password: String(data.get("password")),
    });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Sign-up failed");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="font-display text-xs tracking-[0.4em] uppercase text-muted-foreground">
          New player
        </div>
        <h1 className="font-display font-black text-4xl uppercase mt-1 leading-none">
          Grab your <span className="text-[var(--dart-gold)]">tips.</span>
        </h1>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Name" name="name" required autoComplete="name" />
        <Field label="Email" name="email" type="email" required autoComplete="email" />
        <Field
          label="Password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <Button
          type="submit"
          disabled={loading}
          className="h-12 font-display uppercase tracking-[0.25em] text-sm bg-[var(--dart-gold)] text-[var(--field)] hover:bg-[var(--dart-gold)]/90"
        >
          {loading ? "Creating…" : "Create account"}
        </Button>
        <p className="text-sm text-muted-foreground text-center">
          Already in?{" "}
          <Link href="/sign-in" className="text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  ...rest
}: {
  label: string;
  name: string;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-2">
      <Label
        htmlFor={name}
        className="font-display uppercase text-[0.7rem] tracking-[0.3em]"
      >
        {label}
      </Label>
      <Input id={name} name={name} type={type} className="h-12" {...rest} />
    </div>
  );
}
