window.runNameQuiz = function runNameQuiz(config) {
    const SQ = window.SmurdyQuiz;

    const {
        mode, // "click" or "type"
        titleBuilder,
        inputPlaceholder = "Type answer...",
        successText = "Correct!",
        wrongText = (answer) => `Wrong: ${answer}`,
        doneText = (timeText) => `Finished in ${timeText}`,
        persistCompletedHighlights = true,
        showTargetOnWrong = true,
        clickableLayerId = null
    } = config;

    let currentName = null;
    let locked = false;
    let completed = new Set();

    let attempts = 0;
    let correctAnswers = 0;

    let inputEl = null;
    let submitButton = null;

    let timerInterval = null;
    let startTime = null;
    let finalElapsedMs = 0;

    function getNames() {
        return SQ.getAllNames();
    }

    function setState(name, stateName) {
        return SQ.setFeatureStateByName(name, stateName);
    }

    function clearStates() {
        SQ.clearAllStates();
    }

    function randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    function getRemaining() {
        return getNames().filter(name => !completed.has(name));
    }

    function updateCounter() {
        const total = getNames().length;
        SQ.setProgressText(`${completed.size} / ${total} completed`);
    }

    function updateAccuracy() {
        const percent = attempts === 0
            ? 100
            : Math.round((correctAnswers / attempts) * 100);

        SQ.setAccuracyText(`${percent}% correct`);
    }

    function repaintCompleted() {
        if (!persistCompletedHighlights) return;

        for (const name of completed) {
            setState(name, "correct");
        }
    }

    function normalizeName(text) {
        return text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/&/g, "and")
            .replace(/[^a-z0-9 ]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function formatElapsed(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    function setTimerText(ms) {
        const el = document.getElementById("quiz-timer");
        if (el) el.textContent = formatElapsed(ms);
    }

    function startTimer() {
        stopTimer();
        startTime = Date.now();
        finalElapsedMs = 0;
        setTimerText(0);

        timerInterval = setInterval(() => {
            finalElapsedMs = Date.now() - startTime;
            setTimerText(finalElapsedMs);
        }, 100);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function resetTimer() {
        stopTimer();
        startTime = null;
        finalElapsedMs = 0;
        setTimerText(0);
    }

    function removeTypingUI() {
        const old = document.getElementById("type-quiz-controls");
        if (old) old.remove();
        inputEl = null;
        submitButton = null;
    }

    function createTypingUI() {
        removeTypingUI();

        const controls = document.createElement("div");
        controls.id = "type-quiz-controls";
        controls.style.marginTop = "10px";
        controls.style.display = "flex";
        controls.style.gap = "8px";

        inputEl = document.createElement("input");
        inputEl.type = "text";
        inputEl.placeholder = inputPlaceholder;
        inputEl.autocomplete = "off";
        inputEl.spellcheck = false;
        inputEl.style.flex = "1";
        inputEl.style.padding = "8px 10px";
        inputEl.style.border = "1px solid #ccc";
        inputEl.style.borderRadius = "8px";
        inputEl.style.fontSize = "14px";

        submitButton = document.createElement("button");
        submitButton.textContent = "Guess";
        submitButton.style.padding = "8px 12px";
        submitButton.style.border = "none";
        submitButton.style.borderRadius = "8px";
        submitButton.style.background = "#222";
        submitButton.style.color = "white";
        submitButton.style.cursor = "pointer";

        controls.appendChild(inputEl);
        controls.appendChild(submitButton);

        const panel = document.getElementById("quiz-panel");
        panel.appendChild(controls);

        submitButton.addEventListener("click", submitGuess);
        inputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") submitGuess();
        });
    }

    function setInputEnabled(enabled) {
        if (!inputEl || !submitButton) return;
        inputEl.disabled = !enabled;
        submitButton.disabled = !enabled;
    }

    function focusInput() {
        if (!inputEl) return;
        inputEl.focus();
        inputEl.select();
    }

    function nextQuestion() {
        const remaining = getRemaining();

        if (remaining.length === 0) {
            const total = getNames().length;
            SQ.setTargetText("Done!");
            SQ.setProgressText(`${total} / ${total} completed`);
            SQ.setResultText(doneText(formatElapsed(finalElapsedMs)));
            currentName = null;
            locked = true;
            stopTimer();
            setInputEnabled(false);
            return;
        }

        currentName = randomChoice(remaining);
        locked = false;

        clearStates();
        repaintCompleted();

        if (mode === "type") {
            setState(currentName, "target");
            if (typeof SQ.zoomToFeatureByName === "function") {
                SQ.zoomToFeatureByName(currentName);
            }
        }

        SQ.setTargetText(titleBuilder(currentName));
        SQ.setResultText("");
        updateCounter();
        updateAccuracy();

        if (mode === "type") {
            if (inputEl) inputEl.value = "";
            setInputEnabled(true);
            focusInput();
        }
    }

    function restartQuiz() {
        currentName = null;
        locked = false;
        completed = new Set();
        attempts = 0;
        correctAnswers = 0;

        clearStates();
        SQ.setResultText("");
        updateCounter();
        updateAccuracy();
        resetTimer();
        startTimer();

        if (typeof SQ.resetView === "function") {
            SQ.resetView();
        }
        if (mode === "type" && inputEl) {
            inputEl.value = "";
            setInputEnabled(true);
        }

        nextQuestion();
    }

    function finishCorrect() {
        correctAnswers++;
        completed.add(currentName);

        setState(currentName, "correct");
        SQ.setResultText(successText);
        updateCounter();
        updateAccuracy();

        setTimeout(() => {
            if (!persistCompletedHighlights) {
                clearStates();
            }
            nextQuestion();
        }, 700);
    }

    function finishWrong(clickedOrGuess) {
        if (mode === "click") {
            setState(clickedOrGuess, "wrong");
        } else {
            setState(currentName, "wrong");
        }

        if (showTargetOnWrong && mode === "click") {
            setState(currentName, "target");
        }

        SQ.setResultText(wrongText(currentName));
        updateAccuracy();

        setTimeout(() => {
            clearStates();
            repaintCompleted();
            nextQuestion();
        }, 900);
    }

    function handleClick(clickedName) {
        if (locked || !currentName) return;
        if (!clickedName || clickedName === "Unknown") return;
        if (completed.has(clickedName)) return;

        locked = true;
        attempts++;

        if (clickedName === currentName) {
            finishCorrect();
        } else {
            finishWrong(clickedName);
        }
    }

    function submitGuess() {
        if (locked || !currentName || !inputEl) return;

        const guess = inputEl.value.trim();
        if (!guess) return;

        locked = true;
        attempts++;

        if (SQ.isAcceptedAnswer(currentName, guess)) {
            finishCorrect();
        } else {
            finishWrong(guess);
        }
    }

    const restartButton = document.getElementById("quiz-restart");
    if (restartButton) restartButton.onclick = restartQuiz;

    const backButton = document.getElementById("quiz-back");
    if (backButton) backButton.onclick = () => SQ.goToMainMenu();

    if (mode === "type") {
        createTypingUI();
    } else if (mode === "click") {
        removeTypingUI();

        SQ.map.on("click", (e) => {
            const feature = SQ.getClickedMainFeature(e.point);
            if (!feature) return;

            const clickedName = SQ.getFeatureName(feature);
            handleClick(clickedName);
        });
    }

    updateCounter();
    updateAccuracy();
    resetTimer();
    startTimer();
    nextQuestion();
};