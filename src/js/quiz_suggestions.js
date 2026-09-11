(function initQuizSuggestions(root, factory) {
    "use strict";

    const api = factory(root);
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.SmurdyQuizSuggestions = api;
})(typeof window !== "undefined" ? window : null, function createQuizSuggestionsApi(root) {
    "use strict";

    const STYLE_ID = "smurdy-quiz-suggestions-style-v1";
    const DIALOG_SELECTOR = "[data-smurdy-quiz-suggestion-dialog]";

    const LARGER_GROUPS = Object.freeze({
        west_africa: "africa",
        east_africa: "africa",
        southern_africa: "africa",
        central_africa: "africa",
        north_africa: "africa",
        southeast_asia: "asia",
        south_asia: "asia",
        east_asia: "asia",
        central_asia: "asia",
        middle_east: "asia",
        eastern_europe: "europe",
        western_europe: "europe",
        balkans: "europe",
        eu: "europe",
        european_union: "europe",
        central_america: "north_america",
        caribbean_islands: "north_america",
        central_america_and_caribbean: "north_america",
        latin_america: "world",
        spanish_speaking: "world",
        former_soviet_union: "world",
        tiny_countries: "world",
        eurasia: "world",
        mena: "world"
    });

    const GROUP_LABELS = Object.freeze({
        world: "World",
        europe: "Europe",
        asia: "Asia",
        africa: "Africa",
        north_america: "North America",
        south_america: "South America",
        oceania: "Oceania",
        us_states: "US States"
    });

    const NEXT_MODE = Object.freeze({
        "click-country": "type-country",
        "type-country": "find-country",
        "find-country": "find-point",
        "find-point": "click-country",
        "type-capital": "click-country",
        "type-flag": "click-country",
        "click-subdivision": "type-subdivision",
        "type-subdivision": "find-subdivision",
        "find-subdivision": "find-point-subdivision",
        "find-point-subdivision": "click-subdivision"
    });

    const MODE_LABELS = Object.freeze({
        "click-country": "Click Countries",
        "type-country": "Type Countries",
        "find-country": "No Borders",
        "find-point": "Find from a Point",
        "type-capital": "Type Capitals",
        "type-flag": "Flags",
        "click-subdivision": "Click States",
        "type-subdivision": "Type States",
        "find-subdivision": "No Borders States",
        "find-point-subdivision": "Find State from a Point"
    });

    function cleanId(value) {
        const normalized = String(value || "").trim().toLowerCase();
        return /^[a-z0-9_-]+$/.test(normalized) ? normalized : "";
    }

    function humanize(value) {
        return String(value || "")
            .replace(/[_-]+/g, " ")
            .replace(/\b\w/g, character => character.toUpperCase());
    }

    function modeLabel(quizId) {
        return MODE_LABELS[quizId] || humanize(quizId || "Quiz");
    }

    function groupLabel(groupId, fallback = "") {
        return GROUP_LABELS[groupId] || fallback || humanize(groupId || "World");
    }

    function routeFor(quizId, groupId) {
        return `/quizzes/${encodeURIComponent(quizId)}/${encodeURIComponent(groupId)}/`;
    }

    function alternateModeFor(result) {
        const quizId = cleanId(result?.quizId);
        const groupId = cleanId(result?.groupId);
        if (!quizId || !groupId) return null;

        if (quizId === "type-flag" && groupId === "us_states") return "click-subdivision";
        if (quizId === "type-capital" && groupId === "us_states") return "click-subdivision";
        return NEXT_MODE[quizId] || null;
    }

    function buildSuggestion(result) {
        const quizId = cleanId(result?.quizId);
        const groupId = cleanId(result?.groupId);
        if (!quizId || !groupId) return null;

        const currentGroupLabel = groupLabel(groupId, result?.groupLabel);
        const largerGroupId = LARGER_GROUPS[groupId];
        if (largerGroupId) {
            const largerLabel = groupLabel(largerGroupId);
            return Object.freeze({
                type: "larger-group",
                quizId,
                groupId: largerGroupId,
                groupLabel: largerLabel,
                modeLabel: modeLabel(quizId),
                url: routeFor(quizId, largerGroupId),
                title: `Try ${largerLabel} next`,
                description: `You finished ${currentGroupLabel}. Keep the same ${modeLabel(quizId)} mode and step up to ${largerLabel}.`,
                actionLabel: `Play ${largerLabel}`
            });
        }

        const nextQuizId = alternateModeFor(result);
        if (!nextQuizId || nextQuizId === quizId) return null;
        const nextModeLabel = modeLabel(nextQuizId);
        return Object.freeze({
            type: "other-mode",
            quizId: nextQuizId,
            groupId,
            groupLabel: currentGroupLabel,
            modeLabel: nextModeLabel,
            url: routeFor(nextQuizId, groupId),
            title: `Try ${currentGroupLabel} another way`,
            description: `You finished ${currentGroupLabel} in ${modeLabel(quizId)}. Try the same set in ${nextModeLabel} next.`,
            actionLabel: `Play ${nextModeLabel}`
        });
    }

    function injectStyles(document) {
        if (!document || document.getElementById(STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            .smurdy-quiz-suggestion-dialog {
                width: min(430px, calc(100vw - 28px));
                max-width: none;
                padding: 0;
                border: 1px solid rgba(0,0,0,.18);
                border-radius: 10px;
                background: #fff;
                color: #171717;
                box-shadow: 0 14px 40px rgba(0,0,0,.2);
                font-family: Arial, Helvetica, sans-serif;
            }
            .smurdy-quiz-suggestion-dialog::backdrop { background: rgba(14,25,32,.38); }
            .smurdy-quiz-suggestion-card { padding: 20px; }
            .smurdy-quiz-suggestion-card h2 {
                margin: 0 0 8px;
                font-size: 23px;
                line-height: 1.2;
            }
            .smurdy-quiz-suggestion-card p {
                margin: 0;
                color: #4a4a4a;
                line-height: 1.5;
            }
            .smurdy-quiz-suggestion-actions {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-top: 18px;
            }
            .smurdy-quiz-suggestion-play,
            .smurdy-quiz-suggestion-close {
                min-height: 40px;
                padding: 9px 13px;
                border-radius: 5px;
                font: inherit;
                font-weight: 700;
                cursor: pointer;
            }
            .smurdy-quiz-suggestion-play {
                border: 1px solid #075f9e;
                background: #075f9e;
                color: #fff;
            }
            .smurdy-quiz-suggestion-play:hover { background: #064f83; }
            .smurdy-quiz-suggestion-close {
                border: 0;
                background: transparent;
                color: #555;
            }
            .smurdy-quiz-suggestion-close:hover { color: #075f9e; text-decoration: underline; }
            .smurdy-quiz-suggestion-play:focus-visible,
            .smurdy-quiz-suggestion-close:focus-visible {
                outline: 3px solid rgba(0,119,204,.28);
                outline-offset: 2px;
            }
            @media (max-width: 520px) {
                .smurdy-quiz-suggestion-actions { align-items: stretch; flex-direction: column; }
                .smurdy-quiz-suggestion-play, .smurdy-quiz-suggestion-close { width: 100%; }
            }
        `;
        document.head.appendChild(style);
    }

    function closeDialog(dialog) {
        if (!dialog) return;
        if (typeof dialog.close === "function" && dialog.open) dialog.close();
        else dialog.hidden = true;
    }

    function launchSuggestion(suggestion) {
        if (!suggestion || !root?.location) return false;
        try {
            root.SmurdyQuizLaunchIntent?.store?.(
                suggestion.quizId,
                suggestion.groupId,
                "completion_suggestion"
            );
        } catch (_) {}
        root.location.href = suggestion.url;
        return true;
    }

    function createDialog(document) {
        const dialog = document.createElement("dialog");
        dialog.className = "smurdy-quiz-suggestion-dialog";
        dialog.dataset.smurdyQuizSuggestionDialog = "";
        dialog.setAttribute("aria-labelledby", "smurdy-quiz-suggestion-title");
        dialog.innerHTML = `
            <div class="smurdy-quiz-suggestion-card">
                <h2 id="smurdy-quiz-suggestion-title"></h2>
                <p data-smurdy-quiz-suggestion-copy></p>
                <div class="smurdy-quiz-suggestion-actions">
                    <button type="button" class="smurdy-quiz-suggestion-play"></button>
                    <button type="button" class="smurdy-quiz-suggestion-close">Not now</button>
                </div>
            </div>`;
        dialog.querySelector(".smurdy-quiz-suggestion-close").addEventListener("click", () => closeDialog(dialog));
        dialog.addEventListener("cancel", () => closeDialog(dialog));
        dialog.addEventListener("click", event => {
            if (event.target === dialog) closeDialog(dialog);
        });
        dialog.querySelector(".smurdy-quiz-suggestion-play").addEventListener("click", () => {
            launchSuggestion(dialog._smurdySuggestion);
        });
        document.body.appendChild(dialog);
        return dialog;
    }

    function show(result, options = {}) {
        if (options.suppress) return null;
        const document = options.document || root?.document;
        if (!document?.body) return null;
        const suggestion = buildSuggestion(result);
        if (!suggestion) return null;

        injectStyles(document);
        let dialog = document.querySelector(DIALOG_SELECTOR);
        if (!dialog) dialog = createDialog(document);
        dialog._smurdySuggestion = suggestion;
        dialog.querySelector("#smurdy-quiz-suggestion-title").textContent = suggestion.title;
        dialog.querySelector("[data-smurdy-quiz-suggestion-copy]").textContent = suggestion.description;
        dialog.querySelector(".smurdy-quiz-suggestion-play").textContent = suggestion.actionLabel;

        const delay = Math.max(0, Number(options.delayMs ?? 450) || 0);
        const open = () => {
            if (typeof dialog.showModal === "function") {
                if (!dialog.open) dialog.showModal();
            } else {
                dialog.hidden = false;
            }
        };
        if (delay && root?.setTimeout) root.setTimeout(open, delay);
        else open();
        return suggestion;
    }

    return Object.freeze({
        LARGER_GROUPS,
        NEXT_MODE,
        modeLabel,
        groupLabel,
        buildSuggestion,
        launchSuggestion,
        show
    });
});
