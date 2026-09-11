const test = require("node:test");
const assert = require("node:assert/strict");

const suggestions = require("../src/js/quiz_suggestions.js");

test("subregional quizzes suggest a larger related group in the same mode", () => {
    const result = suggestions.buildSuggestion({
        quizId: "click-country",
        groupId: "west_africa",
        groupLabel: "West Africa"
    });

    assert.equal(result.type, "larger-group");
    assert.equal(result.quizId, "click-country");
    assert.equal(result.groupId, "africa");
    assert.equal(result.url, "/quizzes/click-country/africa/");
    assert.match(result.description, /same Click Countries mode/i);
});

test("major-region quizzes suggest the same group in another mode", () => {
    const result = suggestions.buildSuggestion({
        quizId: "click-country",
        groupId: "europe",
        groupLabel: "Europe"
    });

    assert.equal(result.type, "other-mode");
    assert.equal(result.quizId, "type-country");
    assert.equal(result.groupId, "europe");
    assert.equal(result.url, "/quizzes/type-country/europe/");
});

test("mode progression gets harder instead of recommending the same quiz again", () => {
    assert.equal(
        suggestions.buildSuggestion({ quizId: "type-country", groupId: "asia" }).quizId,
        "find-country"
    );
    assert.equal(
        suggestions.buildSuggestion({ quizId: "find-country", groupId: "asia" }).quizId,
        "find-point"
    );
    assert.equal(
        suggestions.buildSuggestion({ quizId: "find-point", groupId: "asia" }).quizId,
        "click-country"
    );
});

test("US state flags and capitals cross over to the state map family", () => {
    assert.equal(
        suggestions.buildSuggestion({ quizId: "type-flag", groupId: "us_states" }).quizId,
        "click-subdivision"
    );
    assert.equal(
        suggestions.buildSuggestion({ quizId: "type-capital", groupId: "us_states" }).quizId,
        "click-subdivision"
    );
});

test("special groups step up before changing modes", () => {
    const result = suggestions.buildSuggestion({
        quizId: "type-flag",
        groupId: "balkans",
        groupLabel: "Balkans"
    });

    assert.equal(result.type, "larger-group");
    assert.equal(result.quizId, "type-flag");
    assert.equal(result.groupId, "europe");
});

test("invalid completion context produces no recommendation", () => {
    assert.equal(suggestions.buildSuggestion({ quizId: "", groupId: "europe" }), null);
    assert.equal(suggestions.buildSuggestion({ quizId: "click-country", groupId: "bad group" }), null);
});
