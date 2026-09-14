const test = require("node:test");
const assert = require("node:assert/strict");
const routes = require("../src/js/quiz_routes.js");

test("canonical routes separate category mode family and group", () => {
  assert.equal(routes.canonicalPath("click-country", "world"), "/quizzes/maps/click/countries/world/");
  assert.equal(routes.canonicalPath("click-subdivision", "us_states"), "/quizzes/maps/click/subdivisions/us_states/");
  assert.equal(routes.canonicalPath("type-capital", "world"), "/quizzes/capitals/type/countries/world/");
  assert.equal(routes.canonicalPath("type-capital", "us_states"), "/quizzes/capitals/type/subdivisions/us_states/");
  assert.equal(routes.canonicalPath("type-flag", "world"), "/quizzes/flags/type/countries/world/");
  assert.equal(routes.canonicalPath("type-flag", "us_states"), "/quizzes/flags/type/subdivisions/us_states/");
});

test("canonical paths resolve back to legacy runtime IDs", () => {
  assert.deepEqual(routes.parsePath("/quizzes/maps/type/subdivisions/us_states/"), { quizId: "type-subdivision", groupId: "us_states", category: "maps", interaction: "type", family: "subdivisions", canonical: true });
  assert.deepEqual(routes.parsePath("/quizzes/capitals/type/subdivisions/us_states/"), { quizId: "type-capital", groupId: "us_states", category: "capitals", interaction: "type", family: "subdivisions", canonical: true });
});

test("legacy quiz URLs remain parseable", () => {
  const parsed = routes.parsePath("/quizzes/type-flag/us_states/");
  assert.equal(parsed.quizId, "type-flag");
  assert.equal(parsed.family, "subdivisions");
  assert.equal(parsed.canonical, false);
});
