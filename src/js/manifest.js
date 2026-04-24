window.SmurdyQuizManifest = [
    {
        id: "click-country",
        title: "Click the Region",
        file: "manifest:click-country",
        mode: "countries",
        type: "click",
        difficulty: "Easy",
        tags: ["Regions", "Map"],
        groupSet: "country_groups",
        borders: 1,
        descriptionTemplate: "Click the correct region.",
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
        title: "Type the Region",
        file: "manifest:type-country",
        mode: "countries",
        type: "type",
        difficulty: "Medium",
        tags: ["Regions", "Map", "Typing"],
        groupSet: "country_groups",
        borders: 1,
        descriptionTemplate: "Type the highlighted region.",
        config: {
            mode: "type",
            titleBuilder: () => "Type the highlighted region",
            inputPlaceholder: "Type region name...",
            persistCompletedHighlights: true,
            showTargetOnWrong: false,
            clickableLayerId: null
        }
    },
    {
        id: "find-country",
        title: "Find the Region",
        file: "manifest:find-country",
        mode: "countries",
        type: "find",
        difficulty: "Hard",
        tags: ["Regions", "Map", "Memory", "No Borders"],
        groupSet: "country_groups",
        borders: 0,
        descriptionTemplate: "Find the region without borders.",
        config: {
            mode: "click",
            titleBuilder: (name) => `Click: ${name}`,
            persistCompletedHighlights: false,
            showTargetOnWrong: true,
            clickableLayerId: null
        }
    },
    {
        id: "find-point",
        title: "Find the Point",
        file: "manifest:find-point",
        type: "type",
        mode: "countries",
        difficulty: "Medium",
        tags: ["Regions","Typing","Point","Find"],
        groupSet: "country_groups",
        borders: 0,
        descriptionTemplate: "Type the region that contains the highlighted point.",
        config: {
            mode: "type",
            titleBuilder: () => "Type the region that contains the point",
            inputPlaceholder: "Type region name...",
            persistCompletedHighlights: false,
            showTargetOnWrong: false,
            clickableLayerId: null,
            findPoint: true
        }
    }
];