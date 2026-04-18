import { Link, Outlet } from "react-router";
import { InstallPrompt } from "@/components/install-prompt";
import { BottomNav } from "@/components/bottom-nav";

export function AppShell() {
  return (
    <div className="fixed inset-0 w-screen h-screen flex flex-col overflow-hidden">
      <header
        className="shrink-0 border-b border-border/60 bg-background/75 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 h-12">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="size-6 rounded-full bg-[var(--dart-gold)] grid place-items-center shadow-[0_0_12px_var(--dart-gold)]/40">
              <span className="size-2.5 rounded-full bg-[var(--field)]" />
            </span>
            <span className="font-display font-black text-lg tracking-[0.12em] uppercase">
              Dartsly
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <InstallPrompt />
          </div>
        </div>
      </header>
      <main className="flex-1 min-h-0 flex flex-col overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
