import { useEffect, useState, useTransition } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { Shuffle } from "lucide-react";
import type {
  CricketScoringMode,
  GameMode,
  KillerAssignment,
  KillerRules,
  KillerSelfRule,
  X01OutMode,
  X01StartScore,
} from "@/lib/games-shared";
import { X01_START_SCORES } from "@/lib/games-shared";
import { startGame } from "@/lib/game-actions";

type PlayerOpt = { id: string; name: string };

const OUT_MODES: { key: X01OutMode; label: string; hint: string }[] = [
  { key: "single", label: "Single out", hint: "Finish on anything" },
  { key: "double", label: "Double out", hint: "Must end on a double" },
  { key: "master", label: "Master out", hint: "Double or triple" },
];

const CRICKET_SCORING: {
  key: CricketScoringMode;
  label: string;
  hint: string;
}[] = [
  { key: "normal", label: "Normal", hint: "Score points on open numbers" },
  { key: "cutthroat", label: "Cut-throat", hint: "Points go to opponents · lowest wins" },
];

function usePersistentState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {}
  }, [key]);
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue];
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function NewGameForm({
  mode,
  players,
  heading,
}: {
  mode: GameMode;
  players: PlayerOpt[];
  heading?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [startScore, setStartScore] = usePersistentState<X01StartScore>(
    "dartsly.x01.startScore",
    501,
  );
  const [outMode, setOutMode] = usePersistentState<X01OutMode>(
    "dartsly.x01.outMode",
    "single",
  );
  const [cricketScoring, setCricketScoring] = usePersistentState<CricketScoringMode>(
    "dartsly.cricket.scoringMode",
    "normal",
  );
  const [cricketCap, setCricketCap] = usePersistentState<boolean>(
    "dartsly.cricket.pointsCap",
    true,
  );
  const [killerRules, setKillerRules] = usePersistentState<KillerRules>(
    "dartsly.killer.rules",
    "progressive",
  );
  const [killerLives, setKillerLives] = usePersistentState<3 | 5>(
    "dartsly.killer.startLives",
    3,
  );
  const [killerAssignment, setKillerAssignment] = usePersistentState<KillerAssignment>(
    "dartsly.killer.assignment",
    "random",
  );
  const [killerSelfRule, setKillerSelfRule] = usePersistentState<KillerSelfRule>(
    "dartsly.killer.selfRule",
    "safe",
  );
  const [killerTargets, setKillerTargets] = useState<Record<string, number>>({});
  const [randomOrder, setRandomOrder] = usePersistentState<boolean>(
    "dartsly.randomOrder",
    false,
  );
  const [pending, start] = useTransition();

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const canStart = selected.length >= 2 && !pending;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 pt-6 pb-6 w-full flex flex-col gap-8">
          {heading}
      {mode === "x01" && (
        <section className="flex flex-col gap-4">
          <SectionLabel>Start score</SectionLabel>
          <div className="grid grid-cols-5 gap-2">
            {X01_START_SCORES.map((s) => {
              const active = s === startScore;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStartScore(s)}
                  className={[
                    "h-14 rounded-xl border font-display tabular font-black text-lg transition-all",
                    active
                      ? "bg-[var(--dart-gold)] text-[var(--field)] border-transparent shadow-[0_0_0_2px_var(--dart-gold)]"
                      : "bg-card/60 border-border text-muted-foreground hover:text-foreground hover:border-foreground/40",
                  ].join(" ")}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {mode === "cricket" && (
        <section className="flex flex-col gap-4">
          <SectionLabel>Scoring</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {CRICKET_SCORING.map((o) => {
              const active = o.key === cricketScoring;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setCricketScoring(o.key)}
                  className={[
                    "rounded-xl border px-3 py-3 flex flex-col items-start gap-1 text-left transition-all",
                    active
                      ? "bg-card border-transparent shadow-[0_0_0_2px_var(--dart-gold)]"
                      : "bg-card/60 border-border hover:border-foreground/40",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "font-display uppercase text-xs tracking-[0.25em]",
                      active ? "text-[var(--dart-gold)]" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {o.label}
                  </span>
                  <span className="text-[0.7rem] text-muted-foreground leading-tight">
                    {o.hint}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setCricketCap(!cricketCap)}
            aria-pressed={cricketCap}
            className={[
              "rounded-xl border px-4 py-3 flex items-center justify-between text-left transition-all",
              cricketCap
                ? "bg-card border-transparent shadow-[0_0_0_2px_var(--dart-gold)]"
                : "bg-card/60 border-border hover:border-foreground/40",
            ].join(" ")}
          >
            <span className="flex flex-col gap-0.5">
              <span
                className={[
                  "font-display uppercase text-xs tracking-[0.25em]",
                  cricketCap ? "text-[var(--dart-gold)]" : "text-muted-foreground",
                ].join(" ")}
              >
                Points cap
              </span>
              <span className="text-[0.7rem] text-muted-foreground leading-tight">
                {cricketScoring === "cutthroat"
                  ? "Stops giving points once everyone has closed"
                  : "Stops scoring once all opponents have closed"}
              </span>
            </span>
            <span
              className={[
                "h-6 w-10 rounded-full border relative transition-colors shrink-0",
                cricketCap
                  ? "bg-[var(--dart-gold)] border-transparent"
                  : "bg-card/60 border-border",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-0.5 size-5 rounded-full bg-[var(--field)] transition-all",
                  cricketCap ? "left-[1.125rem]" : "left-0.5 bg-muted-foreground/60",
                ].join(" ")}
              />
            </span>
          </button>
        </section>
      )}

      {mode === "x01" && (
        <section className="flex flex-col gap-4">
          <SectionLabel>Out rule</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {OUT_MODES.map((o) => {
              const active = o.key === outMode;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setOutMode(o.key)}
                  className={[
                    "rounded-xl border px-3 py-3 flex flex-col items-start gap-1 text-left transition-all",
                    active
                      ? "bg-card border-transparent shadow-[0_0_0_2px_var(--dart-gold)]"
                      : "bg-card/60 border-border hover:border-foreground/40",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "font-display uppercase text-xs tracking-[0.25em]",
                      active ? "text-[var(--dart-gold)]" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {o.label}
                  </span>
                  <span className="text-[0.7rem] text-muted-foreground leading-tight">
                    {o.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {mode === "killer" && (
        <section className="flex flex-col gap-4">
          <SectionLabel>Rules</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                {
                  key: "progressive",
                  label: "Progressive",
                  hint: "Start at 0 · 3 hits arms you · any hit damages · die at −1",
                },
                {
                  key: "standard",
                  label: "Standard",
                  hint: "Lives countdown · doubles only to arm & attack",
                },
              ] as { key: KillerRules; label: string; hint: string }[]
            ).map((o) => {
              const active = o.key === killerRules;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setKillerRules(o.key)}
                  className={[
                    "rounded-xl border px-3 py-3 flex flex-col items-start gap-1 text-left transition-all",
                    active
                      ? "bg-card border-transparent shadow-[0_0_0_2px_var(--dart-gold)]"
                      : "bg-card/60 border-border hover:border-foreground/40",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "font-display uppercase text-xs tracking-[0.25em]",
                      active ? "text-[var(--dart-gold)]" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {o.label}
                  </span>
                  <span className="text-[0.7rem] text-muted-foreground leading-tight">
                    {o.hint}
                  </span>
                </button>
              );
            })}
          </div>

          {killerRules === "standard" && (
            <>
              <SectionLabel>Lives</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {([3, 5] as const).map((n) => {
                  const active = killerLives === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setKillerLives(n)}
                      className={[
                        "h-14 rounded-xl border font-display tabular font-black text-lg transition-all",
                        active
                          ? "bg-[var(--dart-gold)] text-[var(--field)] border-transparent shadow-[0_0_0_2px_var(--dart-gold)]"
                          : "bg-card/60 border-border text-muted-foreground hover:text-foreground hover:border-foreground/40",
                      ].join(" ")}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {killerRules === "standard" && (
            <>
          <SectionLabel>Self-double rule</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { key: "safe", label: "Safe", hint: "Re-hitting own double is harmless" },
                { key: "suicide", label: "Suicide", hint: "Own double after armed = lose a life" },
              ] as { key: KillerSelfRule; label: string; hint: string }[]
            ).map((o) => {
              const active = o.key === killerSelfRule;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setKillerSelfRule(o.key)}
                  className={[
                    "rounded-xl border px-3 py-3 flex flex-col items-start gap-1 text-left transition-all",
                    active
                      ? "bg-card border-transparent shadow-[0_0_0_2px_var(--dart-gold)]"
                      : "bg-card/60 border-border hover:border-foreground/40",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "font-display uppercase text-xs tracking-[0.25em]",
                      active ? "text-[var(--dart-gold)]" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {o.label}
                  </span>
                  <span className="text-[0.7rem] text-muted-foreground leading-tight">
                    {o.hint}
                  </span>
                </button>
              );
            })}
          </div>
            </>
          )}

          <SectionLabel>Target assignment</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { key: "random", label: "Random", hint: "Auto-assigned on start" },
                { key: "manual", label: "Pick", hint: "Choose each player's target" },
              ] as { key: KillerAssignment; label: string; hint: string }[]
            ).map((o) => {
              const active = o.key === killerAssignment;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setKillerAssignment(o.key)}
                  className={[
                    "rounded-xl border px-3 py-3 flex flex-col items-start gap-1 text-left transition-all",
                    active
                      ? "bg-card border-transparent shadow-[0_0_0_2px_var(--dart-gold)]"
                      : "bg-card/60 border-border hover:border-foreground/40",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "font-display uppercase text-xs tracking-[0.25em]",
                      active ? "text-[var(--dart-gold)]" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {o.label}
                  </span>
                  <span className="text-[0.7rem] text-muted-foreground leading-tight">
                    {o.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionLabel>Players</SectionLabel>
          <button
            type="button"
            onClick={() => setRandomOrder(!randomOrder)}
            aria-pressed={randomOrder}
            className={[
              "flex items-center gap-2 h-8 px-3 rounded-full border text-[0.65rem] font-display uppercase tracking-[0.25em] transition-all",
              randomOrder
                ? "bg-[var(--dart-gold)] text-[var(--field)] border-transparent"
                : "bg-card/60 border-border text-muted-foreground hover:text-foreground hover:border-foreground/40",
            ].join(" ")}
          >
            <Shuffle className="size-3.5" />
            Random order
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-snug">
          {randomOrder
            ? "Tap to include players. Play order will be randomised on start."
            : "Tap in the order of play."}
        </p>
        <ul className="flex flex-col gap-2">
          {players.map((p) => {
            const idx = selected.indexOf(p.id);
            const picked = idx >= 0;
            const showKillerPick =
              picked && mode === "killer" && killerAssignment === "manual";
            return (
              <li key={p.id} className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={[
                    "w-full flex items-center justify-between rounded-xl border px-4 h-14 text-left transition-all",
                    picked
                      ? "bg-card border-transparent shadow-[0_0_0_2px_var(--dart-gold)]"
                      : "bg-card/60 border-border hover:border-foreground/40",
                  ].join(" ")}
                >
                  <span className="font-display uppercase tracking-[0.18em] text-sm">
                    {p.name}
                  </span>
                  <span className="flex items-center gap-2">
                    {showKillerPick && killerTargets[p.id] && (
                      <span className="font-display uppercase text-[0.65rem] tracking-[0.25em] text-[var(--dart-red)] font-extrabold">
                        D{killerTargets[p.id] === 25 ? "Bull" : killerTargets[p.id]}
                      </span>
                    )}
                    {picked && !randomOrder && (
                      <span className="font-display tabular text-xl text-[var(--dart-gold)]">
                        {idx + 1}
                      </span>
                    )}
                    {picked && randomOrder && (
                      <Shuffle className="size-4 text-[var(--dart-gold)]" />
                    )}
                  </span>
                </button>
                {showKillerPick && (
                  <TargetPicker
                    value={killerTargets[p.id]}
                    taken={Object.entries(killerTargets)
                      .filter(([pid, v]) => pid !== p.id && typeof v === "number")
                      .map(([, v]) => v as number)}
                    onChange={(n) =>
                      setKillerTargets((prev) => ({ ...prev, [p.id]: n }))
                    }
                  />
                )}
              </li>
            );
          })}
        </ul>
      </section>

        </div>
      </div>
      <div
        className="shrink-0 border-t border-border/60 bg-gradient-to-t from-background via-background to-background/90 backdrop-blur-md"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-3xl mx-auto px-4 pt-3 w-full">
          <button
            type="button"
            disabled={!canStart}
            onClick={() =>
              start(async () => {
                const ids = randomOrder ? shuffle(selected) : selected;
                let config: unknown = undefined;
                if (mode === "x01") config = { startScore, outMode };
                else if (mode === "cricket")
                  config = { scoringMode: cricketScoring, pointsCap: cricketCap };
                else if (mode === "killer") {
                  const targets = buildKillerTargets(
                    ids,
                    killerAssignment,
                    killerTargets,
                  );
                  if (!targets) {
                    toast.error("Pick a target for every player");
                    return;
                  }
                  config = {
                    rules: killerRules,
                    startLives: killerLives,
                    assignment: killerAssignment,
                    selfRule: killerSelfRule,
                    targets,
                  };
                }
                const res = await startGame({ mode, playerIds: ids, config });
                if (res?.error) toast.error(res.error);
                else if (res?.id) navigate(`/games/${res.id}`);
              })
            }
            className="w-full h-14 rounded-xl bg-[var(--dart-gold)] text-[var(--field)] font-display font-extrabold uppercase tracking-[0.3em] text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            {pending ? "Starting…" : "Start game"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-display uppercase text-[0.7rem] tracking-[0.3em] text-muted-foreground">
      {children}
    </div>
  );
}

const KILLER_TARGETS = [...Array.from({ length: 20 }, (_, i) => i + 1), 25];

function buildKillerTargets(
  orderedIds: string[],
  assignment: KillerAssignment,
  manual: Record<string, number>,
): number[] | null {
  if (assignment === "manual") {
    const used = new Set<number>();
    const out: number[] = [];
    for (const id of orderedIds) {
      const n = manual[id];
      if (!n || used.has(n)) return null;
      used.add(n);
      out.push(n);
    }
    return out;
  }
  const pool = shuffle(KILLER_TARGETS);
  return orderedIds.map((_, i) => pool[i]);
}

function TargetPicker({
  value,
  taken,
  onChange,
}: {
  value: number | undefined;
  taken: number[];
  onChange: (n: number) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-1 rounded-xl border border-border/60 bg-card/40 p-2">
      {KILLER_TARGETS.map((n) => {
        const isTaken = taken.includes(n) && value !== n;
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            disabled={isTaken}
            onClick={() => onChange(n)}
            className={[
              "h-8 rounded-md border font-display font-black text-xs transition-all active:scale-[0.96]",
              active
                ? "bg-[var(--dart-red-dim)] border-[var(--dart-red)] text-[var(--dart-cream)]"
                : isTaken
                  ? "bg-card/30 border-border/40 text-muted-foreground/40 cursor-not-allowed"
                  : "bg-card border-border text-foreground hover:border-foreground/40",
            ].join(" ")}
          >
            {n === 25 ? "Bull" : n}
          </button>
        );
      })}
    </div>
  );
}

const MODE_LABEL: Record<GameMode, string> = {
  x01: "X01",
  cricket: "Cricket",
  killer: "Killer",
};

function Heading({ mode }: { mode: GameMode }) {
  return (
    <div>
      <div className="font-display text-xs tracking-[0.4em] uppercase text-muted-foreground">
        New leg
      </div>
      <h1 className="font-display font-black text-4xl uppercase mt-1 leading-none">
        {MODE_LABEL[mode]}
      </h1>
    </div>
  );
}

export default function NewGamePage() {
  const [params] = useSearchParams();
  const modeParam = params.get("mode");
  const mode: GameMode =
    modeParam === "cricket" || modeParam === "killer" ? modeParam : "x01";

  const players = useLiveQuery(
    () => db.players.orderBy("name").toArray(),
    [],
    [] as PlayerOpt[],
  );

  if (players.length < 2) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 pt-6 pb-6 w-full flex flex-col gap-4">
          <Heading mode={mode} />
          <p className="text-sm text-muted-foreground">
            You need at least 2 players.{" "}
            <Link to="/players" className="text-foreground underline underline-offset-4">
              Add players
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <NewGameForm
      mode={mode}
      players={players.map((p) => ({ id: p.id, name: p.name }))}
      heading={<Heading mode={mode} />}
    />
  );
}
