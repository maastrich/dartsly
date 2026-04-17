"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Undo2, CheckCircle2, Home } from "lucide-react";
import type { Game, GameEvent } from "@/lib/db/schema";
import type { CricketConfig, CricketTarget } from "@/lib/games/shared";

function normalizeConfig(raw: Partial<CricketConfig> | null | undefined): CricketConfig {
  return {
    scoringMode: raw?.scoringMode ?? "normal",
    pointsCap: raw?.pointsCap ?? true,
  };
}
import {
  finishGame,
  recordThrow,
  endVisitEarly,
  undoLastThrow,
} from "../actions";

type Participant = { id: string; playerId: string; position: number; name: string };
type Multiplier = 1 | 2 | 3;

type PerThrowData = {
  value: number;
  multiplier: Multiplier;
  throwIndex: number;
  endsVisit?: boolean;
};

const TARGETS: CricketTarget[] = ["20", "19", "18", "17", "16", "15", "25"];

function targetValue(t: CricketTarget) {
  return t === "25" ? 25 : Number(t);
}

function targetLabel(t: CricketTarget) {
  return t === "25" ? "Bull" : t;
}

function haptic(ms = 8) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(ms);
  }
}

export function CricketBoard({
  game,
  participants,
  events,
}: {
  game: Game;
  participants: Participant[];
  events: GameEvent[];
}) {
  const router = useRouter();
  const config = normalizeConfig(game.config as Partial<CricketConfig>);
  const [pending, start] = useTransition();
  const [multiplier, setMultiplier] = useState<Multiplier>(1);

  const state = useMemo(
    () => deriveState(config, participants, events),
    [config, participants, events],
  );

  const isFinished = game.status !== "in_progress";
  const currentParticipant = state.winner ?? participants[state.turnIndex];
  const activeVisit =
    state.activeVisit && state.activeVisit.participantId === currentParticipant.id
      ? state.activeVisit
      : null;
  const visitThrows = activeVisit?.throws ?? [];

  function nextRoundIndexFor(participantId: string) {
    if (activeVisit && activeVisit.participantId === participantId) {
      return activeVisit.roundIndex;
    }
    return state.rounds[participantId];
  }

  function pressTarget(value: number) {
    if (isFinished || pending) return;
    if (visitThrows.length >= 3) return;
    if (value === 25 && multiplier === 3) {
      haptic(20);
      toast.error("No triple bull");
      return;
    }
    const effectiveMultiplier: Multiplier = value === 0 ? 1 : multiplier;
    const throwIndex = visitThrows.length;
    const roundIndex = nextRoundIndexFor(currentParticipant.id);
    const post = applyThrow(
      state,
      participants,
      config,
      currentParticipant.id,
      value,
      effectiveMultiplier,
    );
    const wouldWin = !!post.winnerId;
    const shouldEnd = throwIndex === 2 || wouldWin;

    setMultiplier(1);
    haptic(10);
    start(async () => {
      const res = await recordThrow({
        gameId: game.id,
        participantId: currentParticipant.id,
        roundIndex,
        throwIndex,
        value,
        multiplier: effectiveMultiplier,
        endsVisit: shouldEnd,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      if (wouldWin && post.winnerId) {
        const winner = participants.find((p) => p.id === post.winnerId);
        await finishGame({
          gameId: game.id,
          winnerParticipantId: post.winnerId,
          participantStats: computeFinalStats(participants, events, {
            pid: currentParticipant.id,
            target: value,
            multiplier: effectiveMultiplier,
          }),
        });
        toast.success(`${winner?.name ?? "Player"} wins!`);
        haptic(40);
      }
      router.refresh();
    });
  }

  function endTurn() {
    if (isFinished || pending) return;
    if (!activeVisit || activeVisit.throws.length === 0) return;
    haptic(10);
    start(async () => {
      const res = await endVisitEarly({
        gameId: game.id,
        eventId: activeVisit.lastEventId,
      });
      if (res?.error) toast.error(res.error);
      router.refresh();
    });
  }

  function undo() {
    if (isFinished || pending) return;
    haptic(6);
    start(async () => {
      const res = await undoLastThrow(game.id);
      if (res?.error) toast.error(res.error);
      router.refresh();
    });
  }

  const ordered = splitLayout(participants);

  return (
    <div className="h-full flex flex-col field-grid overflow-hidden">
      <div className="flex items-center justify-between px-3 pt-2 pb-1 shrink-0">
        <Link
          href="/"
          aria-label="Home"
          className="h-8 w-8 grid place-items-center rounded-full bg-card/60 border border-border/60 text-muted-foreground hover:text-foreground transition"
        >
          <Home className="size-3.5" />
        </Link>
        <div className="text-center font-display text-[0.6rem] tracking-[0.35em] text-muted-foreground uppercase">
          Cricket
          <span
            className={[
              "ml-2",
              config.scoringMode === "cutthroat"
                ? "text-[var(--dart-red)]"
                : "text-muted-foreground/70",
            ].join(" ")}
          >
            {config.scoringMode === "cutthroat" ? "CUT-THROAT" : "NORMAL"}
          </span>
        </div>
        <div className="w-8" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-1">
        <CricketGrid
          left={ordered.left}
          right={ordered.right}
          state={state}
          currentId={isFinished ? state.winner?.id : currentParticipant.id}
          winnerId={isFinished ? game.winnerParticipantId : null}
        />
      </div>

      <div className="shrink-0 flex flex-col gap-1.5 px-3 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-background via-background to-background/90">
        {!isFinished && (
          <>
            <MultiplierBar
              active={multiplier}
              onChange={(m) => {
                haptic(6);
                setMultiplier(m);
              }}
            />
            <CricketPad
              onPress={pressTarget}
              onUndo={undo}
              onEnd={endTurn}
              canEnd={visitThrows.length > 0 && visitThrows.length < 3}
              canUndo={events.length > 0 || visitThrows.length > 0}
              disabled={visitThrows.length >= 3 || pending}
              pending={pending}
            />
          </>
        )}
        {isFinished && <FinishedPanel winner={state.winner?.name ?? "—"} />}
      </div>
    </div>
  );
}

/* ─── Grid ───────────────────────────────────────────────────────────── */

function CricketGrid({
  left,
  right,
  state,
  currentId,
  winnerId,
}: {
  left: Participant[];
  right: Participant[];
  state: ReturnType<typeof deriveState>;
  currentId: string | null | undefined;
  winnerId: string | null | undefined;
}) {
  const cols = [...left.map((p) => ({ p })), null, ...right.map((p) => ({ p }))];
  const gridTemplate = cols
    .map((c) => (c === null ? "minmax(3.5rem,auto)" : "minmax(0,1fr)"))
    .join(" ");

  return (
    <div className="rounded-xl overflow-hidden border border-border/60 bg-card/30">
      <div
        className="grid"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {cols.map((c, i) =>
          c === null ? (
            <HeaderCell key={`h-c-${i}`} center />
          ) : (
            <HeaderCell
              key={`h-${c.p.id}`}
              name={c.p.name}
              score={state.score[c.p.id]}
              isCurrent={c.p.id === currentId && !winnerId}
              isWinner={c.p.id === winnerId}
            />
          ),
        )}

        {TARGETS.map((t) => (
          <Row key={t} target={t} cols={cols} state={state} />
        ))}

        {cols.map((c, i) =>
          c === null ? (
            <div
              key={`f-c-${i}`}
              className="bg-muted/40 border-t border-border/40"
            />
          ) : (
            <FooterCell key={`f-${c.p.id}`} stats={state.stats[c.p.id]} />
          ),
        )}
      </div>
    </div>
  );
}

function HeaderCell({
  name,
  score,
  isCurrent,
  isWinner,
  center,
}: {
  name?: string;
  score?: number;
  isCurrent?: boolean;
  isWinner?: boolean;
  center?: boolean;
}) {
  if (center) {
    return <div className="bg-muted/40 border-b border-border/40" aria-hidden />;
  }
  return (
    <div
      className={[
        "px-2 py-2 text-center border-b border-border/40 relative",
        isCurrent ? "bg-card" : "bg-card/50",
      ].join(" ")}
    >
      {isCurrent && !isWinner && (
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--dart-gold)]" />
      )}
      {isWinner && (
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--dart-green)]" />
      )}
      <div
        className={[
          "font-display uppercase text-[0.6rem] tracking-[0.22em] truncate leading-tight",
          isCurrent ? "text-[var(--dart-gold)]" : "text-muted-foreground",
        ].join(" ")}
      >
        {name}
      </div>
      <div
        className={[
          "font-display tabular font-black leading-none mt-1",
          isWinner ? "text-[var(--dart-green)] text-xl" : "text-lg",
        ].join(" ")}
      >
        {score}
      </div>
    </div>
  );
}

function Row({
  target,
  cols,
  state,
}: {
  target: CricketTarget;
  cols: ({ p: Participant } | null)[];
  state: ReturnType<typeof deriveState>;
}) {
  const allClosed = cols
    .filter((c): c is { p: Participant } => c !== null)
    .every((c) => (state.marks[c.p.id]?.[target] ?? 0) >= 3);
  const isBull = target === "25";

  return (
    <>
      {cols.map((c, i) => {
        if (c === null) {
          return (
            <div
              key={`t-${target}-c`}
              className={[
                "grid place-items-center border-b border-border/30 font-display font-black h-11",
                isBull
                  ? "bg-[var(--dart-red)] text-[var(--dart-cream)]"
                  : allClosed
                    ? "bg-muted/60 text-muted-foreground line-through"
                    : "bg-[var(--dart-green)] text-[var(--dart-cream)]",
              ].join(" ")}
            >
              {targetLabel(target)}
            </div>
          );
        }
        const marks = state.marks[c.p.id]?.[target] ?? 0;
        return (
          <div
            key={`t-${target}-${c.p.id}`}
            className="grid place-items-center h-11 border-b border-border/30 bg-card/40"
          >
            <MarkGlyph marks={marks} />
          </div>
        );
      })}
    </>
  );
}

function MarkGlyph({ marks }: { marks: number }) {
  if (marks <= 0) return null;
  if (marks === 1) return <Slash />;
  if (marks === 2) return <Cross />;
  return <ClosedX />;
}

function Slash() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-label="1 mark">
      <line
        x1="5"
        y1="19"
        x2="19"
        y2="5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Cross() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-label="2 marks">
      <line x1="5" y1="19" x2="19" y2="5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function ClosedX() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 text-[var(--dart-gold)]" aria-label="closed">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="6" y1="18" x2="18" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FooterCell({ stats }: { stats: { rounds: number; marks: number; mpr: number } }) {
  return (
    <div className="px-2 py-1.5 text-[0.55rem] leading-tight text-muted-foreground border-t border-border/40 bg-card/40">
      <div className="flex items-center gap-1 whitespace-nowrap">
        <span className="tabular font-semibold text-foreground">{stats.rounds}</span>
        <span className="uppercase tracking-[0.15em]">rds</span>
      </div>
      <div className="flex items-center gap-1 whitespace-nowrap">
        <span className="uppercase tracking-[0.15em]">mpr</span>
        <span className="tabular font-semibold text-foreground">{stats.mpr.toFixed(2)}</span>
      </div>
    </div>
  );
}

/* ─── Multiplier bar (same as X01) ───────────────────────────────────── */

function MultiplierBar({
  active,
  onChange,
}: {
  active: Multiplier;
  onChange: (m: Multiplier) => void;
}) {
  const items: { m: Multiplier; label: string; ring: string; fill: string }[] = [
    { m: 1, label: "Single", ring: "ring-border", fill: "bg-card/70" },
    { m: 2, label: "Double", ring: "ring-[var(--dart-blue)]", fill: "bg-[var(--dart-blue-dim)]" },
    { m: 3, label: "Triple", ring: "ring-[var(--dart-magenta)]", fill: "bg-[var(--dart-magenta-dim)]" },
  ];
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {items.map((it) => {
        const isActive = active === it.m;
        return (
          <button
            key={it.m}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(isActive ? 1 : it.m)}
            className={[
              "h-9 rounded-lg border font-display text-[0.8rem] font-extrabold tracking-[0.22em] uppercase transition-all",
              isActive
                ? `${it.fill} border-transparent ring-2 ${it.ring} text-[var(--dart-cream)]`
                : "bg-card/60 border-border text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Number pad (targets only) ──────────────────────────────────────── */

function CricketPad({
  onPress,
  onUndo,
  onEnd,
  canEnd,
  canUndo,
  disabled,
  pending,
}: {
  onPress: (n: number) => void;
  onUndo: () => void;
  onEnd: () => void;
  canEnd: boolean;
  canUndo: boolean;
  disabled?: boolean;
  pending?: boolean;
}) {
  const buttons = [
    { value: 15, label: "15" },
    { value: 16, label: "16" },
    { value: 17, label: "17" },
    { value: 18, label: "18" },
    { value: 19, label: "19" },
    { value: 20, label: "20" },
    { value: 25, label: "Bull", accent: "bull" as const },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <div role="group" aria-label="Targets" className="grid grid-cols-7 gap-1.5">
        {buttons.map((b) => (
          <button
            key={b.value}
            type="button"
            disabled={disabled}
            onClick={() => onPress(b.value)}
            className={[
              "h-12 rounded-lg border font-display font-black transition-all active:scale-[0.96] text-sm",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              b.accent === "bull"
                ? "bg-[var(--dart-red-dim)] border-[var(--dart-red)]/60 text-[var(--dart-cream)]"
                : "bg-card border-border text-foreground hover:border-foreground/40",
            ].join(" ")}
          >
            {b.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        <button
          type="button"
          onClick={() => onPress(0)}
          disabled={disabled}
          className="col-span-2 h-11 rounded-lg border border-border bg-card/60 text-muted-foreground font-display text-xs uppercase tracking-[0.3em] hover:text-foreground hover:border-foreground/40 transition disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          Miss
        </button>
        <button
          type="button"
          onClick={onUndo}
          disabled={pending || !canUndo}
          aria-label="Undo"
          className="col-span-2 h-11 rounded-lg border border-border bg-card/60 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition disabled:opacity-30 disabled:cursor-not-allowed grid place-items-center active:scale-[0.98]"
        >
          <Undo2 className="size-4" />
        </button>
        <button
          type="button"
          onClick={onEnd}
          disabled={pending || !canEnd}
          aria-label="End turn"
          className="col-span-3 h-11 rounded-lg bg-[var(--dart-gold)] text-[var(--field)] font-display text-[0.7rem] uppercase tracking-[0.3em] font-extrabold transition disabled:opacity-25 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 className="size-4" /> End turn
        </button>
      </div>
    </div>
  );
}

/* ─── Finished panel ─────────────────────────────────────────────────── */

function FinishedPanel({ winner }: { winner: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-4 text-center">
      <div className="font-display text-[0.65rem] tracking-[0.4em] uppercase text-muted-foreground">
        Leg won by
      </div>
      <div className="font-display font-black text-4xl text-[var(--dart-green)]">
        {winner}
      </div>
      <Link
        href="/"
        className="mt-2 inline-flex items-center justify-center h-11 px-6 rounded-lg bg-[var(--dart-gold)] text-[var(--field)] font-display text-xs uppercase tracking-[0.3em] font-extrabold"
      >
        New game
      </Link>
    </div>
  );
}

/* ─── State derivation & helpers ─────────────────────────────────────── */

type MarksByTarget = Partial<Record<CricketTarget, number>>;

type ActiveVisit = {
  participantId: string;
  roundIndex: number;
  throws: { value: number; multiplier: Multiplier }[];
  lastEventId: string;
};

function splitLayout(participants: Participant[]) {
  if (participants.length === 2) {
    return { left: [participants[0]], right: [participants[1]] };
  }
  const mid = Math.ceil(participants.length / 2);
  return {
    left: participants.slice(0, mid),
    right: participants.slice(mid),
  };
}

function isCricketTarget(v: number): v is 15 | 16 | 17 | 18 | 19 | 20 | 25 {
  return v === 15 || v === 16 || v === 17 || v === 18 || v === 19 || v === 20 || v === 25;
}

function targetKey(v: number): CricketTarget | null {
  if (!isCricketTarget(v)) return null;
  return String(v) as CricketTarget;
}

function deriveState(
  config: CricketConfig,
  participants: Participant[],
  events: GameEvent[],
) {
  const marks: Record<string, MarksByTarget> = {};
  const score: Record<string, number> = {};
  const dartsThrown: Record<string, number> = {};
  const totalMarks: Record<string, number> = {};
  const rounds: Record<string, number> = {};
  for (const p of participants) {
    marks[p.id] = {};
    score[p.id] = 0;
    dartsThrown[p.id] = 0;
    totalMarks[p.id] = 0;
    rounds[p.id] = 0;
  }

  const inProgress: Record<string, ActiveVisit> = {};
  const sorted = [...events].sort((a, b) => {
    const t = a.createdAt.getTime() - b.createdAt.getTime();
    if (t !== 0) return t;
    return a.id < b.id ? -1 : 1;
  });

  for (const ev of sorted) {
    const pid = ev.participantId;
    const d = ev.data as PerThrowData;
    if (!inProgress[pid] || inProgress[pid].roundIndex !== ev.roundIndex) {
      inProgress[pid] = {
        participantId: pid,
        roundIndex: ev.roundIndex,
        throws: [],
        lastEventId: ev.id,
      };
    }
    inProgress[pid].throws.push({ value: d.value, multiplier: d.multiplier });
    inProgress[pid].lastEventId = ev.id;
    dartsThrown[pid] += 1;

    applyHit(pid, d.value, d.multiplier, marks, score, totalMarks, participants, config);

    const shouldComplete = inProgress[pid].throws.length === 3 || d.endsVisit === true;
    if (shouldComplete) {
      rounds[pid] += 1;
      delete inProgress[pid];
    }
  }

  const stats: Record<string, { rounds: number; marks: number; mpr: number }> = {};
  for (const p of participants) {
    const r = rounds[p.id];
    stats[p.id] = {
      rounds: r,
      marks: totalMarks[p.id],
      mpr: r ? totalMarks[p.id] / r : 0,
    };
  }

  const winner = detectWinner(participants, marks, score, config.scoringMode);
  const activeVisit = Object.values(inProgress)[0] ?? null;

  let turnIndex = 0;
  if (winner) {
    turnIndex = participants.findIndex((p) => p.id === winner.id);
  } else if (activeVisit) {
    turnIndex = participants.findIndex((p) => p.id === activeVisit.participantId);
  } else {
    const minR = Math.min(...participants.map((p) => rounds[p.id]));
    const idx = participants.findIndex((p) => rounds[p.id] === minR);
    turnIndex = idx < 0 ? 0 : idx;
  }

  return { marks, score, rounds, stats, winner, turnIndex, activeVisit, dartsThrown };
}

function applyHit(
  pid: string,
  value: number,
  mult: Multiplier,
  marks: Record<string, MarksByTarget>,
  score: Record<string, number>,
  totalMarks: Record<string, number>,
  participants: Participant[],
  config: CricketConfig,
) {
  const t = targetKey(value);
  if (!t) return;
  const current = marks[pid][t] ?? 0;
  const remainingToClose = Math.max(0, 3 - current);
  const closing = Math.min(mult, remainingToClose);
  const excess = mult - closing;
  marks[pid][t] = current + mult;
  totalMarks[pid] += mult;

  if (excess > 0) {
    const opponents = participants.filter((p) => p.id !== pid);
    const openOpponents = opponents.filter(
      (p) => (marks[p.id]?.[t] ?? 0) < 3,
    );
    if (config.scoringMode === "cutthroat") {
      if (openOpponents.length > 0) {
        const pts = excess * targetValue(t);
        for (const op of openOpponents) {
          score[op.id] += pts;
        }
      }
    } else {
      const capped = config.pointsCap && openOpponents.length === 0;
      if (!capped) {
        score[pid] += excess * targetValue(t);
      }
    }
  }
}

function detectWinner(
  participants: Participant[],
  marks: Record<string, MarksByTarget>,
  score: Record<string, number>,
  scoringMode: "normal" | "cutthroat",
): Participant | null {
  const allClosed = (pid: string) =>
    TARGETS.every((t) => (marks[pid]?.[t] ?? 0) >= 3);
  const closers = participants.filter((p) => allClosed(p.id));
  if (closers.length === 0) return null;
  const scores = participants.map((p) => score[p.id]);
  const target = scoringMode === "cutthroat" ? Math.min(...scores) : Math.max(...scores);
  const winner = closers.find((p) => score[p.id] === target);
  return winner ?? null;
}

function applyThrow(
  _state: ReturnType<typeof deriveState>,
  participants: Participant[],
  config: CricketConfig,
  pid: string,
  value: number,
  mult: Multiplier,
) {
  const marks: Record<string, MarksByTarget> = {};
  const score: Record<string, number> = {};
  const totalMarks: Record<string, number> = {};
  for (const p of participants) {
    marks[p.id] = { ..._state.marks[p.id] };
    score[p.id] = _state.score[p.id];
    totalMarks[p.id] = _state.stats[p.id].marks;
  }
  applyHit(pid, value, mult, marks, score, totalMarks, participants, config);
  const w = detectWinner(participants, marks, score, config.scoringMode);
  return { winnerId: w?.id ?? null };
}

function computeFinalStats(
  participants: Participant[],
  events: GameEvent[],
  pending?: { pid: string; target: number; multiplier: Multiplier },
) {
  const dartsThrown: Record<string, number> = {};
  const totalMarks: Record<string, number> = {};
  const totalPoints: Record<string, number> = {};
  const roundsByPid: Record<string, Set<number>> = {};
  for (const p of participants) {
    dartsThrown[p.id] = 0;
    totalMarks[p.id] = 0;
    totalPoints[p.id] = 0;
    roundsByPid[p.id] = new Set();
  }

  for (const ev of events) {
    const d = ev.data as PerThrowData;
    dartsThrown[ev.participantId] += 1;
    totalMarks[ev.participantId] += targetKey(d.value) ? d.multiplier : 0;
    roundsByPid[ev.participantId].add(ev.roundIndex);
  }
  if (pending) {
    dartsThrown[pending.pid] += 1;
    totalMarks[pending.pid] += targetKey(pending.target) ? pending.multiplier : 0;
  }

  const stats: Record<string, Record<string, unknown>> = {};
  for (const p of participants) {
    const rounds = roundsByPid[p.id].size;
    stats[p.id] = {
      rounds,
      totalMarks: totalMarks[p.id],
      totalPoints: totalPoints[p.id],
      marksPerRound: rounds ? totalMarks[p.id] / rounds : 0,
      dartsThrown: dartsThrown[p.id],
    };
  }
  return stats;
}
