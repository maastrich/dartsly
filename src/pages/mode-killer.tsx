import { useMemo, useState, useTransition } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Undo2, CheckCircle2, Home, Skull, Heart } from "lucide-react";
import type { Game, GameEvent } from "@/lib/db";
import type { KillerConfig } from "@/lib/games-shared";
import { finishGame, recordThrow, endVisitEarly, undoLastThrow } from "@/lib/game-actions";

type Participant = { id: string; playerId: string; position: number; name: string };
type Multiplier = 1 | 2 | 3;
type PerThrowData = {
  value: number;
  multiplier: Multiplier;
  throwIndex: number;
  endsVisit?: boolean;
};

function haptic(ms = 8) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(ms);
  }
}

function normalizeConfig(raw: Partial<KillerConfig> | null | undefined): KillerConfig {
  return {
    rules: raw?.rules === "standard" ? "standard" : "progressive",
    startLives: raw?.startLives === 5 ? 5 : 3,
    assignment: raw?.assignment ?? "random",
    selfRule: raw?.selfRule ?? "safe",
    targets: Array.isArray(raw?.targets) ? raw.targets : [],
  };
}

function initialLives(config: KillerConfig) {
  return config.rules === "progressive" ? 0 : config.startLives;
}

function isDead(lives: number, config: KillerConfig) {
  return config.rules === "progressive" ? lives < 0 : lives <= 0;
}

function targetLabel(n: number) {
  return n === 25 ? "Bull" : String(n);
}

export function KillerBoard({
  game,
  participants,
  events,
}: {
  game: Game;
  participants: Participant[];
  events: GameEvent[];
}) {
  const config = normalizeConfig(game.config as Partial<KillerConfig>);
  const [pending, start] = useTransition();
  const [multiplier, setMultiplier] = useState<Multiplier>(1);

  const targetByPid = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of participants) {
      map[p.id] = config.targets[p.position] ?? 0;
    }
    return map;
  }, [config.targets, participants]);

  const state = useMemo(
    () => deriveState(config, participants, events, targetByPid),
    [config, participants, events, targetByPid],
  );

  const isFinished = game.status !== "in_progress";
  const alive = participants.filter((p) => !isDead(state.lives[p.id], config));
  const currentParticipant =
    state.winner ?? alive[state.turnIndex % Math.max(alive.length, 1)] ?? participants[0];
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
      targetByPid,
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
      if (post.becameKiller) {
        toast.success(`${currentParticipant.name} is a KILLER`, { duration: 1600 });
        haptic(30);
      } else if (post.killedPid) {
        const victim = participants.find((p) => p.id === post.killedPid);
        toast.error(`${victim?.name ?? "Player"} eliminated`, { duration: 1600 });
        haptic(40);
      } else if (post.lifeLost) {
        haptic(20);
      }
      if (wouldWin && post.winnerId) {
        const winner = participants.find((p) => p.id === post.winnerId);
        await finishGame({
          gameId: game.id,
          winnerParticipantId: post.winnerId,
          participantStats: computeFinalStats(participants, events, config, targetByPid, {
            pid: currentParticipant.id,
            value,
            multiplier: effectiveMultiplier,
          }),
        });
        toast.success(`${winner?.name ?? "Player"} wins!`);
        haptic(60);
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
          Killer
          <span
            className={[
              "ml-2",
              config.rules === "progressive"
                ? "text-[var(--dart-red)]"
                : "text-muted-foreground/70",
            ].join(" ")}
          >
            {config.rules === "progressive" ? "PROGRESSIVE" : `${config.startLives} LIVES`}
          </span>
          {config.rules === "standard" && config.selfRule === "suicide" && (
            <span className="ml-2 text-[var(--dart-red)]">SUICIDE</span>
          )}
        </div>
        <div className="w-8" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-1">
        <div className="flex flex-col gap-1.5">
          {participants.map((p) => (
            <KillerRow
              key={p.id}
              name={p.name}
              target={targetByPid[p.id]}
              lives={state.lives[p.id]}
              maxLives={config.startLives}
              armProgress={state.armProgress[p.id]}
              isKiller={state.isKiller[p.id]}
              isCurrent={!isFinished && p.id === currentParticipant.id}
              isWinner={isFinished && p.id === game.winnerParticipantId}
              dead={isDead(state.lives[p.id], config)}
              rules={config.rules}
              visitThrows={p.id === currentParticipant.id ? visitThrows : []}
            />
          ))}
        </div>
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

function KillerRow({
  name,
  target,
  lives,
  maxLives,
  armProgress,
  isKiller,
  isCurrent,
  isWinner,
  dead,
  rules,
  visitThrows,
}: {
  name: string;
  target: number;
  lives: number;
  maxLives: number;
  armProgress: number;
  isKiller: boolean;
  isCurrent: boolean;
  isWinner: boolean;
  dead: boolean;
  rules: "standard" | "progressive";
  visitThrows: { value: number; multiplier: Multiplier }[];
}) {
  return (
    <div
      className={[
        "relative rounded-xl border-2 px-3 py-2 grid items-center gap-2 transition-all",
        "grid-cols-[auto_1fr_auto]",
        dead
          ? "bg-card/30 border-border/30 opacity-50"
          : isCurrent
            ? "bg-card border-[var(--dart-gold)]"
            : isWinner
              ? "bg-card border-[var(--dart-green)]"
              : "bg-card/50 border-border/50",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <div
          className={[
            "h-10 w-10 rounded-lg grid place-items-center font-display font-black",
            isKiller
              ? "bg-[var(--dart-red-dim)] border border-[var(--dart-red)] text-[var(--dart-cream)]"
              : "bg-secondary border border-border text-foreground",
            dead ? "line-through" : "",
          ].join(" ")}
        >
          <span className="text-base leading-none">{targetLabel(target)}</span>
        </div>
        <div className="flex flex-col min-w-0">
          <div
            className={[
              "font-display uppercase tracking-[0.22em] truncate text-[0.7rem] leading-tight",
              isCurrent ? "text-[var(--dart-gold)]" : "text-muted-foreground",
              dead ? "line-through" : "",
            ].join(" ")}
          >
            {name}
          </div>
          <div className="flex items-center gap-1 mt-1">
            {isKiller && !dead && (
              <span className="inline-flex items-center gap-1 px-1.5 h-4 rounded-sm bg-[var(--dart-red)] text-[var(--dart-cream)] font-display text-[0.5rem] uppercase tracking-[0.2em] font-extrabold">
                <Skull className="size-2.5" /> Killer
              </span>
            )}
            {!isKiller && !dead && rules === "progressive" && (
              <span className="font-display text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground/70">
                Arm {targetLabel(target)} · {armProgress}/3
              </span>
            )}
            {!isKiller && !dead && rules === "standard" && (
              <span className="font-display text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground/70">
                Hit D{targetLabel(target)} to arm
              </span>
            )}
            {dead && (
              <span className="font-display text-[0.6rem] uppercase tracking-[0.3em] text-[var(--dart-red)] font-black">
                Eliminated
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <ThrowSlots throws={visitThrows} />
      </div>

      <div className="flex items-center gap-0.5 justify-end">
        {rules === "standard" ? (
          Array.from({ length: maxLives }).map((_, i) => {
            const filled = i < lives;
            return (
              <Heart
                key={i}
                className={[
                  "size-4",
                  filled
                    ? isKiller
                      ? "text-[var(--dart-red)] fill-[var(--dart-red)]"
                      : "text-[var(--dart-gold)] fill-[var(--dart-gold)]"
                    : "text-muted-foreground/30",
                ].join(" ")}
              />
            );
          })
        ) : (
          <span
            className={[
              "font-display tabular font-black text-xl leading-none",
              dead
                ? "text-[var(--dart-red)]"
                : lives < 0
                  ? "text-[var(--dart-red)]"
                  : lives === 0
                    ? "text-foreground"
                    : "text-[var(--dart-gold)]",
            ].join(" ")}
          >
            {lives}
          </span>
        )}
      </div>
    </div>
  );
}

function ThrowSlots({ throws }: { throws: { value: number; multiplier: Multiplier }[] }) {
  if (throws.length === 0) return <div />;
  return (
    <div className="grid grid-cols-3 gap-1">
      {[0, 1, 2].map((i) => {
        const t = throws[i];
        if (!t) {
          return (
            <div
              key={i}
              className="h-7 w-10 rounded-md border border-dashed border-border/50 bg-background/20 grid place-items-center text-muted-foreground/40 font-display text-[0.6rem] tabular"
              aria-hidden
            >
              {i + 1}
            </div>
          );
        }
        const label =
          t.value === 0
            ? "—"
            : t.value === 25
              ? t.multiplier === 2
                ? "BULL"
                : "25"
              : `${t.multiplier === 2 ? "D" : t.multiplier === 3 ? "T" : ""}${t.value}`;
        const color =
          t.multiplier === 2
            ? "bg-[var(--dart-blue-dim)] border-[var(--dart-blue)] text-[var(--dart-cream)]"
            : t.multiplier === 3
              ? "bg-[var(--dart-magenta-dim)] border-[var(--dart-magenta)] text-[var(--dart-cream)]"
              : "bg-secondary border-border text-foreground";
        return (
          <div
            key={i}
            className={`h-7 w-10 rounded-md border ${color} font-display text-[0.65rem] font-black grid place-items-center`}
          >
            {label}
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

/* ─── Full number pad (1-20 + Bull) ──────────────────────────────────── */

const ROW_1 = [1, 2, 3, 4, 5, 6, 7];
const ROW_2 = [8, 9, 10, 11, 12, 13, 14];
const ROW_3 = [15, 16, 17, 18, 19, 20, 25];

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
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onPress(n)}
            className={[
              "h-11 rounded-lg border font-display font-black transition-all active:scale-[0.96] text-base",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              n === 25
                ? "bg-[var(--dart-red-dim)] border-[var(--dart-red)]/60 text-[var(--dart-cream)]"
                : "bg-card border-border text-foreground hover:border-foreground/40",
            ].join(" ")}
          >
            {n === 25 ? "25" : n}
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
        Last killer standing
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

/* ─── State derivation ───────────────────────────────────────────────── */

type ActiveVisit = {
  participantId: string;
  roundIndex: number;
  throws: { value: number; multiplier: Multiplier }[];
  lastEventId: string;
};

function deriveState(
  config: KillerConfig,
  participants: Participant[],
  events: GameEvent[],
  targetByPid: Record<string, number>,
) {
  const lives: Record<string, number> = {};
  const isKiller: Record<string, boolean> = {};
  const armProgress: Record<string, number> = {};
  const rounds: Record<string, number> = {};
  const dartsThrown: Record<string, number> = {};
  const killsDealt: Record<string, number> = {};
  for (const p of participants) {
    lives[p.id] = initialLives(config);
    isKiller[p.id] = false;
    armProgress[p.id] = 0;
    rounds[p.id] = 0;
    dartsThrown[p.id] = 0;
    killsDealt[p.id] = 0;
  }

  const inProgress: Record<string, ActiveVisit> = {};
  const sorted = [...events].sort((a, b) => {
    const t = a.createdAt - b.createdAt;
    if (t !== 0) return t;
    return a.id < b.id ? -1 : 1;
  });

  let winner: Participant | null = null;

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

    if (!isDead(lives[pid], config)) {
      resolveHit(
        pid,
        d.value,
        d.multiplier,
        lives,
        isKiller,
        armProgress,
        killsDealt,
        participants,
        targetByPid,
        config,
      );
    }

    if (!winner) {
      const survivors = participants.filter((p) => !isDead(lives[p.id], config));
      if (survivors.length === 1 && participants.length > 1) {
        winner = survivors[0];
      }
    }

    const shouldComplete = inProgress[pid].throws.length === 3 || d.endsVisit === true;
    if (shouldComplete) {
      rounds[pid] += 1;
      delete inProgress[pid];
    }
  }

  const activeVisit = Object.values(inProgress)[0] ?? null;

  let turnIndex = 0;
  if (winner) {
    const aliveIdx = participants
      .filter((p) => !isDead(lives[p.id], config))
      .findIndex((p) => p.id === winner!.id);
    turnIndex = Math.max(0, aliveIdx);
  } else if (activeVisit) {
    const alive = participants.filter((p) => !isDead(lives[p.id], config));
    turnIndex = alive.findIndex((p) => p.id === activeVisit.participantId);
    if (turnIndex < 0) turnIndex = 0;
  } else {
    const alive = participants.filter((p) => !isDead(lives[p.id], config));
    if (alive.length === 0) {
      turnIndex = 0;
    } else {
      const minR = Math.min(...alive.map((p) => rounds[p.id]));
      turnIndex = alive.findIndex((p) => rounds[p.id] === minR);
      if (turnIndex < 0) turnIndex = 0;
    }
  }

  return {
    lives,
    isKiller,
    armProgress,
    rounds,
    dartsThrown,
    killsDealt,
    activeVisit,
    turnIndex,
    winner,
  };
}

function resolveHit(
  pid: string,
  value: number,
  mult: Multiplier,
  lives: Record<string, number>,
  isKiller: Record<string, boolean>,
  armProgress: Record<string, number>,
  killsDealt: Record<string, number>,
  participants: Participant[],
  targetByPid: Record<string, number>,
  config: KillerConfig,
) {
  if (value === 0) return;
  const ownTarget = targetByPid[pid];

  // Hit own number
  if (value === ownTarget) {
    if (config.rules === "progressive") {
      if (isKiller[pid]) return; // already armed; self-hits are no-ops
      armProgress[pid] = Math.min(3, armProgress[pid] + mult);
      if (armProgress[pid] >= 3) isKiller[pid] = true;
      return;
    }
    // standard
    if (mult !== 2) return;
    if (!isKiller[pid]) {
      isKiller[pid] = true;
    } else if (config.selfRule === "suicide") {
      lives[pid] = Math.max(0, lives[pid] - 1);
    }
    return;
  }

  // Hit opponent's number — only counts if the shooter is a killer
  if (!isKiller[pid]) return;
  for (const opp of participants) {
    if (opp.id === pid) continue;
    if (isDead(lives[opp.id], config)) continue;
    if (targetByPid[opp.id] !== value) continue;
    if (config.rules === "progressive") {
      lives[opp.id] -= mult;
    } else {
      if (mult !== 2) return;
      lives[opp.id] = Math.max(0, lives[opp.id] - 1);
    }
    killsDealt[pid] += 1;
    break;
  }
}

function applyThrow(
  prev: ReturnType<typeof deriveState>,
  participants: Participant[],
  config: KillerConfig,
  targetByPid: Record<string, number>,
  pid: string,
  value: number,
  mult: Multiplier,
) {
  const lives = { ...prev.lives };
  const isKiller = { ...prev.isKiller };
  const armProgress = { ...prev.armProgress };
  const killsDealt = { ...prev.killsDealt };

  const wasKiller = isKiller[pid];
  const livesBefore: Record<string, number> = { ...lives };

  resolveHit(
    pid,
    value,
    mult,
    lives,
    isKiller,
    armProgress,
    killsDealt,
    participants,
    targetByPid,
    config,
  );

  const becameKiller = !wasKiller && isKiller[pid];
  let killedPid: string | null = null;
  let lifeLost = false;
  for (const p of participants) {
    if (lives[p.id] < livesBefore[p.id]) {
      lifeLost = true;
      if (!isDead(livesBefore[p.id], config) && isDead(lives[p.id], config)) {
        killedPid = p.id;
      }
    }
  }

  const survivors = participants.filter((p) => !isDead(lives[p.id], config));
  const winnerId = participants.length > 1 && survivors.length === 1 ? survivors[0].id : null;

  return { becameKiller, killedPid, lifeLost, winnerId };
}

function computeFinalStats(
  participants: Participant[],
  events: GameEvent[],
  config: KillerConfig,
  targetByPid: Record<string, number>,
  pending?: { pid: string; value: number; multiplier: Multiplier },
) {
  const dartsThrown: Record<string, number> = {};
  const kills: Record<string, number> = {};
  const rounds: Record<string, Set<number>> = {};
  for (const p of participants) {
    dartsThrown[p.id] = 0;
    kills[p.id] = 0;
    rounds[p.id] = new Set();
  }

  const lives: Record<string, number> = {};
  const isKiller: Record<string, boolean> = {};
  const armProgress: Record<string, number> = {};
  for (const p of participants) {
    lives[p.id] = initialLives(config);
    isKiller[p.id] = false;
    armProgress[p.id] = 0;
  }

  for (const ev of events) {
    const d = ev.data as PerThrowData;
    dartsThrown[ev.participantId] += 1;
    rounds[ev.participantId].add(ev.roundIndex);
    if (!isDead(lives[ev.participantId], config)) {
      resolveHit(
        ev.participantId,
        d.value,
        d.multiplier,
        lives,
        isKiller,
        armProgress,
        kills,
        participants,
        targetByPid,
        config,
      );
    }
  }
  if (pending && !isDead(lives[pending.pid], config)) {
    dartsThrown[pending.pid] += 1;
    resolveHit(
      pending.pid,
      pending.value,
      pending.multiplier,
      lives,
      isKiller,
      armProgress,
      kills,
      participants,
      targetByPid,
      config,
    );
  }

  const stats: Record<string, Record<string, unknown>> = {};
  for (const p of participants) {
    stats[p.id] = {
      rounds: rounds[p.id].size,
      dartsThrown: dartsThrown[p.id],
      kills: kills[p.id],
      livesRemaining: lives[p.id],
      becameKiller: isKiller[p.id],
      target: targetByPid[p.id],
    };
  }
  return stats;
}
