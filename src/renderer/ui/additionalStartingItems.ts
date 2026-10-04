import isaacRacingCommon from "isaac-racing-common";
import type { AdditionalStartingItemsContext } from "../../common/additionalStartingItems";
import {
  canonicalizeAdditionalStartingItems,
  searchAdditionalStartingItems,
} from "../../common/additionalStartingItems";

const { ADDITIONAL_STARTING_ITEMS: policy, BUILDS, ITEMS } = isaacRacingCommon;
const items: Readonly<Record<string, { name: string }>> = ITEMS;
let selection: readonly number[] = [];

function contextFromForm(): AdditionalStartingItemsContext {
  const solo = $("input[name=new-race-size]:checked").val() === "solo";
  return {
    format: String($("#new-race-format").val()),
    character: String($("#new-race-character").val()),
    ranked: !solo || $("input[name=new-race-ranked]:checked").val() === "yes",
    solo,
    startingBuildIndex: Number($("#new-race-starting-build").val()),
  };
}

/** Return a fresh canonical submission without storing anything in settings. */
export function getSelection(
  context: AdditionalStartingItemsContext = contextFromForm(),
): readonly number[] {
  return canonicalizeAdditionalStartingItems(selection, context);
}

export function init(): void {
  $("#new-race-additional-search").on("input", render);
  $("#new-race-additional-clear").click(() => {
    selection = [];
    render();
  });
  $("#new-race-form").on("change", render);
}

/** A fresh tooltip starts empty, independently of remembered race settings. */
export function reset(): void {
  selection = [];
  $("#new-race-additional-search").val("");
  render();
}

export function refresh(): void {
  render();
}

function render() {
  const context = contextFromForm();
  const supported =
    policy.supportedRaceFormats.includes(context.format) &&
    !(context.ranked && context.solo) &&
    context.character !== "Tainted Lazarus";
  let valid = true;
  let message = "Select up to five additional passive items or familiars.";
  try {
    getSelection(context);
  } catch (error) {
    valid = false;
    message = error instanceof Error ? error.message : String(error);
  }
  if (!supported && selection.length === 0) {
    message = "Additional items are unavailable for this ruleset.";
  } else if (valid && context.format === "seeded") {
    const build = BUILDS[context.startingBuildIndex];
    message =
      build === undefined
        ? "Choose a specific build before selecting extras. Random allows no extras."
        : `${Math.max(0, policy.seededMaxResolvedItems - build.collectibles.length - selection.length)} extra slots remaining; maximum four items including the build.`;
  }
  $("#new-race-additional-count").text(`${selection.length} selected`);
  $("#new-race-additional-status").text(message).toggleClass("invalid", !valid);
  $("#new-race-form button[type=submit]").prop("disabled", !valid);
  $("#new-race-additional-search").prop("disabled", !supported);
  $("#new-race-additional-clear").prop("disabled", selection.length === 0);

  const focusedID = document.activeElement?.id;
  const selected = $("#new-race-additional-selected").empty();
  for (const id of selection) {
    const item = items[id];
    const button = $("<button></button>")
      .attr("type", "button")
      .attr("id", `new-race-extra-remove-${id}`)
      .attr("aria-label", `Remove ${item?.name ?? id}`)
      .addClass("button small")
      .toggleClass("invalid", !valid)
      .text(`${item?.name ?? id} (${id}) ×`)
      .click(() => {
        removeItem(id);
      });
    selected.append(button);
  }

  const results = $("#new-race-additional-results").empty();
  const choices = supported
    ? searchAdditionalStartingItems(
        String($("#new-race-additional-search").val()),
        context,
      )
    : [];
  for (const item of choices) {
    const inputID = `new-race-extra-${item.id}`;
    const input = $("<input>")
      .attr("type", "checkbox")
      .attr("id", inputID)
      .prop("checked", selection.includes(item.id))
      .on("change", () => {
        toggleItem(item.id, input.prop("checked") === true);
      });
    const label = $("<label></label>")
      .attr("for", inputID)
      .text(`${item.name} (${item.id})`);
    results.append($("<div></div>").append(input, label));
  }
  if (choices.length === 0) {
    results.text(supported ? "No matching items." : "Selector disabled.");
  }
  if (focusedID !== undefined && focusedID !== "") {
    document.querySelector<HTMLElement>(`#${CSS.escape(focusedID)}`)?.focus();
  }
}

function removeItem(id: number) {
  selection = selection.filter((selectedID) => selectedID !== id);
  render();
}

function toggleItem(id: number, checked: boolean) {
  selection = checked
    ? [...selection, id]
    : selection.filter((selectedID) => selectedID !== id);
  render();
}
