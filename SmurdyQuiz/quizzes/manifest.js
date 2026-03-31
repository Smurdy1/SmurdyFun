window.SmurdyQuizManifest = [
    {
        id: "click-country",
        file: "./quizzes/click-country.js",
        mode: "countries",
        type: "click",
        difficulty: "Easy",
        tags: ["Countries", "Map"],
        groupSet: "country_groups",
        borders: 1,
        descriptionTemplate: "Click the correct country in {group}."
    },
    {
        id: "type-country",
        file: "./quizzes/type-country.js",
        mode: "countries",
        type: "type",
        difficulty: "Medium",
        tags: ["Countries", "Map", "Typing"],
        groupSet: "country_groups",
        borders: 1,
        descriptionTemplate: "Type the highlighted country in {group}."
    },
    {
        id: "find-country",
        file: "./quizzes/find-country.js",
        mode: "countries",
        type: "find",
        difficulty: "Hard",
        tags: ["Countries", "Map", "Memory", "No Borders"],
        groupSet: "country_groups",
        borders: 0,
        descriptionTemplate: "Find the country in {group} without borders."
    },
    {
        id: "click-state",
        title: "US States Click Quiz",
        file: "./quizzes/click-state.js",
        mode: "states",
        type: "click",
        difficulty: "Easy",
        tags: ["States", "Map"],
        description: "Click the correct US state."
    },
    {
        id: "type-state",
        title: "US States Type Quiz",
        file: "./quizzes/type-state.js",
        mode: "states",
        type: "type",
        difficulty: "Medium",
        tags: ["States", "Map", "Typing"],
        description: "Type the highlighted US state."
    },
    {
        id: "find-state",
        title: "US States Find Quiz",
        file: "./quizzes/find-state.js",
        mode: "states",
        type: "find",
        difficulty: "Hard",
        tags: ["States", "Map", "Memory", "No Borders"],
        description: "Find the US state without borders."
    }
];