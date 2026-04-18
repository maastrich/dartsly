import { useEffect, useState } from "react";
import { Download, Share, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "ios" | "android" | "desktop" | null;

const STORAGE_KEY = "dartsly-install-dismissed";

export function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setStandalone(isStandalone);
    setDismissed(window.localStorage.getItem(STORAGE_KEY) === "1");

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    if (isIOS) setPlatform("ios");
    else setPlatform("desktop");

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setPlatform(/Android/i.test(ua) ? "android" : "desktop");
    };
    const installed = () => {
      window.localStorage.setItem(STORAGE_KEY, "1");
      setDismissed(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (standalone || dismissed) return null;
  const installable = platform === "ios" || !!deferred;
  if (!installable) return null;

  const onClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") {
        window.localStorage.setItem(STORAGE_KEY, "1");
        setDismissed(true);
      }
      setDeferred(null);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label="Install app"
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-[var(--dart-gold)]/50 bg-[var(--dart-gold)]/10 text-[var(--dart-gold)] font-display text-[0.6rem] uppercase tracking-[0.25em] font-extrabold hover:bg-[var(--dart-gold)]/20 transition"
      >
        <Download className="size-3.5" />
        Install
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-black text-2xl uppercase tracking-tight">
              Install Dartsly
            </DialogTitle>
            <DialogDescription>
              Add it to your home screen for a full-screen, app-like experience.
            </DialogDescription>
          </DialogHeader>

          <ol className="flex flex-col gap-3 mt-2">
            <Step
              n={1}
              body={
                <>
                  Open this page in <strong className="text-foreground">Safari</strong>.
                  Other iOS browsers can&apos;t install PWAs.
                </>
              }
            />
            <Step
              n={2}
              body={
                <span className="inline-flex items-center gap-1.5 flex-wrap">
                  Tap the
                  <span className="inline-flex items-center gap-1 px-2 h-6 rounded-md border border-border bg-secondary">
                    <Share className="size-3.5" />
                    <span className="text-xs">Share</span>
                  </span>
                  button at the bottom.
                </span>
              }
            />
            <Step
              n={3}
              body={
                <span className="inline-flex items-center gap-1.5 flex-wrap">
                  Scroll and choose
                  <span className="inline-flex items-center gap-1 px-2 h-6 rounded-md border border-border bg-secondary">
                    <Plus className="size-3.5" />
                    <span className="text-xs">Add to Home Screen</span>
                  </span>
                </span>
              }
            />
          </ol>

          <button
            type="button"
            onClick={() => {
              window.localStorage.setItem(STORAGE_KEY, "1");
              setDismissed(true);
              setOpen(false);
            }}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 self-start"
          >
            Don&apos;t show again
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Step({ n, body }: { n: number; body: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="shrink-0 size-6 rounded-full border border-[var(--dart-gold)]/60 text-[var(--dart-gold)] grid place-items-center font-display font-black text-[0.7rem]">
        {n}
      </span>
      <span className="text-sm text-muted-foreground leading-snug pt-0.5">{body}</span>
    </li>
  );
}
