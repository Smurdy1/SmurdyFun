window.SmurdyQuizManifest = [
    {
        id: "click-country",
        title: "Click the Countries",
        file: "manifest:click-country",
        type: "click",
        difficulty: "Easy",
        tags: ["Regions", "Map", "Click"],
        groupSet: "country_groups",
        borders: 1,
        descriptionTemplate: "Click the correct country.",
        shortDescription: "Click the correct country on the map.",
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
        title: "Type the Countries",
        file: "manifest:type-country",
        type: "type",
        difficulty: "Medium",
        tags: ["Regions", "Map", "Typing"],
        groupSet: "country_groups",
        borders: 1,
        descriptionTemplate: "Type the highlighted country.",
        shortDescription: "Type the name of the highlighted country.",
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
        title: "Find the Countries",
        file: "manifest:find-country",
        type: "find",
        difficulty: "Hard",
        tags: ["Regions", "Map", "Click", "Find", "No Borders"],
        groupSet: "country_groups",
        borders: 0,
        descriptionTemplate: "Find the country without borders.",
        shortDescription: "Find the correct country when borders are hidden.",
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
        title: "Find the Country from a Point",
        file: "manifest:find-point",
        type: "find-point",
        difficulty: "Medium",
        tags: ["Regions", "Map", "Typing", "Point", "Find"],
        groupSet: "country_groups",
        borders: 0,
        descriptionTemplate: "Type the country that contains the point.",
        shortDescription: "Type the country containing the point.",
        longDescription: "This {label} map quiz tests your ability to identify {adjective} {borderset} by finding the {unitName} that contains a hidden point.",
        config: {
            mode: "type",
            titleBuilder: () => "Type the region",
            inputPlaceholder: "Type region name...",
            persistCompletedHighlights: false,
            showTargetOnWrong: false,
            clickableLayerId: null,
            findPoint: true
        }
    }
,

    // smurdy-subdivision-system-v1
    {
        id: "click-subdivision",
        title: "Click the Subdivisions",
        file: "manifest:click-subdivision",
        type: "click",
        subject: "subdivisions",
        difficulty: "Easy",
        tags: ["Subdivisions", "Map", "Click"],
        groupSet: "subdivision_groups",
        borders: 1,
        descriptionTemplate: "Click the correct subdivision.",
        shortDescription: "Click the correct state, province, or other subdivision.",
        longDescription: "This {label} subdivision quiz tests your ability to identify {adjective} {unitPlural} by clicking them on the map.",
        config: {
            mode: "click",
            titleBuilder: (name) => `Click: ${name}`,
            persistCompletedHighlights: true,
            showTargetOnWrong: true,
            clickableLayerId: null
        }
    },
    {
        id: "type-subdivision",
        title: "Type the Subdivisions",
        file: "manifest:type-subdivision",
        type: "type",
        subject: "subdivisions",
        difficulty: "Medium",
        tags: ["Subdivisions", "Map", "Typing"],
        groupSet: "subdivision_groups",
        borders: 1,
        descriptionTemplate: "Type the highlighted subdivision.",
        shortDescription: "Type the name of the highlighted subdivision.",
        longDescription: "This {label} subdivision quiz tests your ability to identify {adjective} {unitPlural} by typing their names.",
        config: {
            mode: "type",
            titleBuilder: () => "Type the highlighted subdivision",
            inputPlaceholder: "Type subdivision name...",
            persistCompletedHighlights: true,
            showTargetOnWrong: false,
            clickableLayerId: null
        }
    },
    {
        id: "find-subdivision",
        title: "Find the Subdivisions",
        file: "manifest:find-subdivision",
        type: "find",
        subject: "subdivisions",
        difficulty: "Hard",
        tags: ["Subdivisions", "Map", "Click", "Find", "No Borders"],
        groupSet: "subdivision_groups",
        borders: 0,
        descriptionTemplate: "Find the subdivision without borders.",
        shortDescription: "Find the correct subdivision when its borders are hidden.",
        longDescription: "This {label} subdivision quiz tests your ability to locate {adjective} {unitPlural} on a map without subdivision borders.",
        config: {
            mode: "click",
            titleBuilder: (name) => `Click: ${name}`,
            persistCompletedHighlights: false,
            showTargetOnWrong: true,
            clickableLayerId: null
        }
    },
    {
        id: "find-point-subdivision",
        title: "Find the Subdivision from a Point",
        file: "manifest:find-point-subdivision",
        type: "find-point",
        subject: "subdivisions",
        difficulty: "Medium",
        tags: ["Subdivisions", "Map", "Typing", "Point", "Find"],
        groupSet: "subdivision_groups",
        borders: 0,
        descriptionTemplate: "Type the subdivision that contains the point.",
        shortDescription: "Identify the state, province, or subdivision containing the point.",
        longDescription: "This {label} subdivision quiz tests your ability to identify the {unitName} containing a point.",
        config: {
            mode: "type",
            titleBuilder: () => "Type the subdivision",
            inputPlaceholder: "Type subdivision name...",
            persistCompletedHighlights: false,
            showTargetOnWrong: false,
            clickableLayerId: null,
            findPoint: true
        }
    },
];