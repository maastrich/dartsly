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
                  "flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg transition-colors",
                  active
                    ? "text-[var(--dart-gold)]"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
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
