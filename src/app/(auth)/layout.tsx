import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <span className="size-9 rounded-full bg-[var(--dart-gold)] grid place-items-center">
          <span className="size-4 rounded-full bg-[var(--field)]" />
        </span>
        <span className="font-display font-black text-2xl tracking-[0.15em] uppercase">
          Dartsly
        </span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
