import { describe, expect, it } from "vite-plus/test";
import {
  defaultConfig,
  X01_START_SCORES,
  type CricketConfig,
  type KillerConfig,
  type X01Config,
} from "./games-shared";

describe("X01_START_SCORES", () => {
  it("is a 100-step ladder from 101 to 1001", () => {
    expect(X01_START_SCORES).toEqual([101, 201, 301, 401, 501, 601, 701, 801, 901, 1001]);
  });
});

describe("defaultConfig", () => {
  it("returns a 501 single-out config for x01", () => {
    expect(defaultConfig("x01")).toEqual<X01Config>({
      startScore: 501,
      outMode: "single",
    });
  });

  it("returns normal scoring with a points cap for cricket", () => {
    expect(defaultConfig("cricket")).toEqual<CricketConfig>({
      scoringMode: "normal",
      pointsCap: true,
    });
  });

  it("returns progressive killer with empty targets", () => {
    expect(defaultConfig("killer")).toEqual<KillerConfig>({
      rules: "progressive",
      startLives: 3,
      assignment: "random",
      selfRule: "safe",
      targets: [],
    });
  });
});
