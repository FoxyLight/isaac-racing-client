import type { RaceDifficulty } from "./RaceDifficulty";
import type { RaceFormat } from "./RaceFormat";
import type { RaceGoal } from "./RaceGoal";

/** Matches "Ruleset" in "race.go". */
export interface Ruleset {
  ranked: boolean;
  solo: boolean;
  format: RaceFormat;

  /** The full character name, e.g. "Judas" */
  character: string;
  goal: RaceGoal;
  startingBuildIndex: number;
  startingItems: number[];

  /** Missing/null on legacy payloads; normalized when received. */
  additionalStartingItems?: readonly number[] | null;
  seed: string;
  difficulty: RaceDifficulty;
}
