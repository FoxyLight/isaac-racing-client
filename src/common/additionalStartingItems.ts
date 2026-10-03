import isaacRacingCommon from "isaac-racing-common";

const { ADDITIONAL_STARTING_ITEMS: policy, BUILDS, ITEMS } = isaacRacingCommon;

export interface AdditionalStartingItemsContext {
  format: string;
  character: string;
  ranked: boolean;
  solo: boolean;
  startingBuildIndex: number;
}

interface Item {
  name: string;
  shown?: boolean;
  space?: boolean;
}

const items: Readonly<Record<string, Item>> = ITEMS;
const seededIDs = new Set(
  BUILDS.flatMap((build) =>
    build.collectibles.map((collectible) => collectible.id),
  ),
);

function isEligible(id: number, format: string): boolean {
  const item = items[id];
  return (
    Number.isInteger(id) &&
    id >= policy.vanillaCollectibleIdRange.min &&
    id <= policy.vanillaCollectibleIdRange.max &&
    item?.shown === true &&
    item.space !== true &&
    !policy.globallyBannedCollectibleIds.includes(id) &&
    !policy.questProgressionCollectibleIds.includes(id) &&
    (format !== "seeded" || seededIDs.has(id))
  );
}

/** Normalize old payloads without changing or silently pruning a selection. */
export function canonicalizeAdditionalStartingItems(
  value: unknown,
  context: AdditionalStartingItemsContext,
): readonly number[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new TypeError("Additional starting items must be an array.");
  }
  const selected: number[] = [];
  for (const id of value as unknown[]) {
    if (typeof id !== "number" || !isEligible(id, context.format)) {
      throw new Error("An additional starting item is not eligible.");
    }
    selected.push(id);
  }
  if (selected.length === 0) {
    return selected;
  }
  if (
    !policy.supportedRaceFormats.includes(context.format) ||
    (context.ranked && context.solo) ||
    context.character === "Tainted Lazarus"
  ) {
    throw new Error(
      "Additional starting items are unsupported for this ruleset.",
    );
  }
  if (selected.length > policy.maxAdditionalItems) {
    throw new Error("Too many additional starting items.");
  }
  if (new Set(selected).size !== selected.length) {
    throw new Error("Duplicate additional starting items.");
  }
  const resolvedIDs = new Set(selected);
  if (context.format === "seeded") {
    const build = Number.isInteger(context.startingBuildIndex)
      ? BUILDS[context.startingBuildIndex]
      : undefined;
    if (build === undefined) {
      throw new Error("Extras require a concrete seeded build, not Random.");
    }
    const baseIDs = build.collectibles.map((collectible) => collectible.id);
    for (const id of baseIDs) {
      resolvedIDs.add(id);
    }
    if (baseIDs.length + selected.length > policy.seededMaxResolvedItems) {
      throw new Error("Seeded build plus extras exceeds the item limit.");
    }
    if (selected.some((id) => baseIDs.includes(id))) {
      throw new Error(
        "An additional starting item duplicates the seeded build.",
      );
    }
  }
  for (const build of BUILDS) {
    if (
      build.collectibles.every((collectible) =>
        resolvedIDs.has(collectible.id),
      ) &&
      build.bannedCharacters.some(
        (character) => character.name === context.character,
      )
    ) {
      throw new Error(
        `${build.name} is incompatible with ${context.character}.`,
      );
    }
  }
  return selected.sort((a, b) => a - b);
}

/** Keep legacy build/Diversity order, followed by validated canonical extras. */
export function resolveStartingItems(
  legacyItems: readonly number[],
  value: unknown,
  context: AdditionalStartingItemsContext,
): readonly number[] {
  return [
    ...legacyItems,
    ...canonicalizeAdditionalStartingItems(value, context),
  ];
}

/** Pure search data for the later selector; does not access renderer state. */
export function searchAdditionalStartingItems(
  query: string,
  context: AdditionalStartingItemsContext,
): ReadonlyArray<{ id: number; name: string }> {
  const search = query.trim().toLowerCase();
  return Object.entries(items)
    .map(([id, item]) => ({ id: Number(id), name: item.name }))
    .filter((item) => isEligible(item.id, context.format))
    .filter(
      (item) =>
        String(item.id).includes(search) ||
        item.name.toLowerCase().includes(search),
    )
    .sort((a, b) => a.id - b.id);
}
