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
        shortDescription: "Click the highlighted region to select it.",
        longDescription: "This {label} map quiz tests your ability to identify {adjective} {borderset} by clicking them on the map.",
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
        shortDescription: "Type the name of the highlighted region.",
        longDescription: "This {label} map quiz tests your ability to identify {adjective} {borderset} by typing their names.",
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
        shortDescription: "Find the correct region when borders are hidden.",
        longDescription: "This {label} map quiz tests your ability to identify {adjective} {borderset} by clicking them on a map without the aid of borders.",
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
        descriptionTemplate: "Click the correct region.",
        shortDescription: "Click the highlighted region to select it.",
        longDescription: "This {label} map quiz tests your ability to identify {adjective} {borderset} by finding the {unitName} that contains a hidden point.",
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