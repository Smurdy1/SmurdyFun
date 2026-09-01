(function initFlagQuiz(root, factory) {
    "use strict";

    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
    if (!root || !root.document) return;

    root.SmurdyFlagQuiz = api;
    const start = () => api.mount(root.document, root);
    if (root.document.readyState === "loading") {
        root.document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})(typeof window !== "undefined" ? window : null, function createFlagQuizApi() {
    "use strict";

    function normalizeAnswer(value) {
        return String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/&/g, "and")
            .replace(/[.'’]/g, "")
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function acceptedAnswers(name, aliases) {
        const values = [name, ...(Array.isArray(aliases?.[name]) ? aliases[name] : [])];
        return new Set(values.map(normalizeAnswer).filter(Boolean));
    }

    function selectFlags(source, setId) {
        const kind = setId === "us_states" ? "us-state" : "country";
        return (source?.flags || [])
            .filter(flag => flag.kind === kind && flag.name && flag.filename)
            .map(flag => ({
                id: `${flag.kind}:${flag.filename}`,
                name: String(flag.name),
                src: `/assets/flags/${flag.filename}`
            }));
    }

    function shuffle(items, random = Math.random) {
        const result = items.slice();
        for (let index = result.length - 1; index > 0; index--) {
            const swapIndex = Math.floor(random() * (index + 1));
            [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
        }
        return result;
    }

    function mount(document, root) {
        const body = document.body;
        const setId = body?.dataset.flagSet || "world";
        const launch = document.querySelector("[data-flag-launch]");
        const landing = document.querySelector("[data-flag-landing]");
        const game = document.querySelector("[data-flag-game]");
        const image = document.querySelector("[data-flag-image]");
        const form = document.querySelector("[data-flag-form]");
        const input = document.querySelector("[data-flag-input]");
        const result = document.querySelector("[data-flag-result]");
        const progress = document.querySelector("[data-flag-progress]");
        const accuracy = document.querySelector("[data-flag-accuracy]");
        const giveUp = document.querySelector("[data-flag-giveup]");
        const restart = document.querySelector("[data-flag-restart]");
        const review = document.querySelector("[data-flag-review]");

        if (!launch || !landing || !game || !image || !form || !input) return null;

        let flags = [];
        let aliases = {};
        let index = 0;
        let attempts = 0;
        let correct = 0;
        let locked = false;
        let misses = [];
        let loadPromise = null;

        function updateStats() {
            if (progress) progress.textContent = `${Math.min(index, flags.length)} / ${flags.length} completed`;
            if (accuracy) {
                const percent = attempts ? Math.round((correct / attempts) * 100) : 100;
                accuracy.textContent = `${percent}% correct`;
            }
        }

        function showQuestion() {
            locked = false;
            result.textContent = "";
            result.className = "flag-result";
            input.value = "";

            if (index >= flags.length) {
                image.removeAttribute("src");
                image.alt = "";
                image.hidden = true;
                form.hidden = true;
                giveUp.hidden = true;
                restart.hidden = false;
                result.textContent = `Finished! You identified ${correct} of ${flags.length} flags correctly.`;
                result.classList.add("is-finished");
                if (review) {
                    review.hidden = misses.length === 0;
                    review.innerHTML = misses.length
                        ? `<h2>Review your misses</h2><ul>${misses.map(name => `<li>${escapeHtml(name)}</li>`).join("")}</ul>`
                        : "";
                }
                updateStats();
                return;
            }

            const current = flags[index];
            image.hidden = false;
            image.src = current.src;
            image.alt = `Flag number ${index + 1}`;
            form.hidden = false;
            giveUp.hidden = false;
            restart.hidden = true;
            updateStats();
            input.focus({ preventScroll: true });

            const next = flags[index + 1];
            if (next) new Image().src = next.src;
        }

        function escapeHtml(value) {
            return String(value)
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll('"', "&quot;")
                .replaceAll("'", "&#39;");
        }

        function finishQuestion(wasCorrect, guess, gaveUp = false) {
            if (locked || !flags[index]) return;
            locked = true;
            attempts++;

            const current = flags[index];
            if (wasCorrect) {
                correct++;
                result.textContent = "Correct!";
                result.classList.add("is-correct");
            } else {
                misses.push(current.name);
                result.textContent = `The answer was ${current.name}.`;
                result.classList.add("is-wrong");
                try {
                    root.SmurdyWeakSpots?.recordMiss?.({
                        name: current.name,
                        mode: "type-flag",
                        group: setId,
                        guess: gaveUp ? "" : String(guess || "")
                    });
                } catch (_) {}
            }

            updateStats();
            root.setTimeout(() => {
                index++;
                showQuestion();
            }, wasCorrect ? 500 : 1100);
        }

        function submitAnswer(event) {
            event.preventDefault();
            if (locked || !flags[index]) return;
            const guess = normalizeAnswer(input.value);
            if (!guess) return;
            const answers = acceptedAnswers(flags[index].name, aliases);
            finishQuestion(answers.has(guess), input.value);
        }

        function restartQuiz() {
            flags = shuffle(flags);
            index = 0;
            attempts = 0;
            correct = 0;
            misses = [];
            locked = false;
            if (review) {
                review.hidden = true;
                review.innerHTML = "";
            }
            showQuestion();
        }

        async function loadData() {
            if (!loadPromise) {
                loadPromise = Promise.all([
                    root.fetch("/src/data/flag_sources.json").then(response => {
                        if (!response.ok) throw new Error(`Flag data returned HTTP ${response.status}`);
                        return response.json();
                    }),
                    root.fetch("/src/data/aliases.json").then(response => response.ok ? response.json() : {})
                ]);
            }
            return loadPromise;
        }

        async function launchQuiz() {
            if (launch.disabled) return;
            launch.disabled = true;
            launch.textContent = "Loading flags...";

            try {
                const [source, loadedAliases] = await loadData();
                flags = shuffle(selectFlags(source, setId));
                aliases = loadedAliases || {};
                if (!flags.length) throw new Error(`No flags found for ${setId}`);

                landing.hidden = true;
                game.hidden = false;
                document.body.classList.add("flag-quiz-running");
                try { root.SmurdyQuizLibrary?.recordPlayed?.("type-flag", setId); } catch (_) {}
                restartQuiz();
            } catch (error) {
                console.error("Could not start flag quiz", error);
                launch.disabled = false;
                launch.textContent = "Try again";
                result.textContent = "The flags could not load. Please try again.";
            }
        }

        launch.addEventListener("click", launchQuiz);
        form.addEventListener("submit", submitAnswer);
        giveUp?.addEventListener("click", () => finishQuestion(false, "", true));
        restart?.addEventListener("click", restartQuiz);

        return { launchQuiz, restartQuiz };
    }

    return { normalizeAnswer, acceptedAnswers, selectFlags, shuffle, mount };
});
