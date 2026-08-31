const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildTargets,
  countryDestination,
  preferredClaim,
  updateCountryFlagPaths,
} = require("../tools/sync_wikimedia_flags");

test("keeps custom country filenames and uses codes for normal countries", () => {
  assert.equal(
    countryDestination({ code: "so", flag_1x1: "/assets/flags/somaliland.svg" }),
    "somaliland.svg",
  );
  assert.equal(countryDestination({ code: "us", flag_1x1: "flags/1x1/us.svg" }), "us.svg");
});

test("builds country and 50-state targets without including DC", () => {
  const countryFlags = [{ name: "Example", code: "ex", flag_1x1: "flags/1x1/ex.svg" }];
  const countries = {
    features: [{ properties: { NAME: "Example", ISO_A2: "EX", WIKIDATAID: "Q1" } }],
  };
  const states = {
    features: [
      {
        properties: {
          admin: "United States of America",
          type_en: "State",
          name: "Example State",
          iso_3166_2: "US-EX",
          wikidataid: "Q2",
        },
      },
      {
        properties: {
          admin: "United States of America",
          type_en: "Federal District",
          name: "District of Columbia",
          iso_3166_2: "US-DC",
          wikidataid: "Q61",
        },
      },
    ],
  };
  assert.deepEqual(buildTargets(countryFlags, countries, states), [
    { kind: "country", name: "Example", code: "ex", qid: "Q1", filename: "ex.svg" },
    {
      kind: "us-state",
      name: "Example State",
      code: "us-ex",
      qid: "Q2",
      filename: "us-ex.svg",
    },
  ]);
});

test("prefers preferred-rank P41 claims", () => {
  const normal = { rank: "normal", mainsnak: { datavalue: { value: "old.svg" } } };
  const preferred = { rank: "preferred", mainsnak: { datavalue: { value: "new.svg" } } };
  assert.equal(preferredClaim([normal, preferred]), preferred);
});

test("points both legacy aspect-ratio fields at the native Commons SVG", () => {
  const entries = [{ name: "Example", flag_1x1: "old-square.svg", flag_4x3: "old.svg" }];
  const targets = [{ kind: "country", name: "Example", filename: "ex.svg" }];
  assert.deepEqual(updateCountryFlagPaths(entries, targets), [
    {
      name: "Example",
      flag_1x1: "/assets/flags/ex.svg",
      flag_4x3: "/assets/flags/ex.svg",
    },
  ]);
});
