"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Undo2, CheckCircle2, Home } from "lucide-react";
import type { Game, GameEvent } from "@/lib/db/schema";
import type { X01Config, X01OutMode } from "@/lib/games/shared";
import {
  finishGame,
  recordThrow,
  endVisitEarly,
  undoLastThrow,
} from "../actions";

type Participant = { id: string; playerId: string; position: number; name: string };
type Multiplier = 1 | 2 | 3;
type Throw = { value: number; multiplier: Multiplier };
type ActiveVisit = {
  participantId: string;
  roundIndex: number;
  throws: Throw[];
  lastEventId: string;
};
type LastVisit = { throws: Throw[]; bust: boolean; roundIndex: number };

const ROW_1 = [1, 2, 3, 4, 5, 6, 7];
const ROW_2 = [8, 9, 10, 11, 12, 13, 14];
const ROW_3 = [15, 16, 17, 18, 19, 20, 25];

function throwScore(t: Throw) {
  return t.value * t.multiplier;
}

function throwLabel(t: Throw) {
  if (t.value === 0) return "0";
  if (t.value === 25) return t.multiplier === 2 ? "BULL" : "25";
  return `${t.multiplier === 2 ? "D" : t.multiplier === 3 ? "T" : ""}${t.value}`;
}

function haptic(ms = 8) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(ms);
  }
}

function outModeLabel(m: X01OutMode) {
  return m === "double" ? "DBL OUT" : m === "master" ? "MSTR OUT" : "OPEN";
}

function normalizeConfig(raw: X01Config & { doubleOut?: boolean }): X01Config {
  if (raw.outMode) return { startScore: raw.startScore, outMode: raw.outMode };
  return { startScore: raw.startScore, outMode: raw.doubleOut ? "double" : "single" };
}

function judgeVisit(
  throws: Throw[],
  remainingBefore: number,
  outMode: X01OutMode,
): { bust: boolean; score: number } {
  const gross = throws.reduce((a, t) => a + throwScore(t), 0);
  const after = remainingBefore - gross;
  const last = throws[throws.length - 1];
  const endedOnDouble = !!last && last.multiplier === 2;
  const endedOnTriple = !!last && last.multiplier === 3;
  let bust = false;
  if (after < 0) bust = true;
  else if (after === 0 && outMode === "double" && !endedOnDouble) bust = true;
  else if (after === 0 && outMode === "master" && !endedOnDouble && !endedOnTriple)
    bust = true;
  else if (after === 1 && (outMode === "double" || outMode === "master")) bust = true;
  return { bust, score: bust ? 0 : gross };
}

export function X01Board({
  game,
  participants,
  events,
}: {
  game: Game;
  participants: Participant[];
  events: GameEvent[];
}) {
  const router = useRouter();
  const config = normalizeConfig(game.config as X01Config & { doubleOut?: boolean });
  const [pending, start] = useTransition();
  const [multiplier, setMultiplier] = useState<Multiplier>(1);

  const state = useMemo(
    () => deriveState(config, participants, events),
    [config, participants, events],
  );
  const isFinished = game.status !== "in_progress";
  const currentParticipant = state.winner ?? participants[state.turnIndex];
  const currentRemaining = state.remaining[currentParticipant.id];
  const activeVisit =
    state.activeVisit && state.activeVisit.participantId === currentParticipant.id
      ? state.activeVisit
      : null;
  const visitThrows = activeVisit?.throws ?? [];
  const visitScore = visitThrows.reduce((a, t) => a + throwScore(t), 0);
  const hypotheticalRemaining = currentRemaining - visitScore;
  const wouldBust =
    hypotheticalRemaining < 0 ||
    ((config.outMode === "double" || config.outMode === "master") &&
      hypotheticalRemaining === 1);

  function nextRoundIndexFor(participantId: string) {
    if (activeVisit && activeVisit.participantId === participantId) {
      return activeVisit.roundIndex;
    }
    return state.visits[participantId];
  }

  function pressValue(value: number) {
    if (isFinished || pending) return;
    if (visitThrows.length >= 3) return;
    if (value === 25 && multiplier === 3) {
      haptic(20);
      toast.error("No triple bull");
      return;
    }
    const effectiveMultiplier: Multiplier = value === 0 ? 1 : multiplier;
    const newThrow: Throw = { value, multiplier: effectiveMultiplier };
    const throwIndex = visitThrows.length;
    const roundIndex = nextRoundIndexFor(currentParticipant.id);

    const projected = [...visitThrows, newThrow];
    const { bust, score: visitTotal } = judgeVisit(
      projected,
      currentRemaining,
      config.outMode,
    );
    const wouldWin = !bust && currentRemaining - visitTotal === 0;
    const shouldEnd = throwIndex === 2 || bust || wouldWin;

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
      if (wouldWin) {
        const stats = computeFinalStats(
          participants,
          events,
          { pid: currentParticipant.id, roundIndex, throw: newThrow },
        );
        await finishGame({
          gameId: game.id,
          winnerParticipantId: currentParticipant.id,
          participantStats: stats,
        });
        toast.success(`${currentParticipant.name} wins!`);
        haptic(40);
      } else if (bust) {
        toast.error("Bust", { position: "top-center", duration: 1800 });
        haptic(30);
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
          X01 · {config.startScore}
          <span
            className={[
              "ml-2",
              config.outMode === "double"
                ? "text-[var(--dart-red)]"
                : config.outMode === "master"
                  ? "text-[var(--dart-green)]"
                  : "text-muted-foreground/70",
            ].join(" ")}
          >
            {outModeLabel(config.outMode)}
          </span>
        </div>
        <div className="w-8" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-1">
        <PlayerStack
          participants={participants}
          state={state}
          currentId={isFinished ? state.winner?.id : currentParticipant.id}
          winnerId={isFinished ? game.winnerParticipantId : null}
          visitThrows={visitThrows}
          visitScore={visitScore}
          wouldBust={wouldBust}
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
            <NumberPad
              onPress={pressValue}
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

/* ─── Player stack (vertical, scrollable) ────────────────────────────── */

function PlayerStack({
  participants,
  state,
  currentId,
  winnerId,
  visitThrows,
  visitScore,
  wouldBust,
}: {
  participants: Participant[];
  state: ReturnType<typeof deriveState>;
  currentId: string | null | undefined;
  winnerId: string | null | undefined;
  visitThrows: Throw[];
  visitScore: number;
  wouldBust: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      {participants.map((p) => {
        const isCurrent = p.id === currentId && !winnerId;
        const isWinner = p.id === winnerId;
        const remaining = state.remaining[p.id];
        const projected =
          isCurrent && !wouldBust ? remaining - visitScore : remaining;
        return (
          <PlayerRow
            key={p.id}
            name={p.name}
            remaining={remaining}
            projected={projected}
            rounds={state.visits[p.id]}
            avg={state.avg[p.id]}
            isCurrent={isCurrent}
            isWinner={isWinner}
            wouldBust={isCurrent && wouldBust}
            visitThrows={isCurrent ? visitThrows : []}
            lastVisit={state.lastVisit[p.id]}
          />
        );
      })}
    </div>
  );
}

function PlayerRow({
  name,
  remaining: _remaining,
  projected,
  rounds,
  avg,
  isCurrent,
  isWinner,
  wouldBust,
  visitThrows,
  lastVisit,
}: {
  name: string;
  remaining: number;
  projected: number;
  rounds: number;
  avg: number;
  isCurrent: boolean;
  isWinner: boolean;
  wouldBust: boolean;
  visitThrows: Throw[];
  lastVisit?: LastVisit;
}) {
  const showCurrentSlots = isCurrent && visitThrows.length > 0;
  const showLastSlots = !showCurrentSlots && !!lastVisit;
  return (
    <div
      className={[
        "relative rounded-xl border px-3 py-1.5 grid items-center gap-2 transition-all",
        "grid-cols-[minmax(4.5rem,auto)_1fr_auto]",
        isCurrent
          ? "bg-card border-transparent shadow-[0_0_0_2px_var(--dart-gold)]"
          : isWinner
            ? "bg-card border-transparent shadow-[0_0_0_2px_var(--dart-green)]"
            : "bg-card/50 border-border/60",
      ].join(" ")}
    >
      <div className="flex flex-col min-w-0">
        <div
          className={[
            "font-display tabular font-black leading-none",
            isCurrent ? "text-[2rem]" : "text-xl",
            wouldBust
              ? "text-[var(--dart-red)]"
              : isWinner
                ? "text-[var(--dart-green)]"
                : "",
          ].join(" ")}
        >
          {projected}
        </div>
        <div
          className={[
            "font-display uppercase tracking-[0.22em] truncate leading-tight mt-0.5",
            isCurrent
              ? "text-[0.65rem] text-[var(--dart-gold)]"
              : "text-[0.6rem] text-muted-foreground",
          ].join(" ")}
        >
          {name}
        </div>
      </div>

      {showCurrentSlots ? (
        <ThrowSlots throws={visitThrows} />
      ) : showLastSlots ? (
        <ThrowSlots throws={lastVisit!.throws} busted={lastVisit!.bust} compact />
      ) : (
        <div />
      )}

      <div className="flex flex-col items-end text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground leading-tight whitespace-nowrap">
        {wouldBust ? (
          <span className="font-display font-black text-[var(--dart-red)] tracking-[0.25em] text-[0.7rem]">
            BUST
          </span>
        ) : (
          <>
            <span>
              <span className="text-foreground tabular font-semibold">{rounds}</span> rds
            </span>
            <span>
              avg{" "}
              <span className="text-foreground tabular font-semibold">
                {avg.toFixed(1)}
              </span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function ThrowSlots({
  throws,
  busted = false,
  compact = false,
}: {
  throws: Throw[];
  busted?: boolean;
  compact?: boolean;
}) {
  const slots = [0, 1, 2];
  const h = compact ? "h-7" : "h-9";
  const valueSize = compact ? "text-[0.7rem]" : "text-sm";
  const scoreSize = compact ? "text-[0.45rem]" : "text-[0.5rem]";
  const bustFill = "bg-[var(--dart-red-dim)] border-[var(--dart-red)] text-[var(--dart-cream)]";
  return (
    <div className="grid grid-cols-3 gap-1">
      {slots.map((i) => {
        const t = throws[i];
        if (!t) {
          return (
            <div
              key={i}
              className={`${h} rounded-md border border-dashed border-border/60 grid place-items-center text-muted-foreground/50 font-display text-xs`}
              aria-hidden
            >
              ·
            </div>
          );
        }
        const color = busted
          ? bustFill
          : t.multiplier === 2
            ? "bg-[var(--dart-blue-dim)] border-[var(--dart-blue)] text-[var(--dart-cream)]"
            : t.multiplier === 3
              ? "bg-[var(--dart-magenta-dim)] border-[var(--dart-magenta)] text-[var(--dart-cream)]"
              : "bg-secondary border-border text-foreground";
        return (
          <div
            key={i}
            className={`${h} rounded-md border ${color} font-display ${valueSize} font-black leading-none flex flex-col items-center justify-center`}
          >
            <span className="leading-none">{throwLabel(t)}</span>
            <span className={`${scoreSize} font-sans font-medium opacity-70 tracking-widest mt-0.5`}>
              {throwScore(t)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Multiplier bar ─────────────────────────────────────────────────── */

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

/* ─── Number pad (fixed-height 7×3 + action row) ─────────────────────── */

function NumberPad({
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
  return (
    <div className="flex flex-col gap-1.5">
      <div role="group" aria-label="Number pad" className="grid grid-cols-7 gap-1.5">
        {[...ROW_1, ...ROW_2, ...ROW_3].map((n) => (
          <PadButton
            key={n}
            value={n}
            onPress={onPress}
            disabled={disabled}
            accent={n === 25 ? "bull" : undefined}
          />
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

function PadButton({
  value,
  onPress,
  disabled,
  accent,
}: {
  value: number;
  onPress: (n: number) => void;
  disabled?: boolean;
  accent?: "bull";
}) {
  const label = value === 25 ? "25" : String(value);
  const isBull = accent === "bull";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPress(value)}
      className={[
        "h-11 rounded-lg border font-display font-black transition-all active:scale-[0.96] text-base",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        isBull
          ? "bg-[var(--dart-red-dim)] border-[var(--dart-red)]/60 text-[var(--dart-cream)]"
          : "bg-card border-border text-foreground hover:border-foreground/40",
      ].join(" ")}
    >
      {label}
    </button>
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

/* ─── State derivation ───────────────────────────────────────────────── */

type PerThrowData = { value: number; multiplier: Multiplier; throwIndex: number; endsVisit?: boolean };
type LegacyVisitData = { throws: Throw[]; score: number; bust: boolean };

function isLegacy(d: unknown): d is LegacyVisitData {
  return !!d && typeof d === "object" && Array.isArray((d as LegacyVisitData).throws);
}

function deriveState(
  config: X01Config,
  participants: Participant[],
  events: GameEvent[],
) {
  const remaining: Record<string, number> = {};
  const visits: Record<string, number> = {};
  const totalScored: Record<string, number> = {};
  const lastVisit: Record<string, LastVisit> = {};
  for (const p of participants) {
    remaining[p.id] = config.startScore;
    visits[p.id] = 0;
    totalScored[p.id] = 0;
  }

  const inProgress: Record<string, ActiveVisit> = {};
  let winner: Participant | null = null;

  const sorted = [...events].sort((a, b) => {
    const t = a.createdAt.getTime() - b.createdAt.getTime();
    if (t !== 0) return t;
    return a.id < b.id ? -1 : 1;
  });

  for (const ev of sorted) {
    const pid = ev.participantId;
    const d = ev.data as unknown;

    if (isLegacy(d)) {
      const score = d.bust ? 0 : d.throws.reduce((a, t) => a + throwScore(t), 0);
      remaining[pid] -= score;
      totalScored[pid] += score;
      visits[pid] += 1;
      lastVisit[pid] = { throws: [...d.throws], bust: d.bust, roundIndex: ev.roundIndex };
      if (remaining[pid] === 0 && !winner) {
        winner = participants.find((p) => p.id === pid) ?? null;
      }
      continue;
    }

    const td = d as PerThrowData;
    if (!inProgress[pid] || inProgress[pid].roundIndex !== ev.roundIndex) {
      inProgress[pid] = {
        participantId: pid,
        roundIndex: ev.roundIndex,
        throws: [],
        lastEventId: ev.id,
      };
    }
    inProgress[pid].throws.push({ value: td.value, multiplier: td.multiplier });
    inProgress[pid].lastEventId = ev.id;

    const shouldComplete = inProgress[pid].throws.length === 3 || td.endsVisit === true;
    if (shouldComplete) {
      const visit = inProgress[pid];
      const { bust, score } = judgeVisit(visit.throws, remaining[pid], config.outMode);
      remaining[pid] -= score;
      totalScored[pid] += score;
      visits[pid] += 1;
      lastVisit[pid] = {
        throws: [...visit.throws],
        bust,
        roundIndex: visit.roundIndex,
      };
      if (remaining[pid] === 0 && !bust && !winner) {
        winner = participants.find((p) => p.id === pid) ?? null;
      }
      delete inProgress[pid];
    }
  }

  const avg: Record<string, number> = {};
  for (const p of participants) {
    avg[p.id] = visits[p.id] ? totalScored[p.id] / visits[p.id] : 0;
  }

  const activeVisit = Object.values(inProgress)[0] ?? null;

  let turnIndex = 0;
  if (winner) {
    turnIndex = participants.findIndex((p) => p.id === winner.id);
  } else if (activeVisit) {
    turnIndex = participants.findIndex((p) => p.id === activeVisit.participantId);
  } else {
    const minV = Math.min(...participants.map((p) => visits[p.id]));
    const idx = participants.findIndex((p) => visits[p.id] === minV);
    turnIndex = idx < 0 ? 0 : idx;
  }

  return { remaining, visits, avg, winner, turnIndex, activeVisit, lastVisit };
}

function computeFinalStats(
  participants: Participant[],
  events: GameEvent[],
  pending?: { pid: string; roundIndex: number; throw: Throw },
) {
  const dartsThrown: Record<string, number> = {};
  const visitGroup: Record<string, Map<number, Throw[]>> = {};
  for (const p of participants) {
    dartsThrown[p.id] = 0;
    visitGroup[p.id] = new Map();
  }

  for (const ev of events) {
    const d = ev.data as unknown;
    if (isLegacy(d)) {
      dartsThrown[ev.participantId] += d.throws.length || 3;
      const g = visitGroup[ev.participantId];
      const arr = g.get(ev.roundIndex) ?? [];
      g.set(ev.roundIndex, [...arr, ...d.throws]);
      continue;
    }
    const td = d as PerThrowData;
    dartsThrown[ev.participantId] += 1;
    const g = visitGroup[ev.participantId];
    const arr = g.get(ev.roundIndex) ?? [];
    arr.push({ value: td.value, multiplier: td.multiplier });
    g.set(ev.roundIndex, arr);
  }

  if (pending) {
    dartsThrown[pending.pid] += 1;
    const g = visitGroup[pending.pid];
    const arr = g.get(pending.roundIndex) ?? [];
    arr.push(pending.throw);
    g.set(pending.roundIndex, arr);
  }

  const stats: Record<string, Record<string, unknown>> = {};
  for (const p of participants) {
    const vs = Array.from(visitGroup[p.id].values());
    const rounds = vs.length;
    const totalPoints = vs.reduce(
      (a, throws) => a + throws.reduce((b, t) => b + throwScore(t), 0),
      0,
    );
    stats[p.id] = {
      rounds,
      totalPoints,
      averagePointsPerRound: rounds ? totalPoints / rounds : 0,
      dartsThrown: dartsThrown[p.id],
    };
  }
  return stats;
}
