import { Link } from "react-router";
import { Target, Crosshair, Skull } from "lucide-react";

const MODES = [
  {
    slug: "x01",
    title: "X01",
    tagline: "Count down to zero",
    desc: "Start at 501 · first to a clean finish wins",
    accent: "gold",
    Icon: Target,
    live: true,
  },
  {
    slug: "cricket",
    title: "Cricket",
    tagline: "Close & sting",
    desc: "Close 15 through 20 + bull, points on the side",
    accent: "green",
    Icon: Crosshair,
    live: true,
  },
  {
    slug: "killer",
    title: "Killer",
    tagline: "Become the killer",
    desc: "Hit your double, take lives, be last standing",
    accent: "red",
    Icon: Skull,
    live: true,
  },
] as const;

export default function HomePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-8 w-full">
      <div className="pt-4">
        <div className="font-display text-xs tracking-[0.4em] uppercase text-muted-foreground">
          Pick a game
        </div>
        <h1 className="font-display font-black text-5xl sm:text-6xl uppercase tracking-tight leading-[0.9] mt-2">
          Toe the <span className="text-[var(--dart-gold)]">oche.</span>
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {MODES.map((m) => {
          const accentVar =
            m.accent === "gold"
              ? "var(--dart-gold)"
              : m.accent === "green"
                ? "var(--dart-green)"
                : "var(--dart-red)";
          const tint =
            m.accent === "gold"
              ? "hover:shadow-[0_0_0_2px_var(--dart-gold),0_24px_48px_-24px_oklch(0.82_0.13_85/0.5)]"
              : m.accent === "green"
                ? "hover:shadow-[0_0_0_2px_var(--dart-green),0_24px_48px_-24px_oklch(0.6_0.15_155/0.5)]"
                : "hover:shadow-[0_0_0_2px_var(--dart-red),0_24px_48px_-24px_oklch(0.62_0.22_25/0.5)]";
          const iconColor =
            m.accent === "gold"
              ? "text-[var(--dart-gold)]"
              : m.accent === "green"
                ? "text-[var(--dart-green)]"
                : "text-[var(--dart-red)]";
          const content = (
            <div
              className={`group relative overflow-hidden rounded-2xl border border-border bg-card/60 p-5 min-h-[11rem] flex flex-col justify-between transition-all duration-300 ${
                m.live ? tint + " hover:-translate-y-0.5 active:translate-y-0" : "opacity-70"
              }`}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full blur-2xl opacity-30 group-hover:opacity-60 transition-opacity"
                style={{ background: `radial-gradient(circle, ${accentVar}, transparent 70%)` }}
              />
              <div className="relative flex items-start justify-between">
                <m.Icon className={`size-6 ${iconColor}`} strokeWidth={2.25} />
              </div>
              <div className="relative">
                <div className="font-display font-black text-3xl uppercase tracking-tight leading-none">
                  {m.title}
                </div>
                <div className="font-display text-xs tracking-[0.25em] uppercase text-muted-foreground mt-1">
                  {m.tagline}
                </div>
                <p className="text-sm text-muted-foreground mt-3 leading-snug">{m.desc}</p>
              </div>
            </div>
          );
          return (
            <Link key={m.slug} to={`/games/new?mode=${m.slug}`} className="block">
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
