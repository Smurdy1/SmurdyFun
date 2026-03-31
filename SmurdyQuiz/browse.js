(() => {
    const baseManifest = window.SmurdyQuizManifest || [];
    let manifest = [];
    let groups = {};

    function getQuizTypeLabel(type) {
        if (type === "click") return "Click";
        if (type === "type") return "Type";
        if (type === "find") return "Find";
        return type || "Quiz";
    }

    function buildExpandedManifest() {
        const expanded = [];

        for (const quiz of baseManifest) {
            if (!quiz.groupSet) {
                expanded.push(quiz);
                continue;
            }

            for (const [groupId, group] of Object.entries(groups)) {
                const allowedTypes = group.allowedTypes || [];
                if (!allowedTypes.includes(quiz.type)) continue;

                expanded.push({
                    ...quiz,
                    id: `${quiz.id}_${groupId}`,
                    title: `${group.label} ${getQuizTypeLabel(quiz.type)} Quiz`,
                    description: quiz.descriptionTemplate
                        ? quiz.descriptionTemplate.replaceAll("{group}", group.label)
                        : (quiz.description || ""),
                    tags: [...new Set([...(quiz.tags || []), group.label])],
                    group: groupId
                });
            }
        }

        return expanded;
    }

    function ensureBrowserUI() {
        let panel = document.getElementById("quiz-browser");

        if (panel) return panel;

        panel = document.createElement("div");
        panel.id = "quiz-browser";
        panel.innerHTML = `
            <div id="quiz-browser-header">
                <div id="quiz-browser-title">Choose a Quiz</div>
                <div id="quiz-browser-subtitle">Loading quizzes...</div>
            </div>

            <div id="quiz-browser-controls">
                <input id="quiz-search" type="text" placeholder="Search quizzes..." />
            </div>

            <div id="quiz-browser-list"></div>
        `;

        document.body.appendChild(panel);
        injectBrowserStyles();

        return panel;
    }

    function injectBrowserStyles() {
        if (document.getElementById("quiz-browser-styles")) return;

        const style = document.createElement("style");
        style.id = "quiz-browser-styles";
        style.textContent = `
            #quiz-browser {
                position: absolute;
                top: 16px;
                right: 16px;
                width: 360px;
                max-height: calc(100vh - 32px);
                overflow: hidden;
                z-index: 2000;
                background: rgba(255, 255, 255, 0.96);
                border-radius: 16px;
                box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
                backdrop-filter: blur(8px);
                display: flex;
                flex-direction: column;
                font-family: Arial, sans-serif;
            }

            #quiz-browser-header {
                padding: 16px 16px 10px 16px;
                border-bottom: 1px solid rgba(0, 0, 0, 0.08);
            }

            #quiz-browser-title {
                font-size: 22px;
                font-weight: 700;
                color: #1f1f1f;
            }

            #quiz-browser-subtitle {
                margin-top: 4px;
                font-size: 13px;
                color: #666;
            }

            #quiz-browser-controls {
                padding: 12px 16px;
                border-bottom: 1px solid rgba(0, 0, 0, 0.08);
            }

            #quiz-search {
                width: 100%;
                box-sizing: border-box;
                padding: 10px 12px;
                border: 1px solid #d8d8d8;
                border-radius: 10px;
                font-size: 14px;
                outline: none;
            }

            #quiz-search:focus {
                border-color: #888;
            }

            #quiz-browser-list {
                overflow-y: auto;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .quiz-card {
                background: #f7f7f7;
                border: 1px solid #e7e7e7;
                border-radius: 14px;
                padding: 14px;
                transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
            }

            .quiz-card:hover {
                background: #fbfbfb;
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
                transform: translateY(-1px);
            }

            .quiz-card-top {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 10px;
            }

            .quiz-card-title {
                font-size: 17px;
                font-weight: 700;
                color: #1f1f1f;
                margin: 0;
            }

            .quiz-difficulty {
                font-size: 12px;
                font-weight: 600;
                color: #444;
                background: #ececec;
                padding: 5px 8px;
                border-radius: 999px;
                white-space: nowrap;
            }

            .quiz-card-description {
                margin-top: 8px;
                font-size: 13px;
                line-height: 1.4;
                color: #555;
            }

            .quiz-tags {
                margin-top: 10px;
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
            }

            .quiz-tag {
                font-size: 11px;
                color: #555;
                background: #ebebeb;
                padding: 4px 7px;
                border-radius: 999px;
            }

            .quiz-card-actions {
                margin-top: 12px;
                display: flex;
                justify-content: flex-end;
            }

            .quiz-play-button {
                border: none;
                border-radius: 10px;
                background: #222;
                color: white;
                padding: 9px 12px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
            }

            .quiz-play-button:hover {
                background: #3a3a3a;
            }

            .quiz-empty {
                padding: 20px 8px;
                text-align: center;
                color: #666;
                font-size: 14px;
            }
        `;
        document.head.appendChild(style);
    }

    function renderQuizList(filterText = "") {
        const list = document.getElementById("quiz-browser-list");
        if (!list) return;

        const q = filterText.trim().toLowerCase();

        const filtered = manifest.filter(quiz => {
            const haystack = [
                quiz.title,
                quiz.description,
                quiz.difficulty,
                ...(quiz.tags || [])
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return haystack.includes(q);
        });

        if (filtered.length === 0) {
            list.innerHTML = `<div class="quiz-empty">No quizzes found.</div>`;
            return;
        }

        list.innerHTML = filtered.map(quiz => `
            <div class="quiz-card" data-quiz-id="${escapeHtml(quiz.id)}">
                <div class="quiz-card-top">
                    <h3 class="quiz-card-title">${escapeHtml(quiz.title || "Untitled Quiz")}</h3>
                    <div class="quiz-difficulty">${escapeHtml(quiz.difficulty || "Unknown")}</div>
                </div>

                <div class="quiz-card-description">
                    ${escapeHtml(quiz.description || "")}
                </div>

                <div class="quiz-tags">
                    ${(quiz.tags || []).map(tag => `<span class="quiz-tag">${escapeHtml(tag)}</span>`).join("")}
                </div>

                <div class="quiz-card-actions">
                    <button
                        class="quiz-play-button"
                        data-quiz-file="${escapeHtml(quiz.file)}"
                        data-quiz-mode="${escapeHtml(quiz.mode || "countries")}"
                        data-quiz-borders="${escapeHtml(String(quiz.borders ?? ""))}"
                        data-quiz-group="${escapeHtml(quiz.group || "")}"
                    >
                        Play
                    </button>
                </div>
            </div>
        `).join("");

        list.querySelectorAll(".quiz-play-button").forEach(button => {
            button.addEventListener("click", () => {
                const file = button.dataset.quizFile;
                const mode = button.dataset.quizMode;
                const borders = button.dataset.quizBorders;
                const group = button.dataset.quizGroup;

                const extraParams = {};
                if (borders) extraParams.borders = borders;
                if (group) extraParams.group = group;

                launchQuiz(file, mode, extraParams);
            });
        });
    }

    function launchQuiz(file, mode, extraParams = {}) {
        const params = new URLSearchParams();
        params.set("mode", mode);
        params.set("quiz", file);

        for (const [key, value] of Object.entries(extraParams)) {
            params.set(key, value);
        }

        window.location.search = params.toString();
    }

    function escapeHtml(text) {
        return String(text)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    async function init() {
        ensureBrowserUI();

        try {
            const res = await fetch("./country_groups.json");
            groups = await res.json();
        } catch (err) {
            console.warn("Could not load country_groups.json", err);
            groups = {};
        }

        manifest = buildExpandedManifest();
        renderQuizList();

        const subtitle = document.getElementById("quiz-browser-subtitle");
        if (subtitle) {
            subtitle.textContent = `${manifest.length} quiz${manifest.length === 1 ? "" : "zes"}`;
        }

        const search = document.getElementById("quiz-search");
        if (search) {
            search.addEventListener("input", () => {
                renderQuizList(search.value);
            });
        }
    }

    init();
})();