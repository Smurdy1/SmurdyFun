window.SmurdyQuizManifest = [
    {
        id: "click-country",
        file: "manifest:click-country",
        mode: "countries",
        type: "click",
        difficulty: "Easy",
        tags: ["Countries", "Map"],
        groupSet: "country_groups",
        borders: 1,
        descriptionTemplate: "Click the correct country in {group}.",
        // inline quiz runner config (used instead of loading a separate file)
        config: {
            mode: "click",
            titleBuilder: (name) => `Click: ${name}`,
            persistCompletedHighlights: true,
            showTargetOnWrong: true,
            clickableLayerId: null
        }
    },
    {
        id: "type-country",
        file: "manifest:type-country",
        mode: "countries",
        type: "type",
        difficulty: "Medium",
        tags: ["Countries", "Map", "Typing"],
        groupSet: "country_groups",
        borders: 1,
        descriptionTemplate: "Type the highlighted country in {group}.",
        config: {
            mode: "type",
            titleBuilder: () => "Type the highlighted country",
            inputPlaceholder: "Type country name...",
            persistCompletedHighlights: true,
            showTargetOnWrong: false,
            clickableLayerId: null
        }
    },
    {
        id: "find-country",
        file: "manifest:find-country",
        mode: "countries",
        type: "find",
        difficulty: "Hard",
        tags: ["Countries", "Map", "Memory", "No Borders"],
        groupSet: "country_groups",
        borders: 0,
        descriptionTemplate: "Find the country in {group} without borders.",
        config: {
            mode: "click",
            titleBuilder: (name) => `Click: ${name}`,
            persistCompletedHighlights: false,
            showTargetOnWrong: true,
            clickableLayerId: null
        }
    }
];