import { Link, useLocation } from "react-router";
import { Home, Users, History } from "lucide-react";

const TABS = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/players", label: "Players", Icon: Users },
  { href: "/games", label: "History", Icon: History },
] as const;

export function BottomNav() {
  const pathname = useLocation().pathname;
  const onGamePlay = /^\/games\/[^/]+$/.test(pathname) && pathname !== "/games/new";
  if (onGamePlay) return null;

  const activeIdx = (() => {
    if (pathname.startsWith("/players")) return 1;
    if (pathname === "/games" || pathname.startsWith("/games/")) {
      if (pathname.startsWith("/games/new")) return 0;
      return 2;
    }
    return 0;
  })();

  return (
    <nav
      aria-label="Primary"
      className="shrink-0 border-t border-border/60 bg-background/85 backdrop-blur-md"
    >
      <ul
        className="grid grid-cols-3 max-w-3xl mx-auto px-2 pt-1.5"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        {TABS.map((t, i) => {
          const active = i === activeIdx;
          return (
            <li key={t.href} className="flex">
              <Link
                to={t.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "relative flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg transition-colors",
                  active
                    ? "text-[var(--dart-gold)]"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className={[
                    "absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-b-full bg-[var(--dart-gold)] transition-all duration-200",
                    active ? "w-8 opacity-100" : "w-0 opacity-0",
                  ].join(" ")}
                />
                <t.Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                <span className="font-display text-[0.55rem] uppercase tracking-[0.25em] leading-none">
                  {t.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
