import { useMemo, useState, useTransition } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Undo2, CheckCircle2, Home } from "lucide-react";
import type { Game, GameEvent } from "@/lib/db";
import type { CricketConfig, CricketTarget } from "@/lib/games-shared";

function normalizeConfig(raw: Partial<CricketConfig> | null | undefined): CricketConfig {
  return {
    scoringMode: raw?.scoringMode ?? "normal",
    pointsCap: raw?.pointsCap ?? true,
  };
}
import { finishGame, recordThrow, endVisitEarly, undoLastThrow } from "@/lib/game-actions";

type Participant = { id: string; playerId: string; position: number; name: string };
type Multiplier = 1 | 2 | 3;

type PerThrowData = {
  value: number;
  multiplier: Multiplier;
  throwIndex: number;
  endsVisit?: boolean;
};

const TARGETS: CricketTarget[] = ["15", "16", "17", "18", "19", "20", "25"];

function targetValue(t: CricketTarget) {
  return t === "25" ? 25 : Number(t);
}

function targetLabel(t: CricketTarget) {
  return t === "25" ? "BULL" : t;
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
    });
  }

  function undo() {
    if (isFinished || pending) return;
    haptic(6);
    start(async () => {
      const res = await undoLastThrow(game.id);
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 pt-2 pb-1 shrink-0">
        <Link
          to="/"
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

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-1 flex">
        <CricketGrid
          participants={participants}
          state={state}
          currentId={isFinished ? state.winner?.id : currentParticipant.id}
          winnerId={isFinished ? game.winnerParticipantId : null}
          visitThrows={isFinished ? [] : visitThrows}
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
  participants,
  state,
  currentId,
  winnerId,
  visitThrows,
}: {
  participants: Participant[];
  state: ReturnType<typeof deriveState>;
  currentId: string | null | undefined;
  winnerId: string | null | undefined;
  visitThrows: { value: number; multiplier: Multiplier }[];
}) {
  const gridTemplate = `minmax(6rem,auto) repeat(${TARGETS.length},minmax(0,1fr)) minmax(4.5rem,auto)`;
  const gridRows = `auto repeat(${participants.length},minmax(0,1fr))`;
  const allClosedFor = (t: CricketTarget) =>
    participants.every((p) => (state.marks[p.id]?.[t] ?? 0) >= 3);

  return (
    <div className="flex-1 rounded-xl overflow-hidden border border-border/60 bg-card/30">
      <div
        className="grid h-full"
        style={{ gridTemplateColumns: gridTemplate, gridTemplateRows: gridRows }}
      >
        {/* Header row: [empty] | target labels | "Score" */}
        <div
          aria-hidden
          className="bg-muted/40 border-b border-border/60 border-r border-border/60"
        />
        {TARGETS.map((t, i) => {
          const isBull = t === "25";
          const closed = allClosedFor(t);
          const isLastTarget = i === TARGETS.length - 1;
          return (
            <div
              key={`th-${t}`}
              className={[
                "grid place-items-center h-11 border-b border-border/60 font-display font-black text-sm relative",
                isLastTarget ? "" : "border-r border-border/60",
                isBull
                  ? "bg-[var(--dart-red-dim)] text-[var(--dart-cream)]"
                  : closed
                    ? "bg-card/40 text-muted-foreground/60"
                    : "bg-[var(--dart-green-dim)] text-[var(--dart-cream)]",
              ].join(" ")}
            >
              {targetLabel(t)}
              {closed && !isBull && (
                <span
                  aria-hidden
                  className="absolute inset-x-2 top-1/2 h-[2px] -translate-y-1/2 bg-muted-foreground/60"
                />
              )}
            </div>
          );
        })}
        <div
          aria-hidden
          className="grid place-items-center bg-muted/40 border-b border-border/60 border-l border-border/60 font-display uppercase text-[0.55rem] tracking-[0.2em] text-muted-foreground"
        >
          Score
        </div>

        {/* Player rows */}
        {participants.map((p, idx) => {
          const isCurrent = p.id === currentId && !winnerId;
          const isWinner = p.id === winnerId;
          const isLast = idx === participants.length - 1;
          return (
            <PlayerRow
              key={p.id}
              participant={p}
              score={state.score[p.id] ?? 0}
              stats={state.stats[p.id]}
              marksByTarget={TARGETS.map((t) => state.marks[p.id]?.[t] ?? 0)}
              isCurrent={isCurrent}
              isWinner={isWinner}
              isLast={isLast}
              visitThrows={isCurrent ? visitThrows : []}
            />
          );
        })}
      </div>
    </div>
  );
}

function PlayerRow({
  participant,
  score,
  stats,
  marksByTarget,
  isCurrent,
  isWinner,
  isLast,
  visitThrows,
}: {
  participant: Participant;
  score: number;
  stats: { rounds: number; marks: number; mpr: number };
  marksByTarget: number[];
  isCurrent: boolean;
  isWinner: boolean;
  isLast: boolean;
  visitThrows: { value: number; multiplier: Multiplier }[];
}) {
  const rowBg = isCurrent
    ? "bg-[var(--dart-gold)]/[0.11]"
    : isWinner
      ? "bg-[var(--dart-green)]/[0.11]"
      : "bg-card/40";
  const rowBorder = isLast ? "" : "border-b border-border/50";
  return (
    <>
      <div
        className={[
          "relative px-3 py-2 border-r border-border/60 flex flex-col justify-center",
          rowBg,
          rowBorder,
        ].join(" ")}
      >
        {isCurrent && !isWinner && (
          <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-[var(--dart-gold)]" />
        )}
        {isWinner && (
          <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-[var(--dart-green)]" />
        )}
        <div
          className={[
            "font-display font-black uppercase text-xl sm:text-2xl tracking-tight truncate leading-none",
            isCurrent
              ? "text-[var(--dart-gold)]"
              : isWinner
                ? "text-[var(--dart-green)]"
                : "text-foreground/90",
          ].join(" ")}
        >
          {participant.name}
        </div>
        <div className="mt-2 text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground/70 font-display flex flex-col gap-0.5 leading-tight">
          <span className="flex items-baseline gap-1.5">
            <span className="tabular font-bold text-foreground/90 w-8 text-right text-xs">
              {stats.mpr.toFixed(2)}
            </span>
            <span>mpr</span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="tabular font-bold text-foreground/90 w-8 text-right text-xs">
              {stats.rounds}
            </span>
            <span>rds</span>
          </span>
        </div>
        {isCurrent && !isWinner && (
          <div className="mt-2">
            <VisitThrowSlots throws={visitThrows} />
          </div>
        )}
      </div>
      {marksByTarget.map((marks, i) => {
        const isLastTarget = i === marksByTarget.length - 1;
        return (
          <div
            key={`mk-${participant.id}-${TARGETS[i]}`}
            className={[
              "grid place-items-center",
              isLastTarget ? "" : "border-r border-border/50",
              rowBg,
              rowBorder,
            ].join(" ")}
          >
            <MarkGlyph marks={marks} />
          </div>
        );
      })}
      <div
        className={[
          "grid place-items-center border-l border-border/60 font-display tabular font-black leading-none text-4xl sm:text-5xl",
          isWinner
            ? "text-[var(--dart-green)]"
            : isCurrent
              ? "text-[var(--dart-gold)]"
              : "text-foreground",
          rowBg,
          rowBorder,
        ].join(" ")}
      >
        {score}
      </div>
    </>
  );
}

function VisitThrowSlots({ throws }: { throws: { value: number; multiplier: Multiplier }[] }) {
  const slots = [0, 1, 2];
  return (
    <div className="grid grid-cols-3 gap-1">
      {slots.map((i) => {
        const t = throws[i];
        if (!t) {
          return (
            <div
              key={i}
              aria-hidden
              className="h-6 rounded-sm border border-dashed border-border/40 bg-background/20 grid place-items-center font-display text-[0.55rem] text-muted-foreground/40 tabular"
            >
              {i + 1}
            </div>
          );
        }
        const prefix =
          t.value === 0 ? "" : t.multiplier === 2 ? "D" : t.multiplier === 3 ? "T" : "";
        const label = t.value === 0 ? "—" : t.value === 25 ? "B" : `${prefix}${t.value}`;
        const color =
          t.value === 0
            ? "bg-card/40 border-border/40 text-muted-foreground"
            : t.multiplier === 2
              ? "bg-[var(--dart-blue-dim)] border-[var(--dart-blue)]/60 text-[var(--dart-cream)]"
              : t.multiplier === 3
                ? "bg-[var(--dart-magenta-dim)] border-[var(--dart-magenta)]/60 text-[var(--dart-cream)]"
                : "bg-secondary border-border text-foreground";
        return (
          <div
            key={i}
            className={[
              "h-6 rounded-sm border grid place-items-center font-display text-[0.65rem] font-black leading-none tabular",
              color,
            ].join(" ")}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}

function MarkGlyph({ marks }: { marks: number }) {
  if (marks <= 0) return <EmptyPips />;
  if (marks === 1) return <Slash />;
  if (marks === 2) return <Cross />;
  return <ClosedX />;
}

function EmptyPips() {
  return <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground/35" />;
}

function Slash() {
  return (
    <svg viewBox="0 0 24 24" className="size-7 sm:size-8" aria-label="1 mark">
      <line
        x1="5"
        y1="19"
        x2="19"
        y2="5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Cross() {
  return (
    <svg viewBox="0 0 24 24" className="size-7 sm:size-8" aria-label="2 marks">
      <line
        x1="5"
        y1="19"
        x2="19"
        y2="5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="5"
        y1="5"
        x2="19"
        y2="19"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClosedX() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-7 sm:size-8 text-[var(--dart-gold)] drop-shadow-[0_0_6px_oklch(0.82_0.13_85/0.3)]"
      aria-label="closed"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
      <line
        x1="6"
        y1="18"
        x2="18"
        y2="6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="6"
        y1="6"
        x2="18"
        y2="18"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
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
    {
      m: 3,
      label: "Triple",
      ring: "ring-[var(--dart-magenta)]",
      fill: "bg-[var(--dart-magenta-dim)]",
    },
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
      <div className="font-display font-black text-4xl text-[var(--dart-green)]">{winner}</div>
      <Link
        to="/"
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

function isCricketTarget(v: number): v is 15 | 16 | 17 | 18 | 19 | 20 | 25 {
  return v === 15 || v === 16 || v === 17 || v === 18 || v === 19 || v === 20 || v === 25;
}

function targetKey(v: number): CricketTarget | null {
  if (!isCricketTarget(v)) return null;
  return String(v) as CricketTarget;
}

function deriveState(config: CricketConfig, participants: Participant[], events: GameEvent[]) {
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
    const t = a.createdAt - b.createdAt;
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
    const openOpponents = opponents.filter((p) => (marks[p.id]?.[t] ?? 0) < 3);
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
  const allClosed = (pid: string) => TARGETS.every((t) => (marks[pid]?.[t] ?? 0) >= 3);
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
