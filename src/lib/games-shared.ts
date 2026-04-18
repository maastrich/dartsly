export type GameMode = "x01" | "cricket" | "killer";

export const X01_START_SCORES = [101, 201, 301, 401, 501, 601, 701, 801, 901, 1001] as const;
export type X01StartScore = (typeof X01_START_SCORES)[number];

export type X01OutMode = "single" | "double" | "master";

export type X01Config = {
  startScore: X01StartScore;
  outMode: X01OutMode;
};

export type X01Event = {
  score: number; // total scored in the visit (0–180)
};

export type CricketTarget = "15" | "16" | "17" | "18" | "19" | "20" | "25";

export type CricketScoringMode = "normal" | "cutthroat";

export type CricketConfig = {
  scoringMode: CricketScoringMode;
  pointsCap: boolean; // stop scoring once everyone else closed a target
};

export type CricketEvent = {
  hits: Partial<Record<CricketTarget, number>>; // new hits this visit (1 = single, 2 = double, etc.)
  pointsScored: number;
};

export type KillerAssignment = "random" | "manual";
export type KillerSelfRule = "safe" | "suicide";
export type KillerRules = "standard" | "progressive";

export type KillerConfig = {
  rules: KillerRules;
  startLives: 3 | 5; // only used by "standard"; "progressive" always starts at 0
  assignment: KillerAssignment; // how targets were chosen (informational)
  selfRule: KillerSelfRule; // "standard" only: killer hitting own double = lose a life
  targets: number[]; // target number per position (1–20 or 25)
};

export type KillerEvent = {
  isKiller: boolean; // was this participant a killer at the start of this round?
  kills: number; // opponents killed this round
  livesLost: number; // lives lost this round
  becameKiller: boolean; // hit their double this round to become killer
};

export function defaultConfig(mode: GameMode): X01Config | CricketConfig | KillerConfig {
  switch (mode) {
    case "x01":
      return { startScore: 501, outMode: "single" };
    case "cricket":
      return { scoringMode: "normal", pointsCap: true };
    case "killer":
      return {
        rules: "progressive",
        startLives: 3,
        assignment: "random",
        selfRule: "safe",
        targets: [],
      };
  }
}
