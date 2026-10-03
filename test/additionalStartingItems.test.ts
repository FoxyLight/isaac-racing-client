import isaacRacingCommon from "isaac-racing-common";
import assert from "node:assert/strict";
import type { AdditionalStartingItemsContext } from "../src/common/additionalStartingItems";
import {
  canonicalizeAdditionalStartingItems,
  resolveStartingItems,
  searchAdditionalStartingItems,
} from "../src/common/additionalStartingItems";

const { BUILDS, ADDITIONAL_STARTING_ITEMS: policy } = isaacRacingCommon;
const unseeded: AdditionalStartingItemsContext = {
  format: "unseeded",
  character: "Isaac",
  ranked: false,
  solo: false,
  startingBuildIndex: -1,
};
const seeded = {
  ...unseeded,
  format: "seeded",
  startingBuildIndex: BUILDS.findIndex(
    (build) => build.name === "Cricket's Head",
  ),
};
assert.ok(seeded.startingBuildIndex >= 0);
let scenarios = 0;
function check(name: string, run: () => void) {
  run();
  scenarios++;
  console.log(`PASS: ${name}`);
}

for (const value of [undefined, null, []]) {
  check("legacy empty normalization", () => {
    assert.deepEqual(canonicalizeAdditionalStartingItems(value, unseeded), []);
  });
}
for (const format of ["unseeded", "custom"]) {
  for (const ids of [[4], [4, 8, 12, 50, 67]]) {
    check(`${format} accepted boundary`, () => {
      assert.deepEqual(
        canonicalizeAdditionalStartingItems(ids, { ...unseeded, format }),
        ids,
      );
    });
  }
}
check("canonical ascending order and immutable selection", () => {
  const selection = Object.freeze([182, 4, 12]);
  assert.deepEqual(
    canonicalizeAdditionalStartingItems(selection, unseeded),
    [4, 12, 182],
  );
  assert.deepEqual(selection, [182, 4, 12]);
});
for (const value of [
  "4",
  {},
  ["4"],
  [Number.NaN],
  [Number.POSITIVE_INFINITY],
  [1.5],
  [0],
  [-1],
  [733],
  [33],
  [590],
  [721],
  [4, 4],
  [4, 8, 12, 50, 67, 182],
]) {
  check("invalid input rejected", () => {
    assert.throws(() => canonicalizeAdditionalStartingItems(value, unseeded));
  });
}
for (const id of policy.questProgressionCollectibleIds) {
  check(`progression item ${id} rejected`, () => {
    assert.throws(() => canonicalizeAdditionalStartingItems([id], unseeded));
  });
}
for (const context of [
  { ...unseeded, format: "diversity" },
  { ...unseeded, format: "unknown" },
  { ...unseeded, ranked: true, solo: true },
  { ...unseeded, character: "Tainted Lazarus" },
]) {
  check(
    "unsupported context rejects extras but preserves empty legacy payload",
    () => {
      const selection = Object.freeze([4]);
      assert.throws(() =>
        canonicalizeAdditionalStartingItems(selection, context),
      );
      assert.deepEqual(selection, [4]);
      assert.deepEqual(canonicalizeAdditionalStartingItems(null, context), []);
    },
  );
}
check("ranked multiplayer supported", () => {
  assert.deepEqual(
    canonicalizeAdditionalStartingItems([4], { ...unseeded, ranked: true }),
    [4],
  );
});
check("seeded four-item boundary and base order", () => {
  assert.deepEqual(
    resolveStartingItems([4], [182, 12, 50], seeded),
    [4, 12, 50, 182],
  );
});
check("seeded duplicate of base rejected", () => {
  assert.throws(() => canonicalizeAdditionalStartingItems([4], seeded));
});
check("seeded overflow rejected", () => {
  assert.throws(() =>
    canonicalizeAdditionalStartingItems([12, 182, 50, 224], seeded),
  );
});
for (const index of [-1, -2, 1.5, BUILDS.length]) {
  check("random or invalid seeded build rejected with extras", () => {
    assert.throws(() =>
      canonicalizeAdditionalStartingItems([12], {
        ...seeded,
        startingBuildIndex: index,
      }),
    );
  });
}
check("seeded eligibility derives from builds", () => {
  const buildIDs = new Set(
    BUILDS.flatMap((build) => build.collectibles.map((item) => item.id)),
  );
  const choices = searchAdditionalStartingItems("", seeded);
  assert.ok(choices.length > 0);
  assert.ok(choices.every((choice) => buildIDs.has(choice.id)));
  const outsideBuilds = searchAdditionalStartingItems("", unseeded).find(
    (choice) => !buildIDs.has(choice.id),
  );
  assert.ok(outsideBuilds !== undefined);
  assert.throws(() =>
    canonicalizeAdditionalStartingItems([outsideBuilds.id], seeded),
  );
});
check("legacy Diversity and ranked-solo lists preserved without extras", () => {
  const diversity = Object.freeze([33, 4, 8, 12, 1]);
  assert.deepEqual(
    resolveStartingItems(diversity, undefined, {
      ...unseeded,
      format: "diversity",
    }),
    diversity,
  );
  assert.deepEqual(
    resolveStartingItems([4], [], { ...seeded, ranked: true, solo: true }),
    [4],
  );
});
check("resolved base list not sorted or mutated", () => {
  const base = Object.freeze([12, 4]);
  assert.deepEqual(resolveStartingItems(base, [], seeded), [12, 4]);
});
check("search by numeric ID and case-insensitive name", () => {
  assert.ok(
    searchAdditionalStartingItems("4", unseeded).some((item) => item.id === 4),
  );
  assert.ok(
    searchAdditionalStartingItems("CRICKET'S HEAD", unseeded).some(
      (item) => item.id === 4,
    ),
  );
  assert.deepEqual(
    searchAdditionalStartingItems("not-an-item-name", unseeded),
    [],
  );
});
for (const format of ["unseeded", "custom", "seeded"]) {
  check(`${format} single-item character ban`, () => {
    assert.throws(
      () =>
        canonicalizeAdditionalStartingItems([149], {
          ...seeded,
          format,
          character: "Azazel",
        }),
      /Ipecac is incompatible with Azazel/,
    );
  });
  for (const character of ["Azazel", "Tainted Azazel"]) {
    check(`${format} recreated multi-item ban for ${character}`, () => {
      assert.throws(
        () =>
          canonicalizeAdditionalStartingItems([224, 50], {
            ...seeded,
            format,
            character,
          }),
        /Cricket's Body \+ Steven is incompatible/,
      );
    });
  }
  check(`${format} compatible character preserves canonical extras`, () => {
    assert.deepEqual(
      canonicalizeAdditionalStartingItems([224, 50], { ...seeded, format }),
      [50, 224],
    );
  });
}
check("base plus extra recreates a banned combination", () => {
  const buildIndex = BUILDS.findIndex(
    (build) => build.name === "Chocolate Milk + Steven",
  );
  assert.ok(buildIndex >= 0);
  assert.throws(
    () =>
      resolveStartingItems([69, 50], [224], {
        ...seeded,
        character: "Azazel",
        startingBuildIndex: buildIndex,
      }),
    /Cricket's Body \+ Steven is incompatible/,
  );
});
check("zero extras preserve legacy banned build behavior", () => {
  const buildIndex = BUILDS.findIndex((build) => build.name === "Ipecac");
  assert.ok(buildIndex >= 0);
  assert.deepEqual(
    resolveStartingItems([149], [], {
      ...seeded,
      character: "Azazel",
      startingBuildIndex: buildIndex,
    }),
    [149],
  );
});
console.log(
  `PASS: ${scenarios} Additional Starting Items scenarios. No renderer or network runtime imported.`,
);
