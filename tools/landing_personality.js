"use strict";

/*
 * Short, deliberately specific editorial notes for quiz landing pages.
 * These are shared by map/capital and flag page generators. The goal is
 * variation that comes from the geography itself, not extra UI chrome.
 */
const LANDING_PERSONALITY = {
    world: {
        overviewHeading: "One map, no warm-up",
        exampleSentence: "One round can jump from Argentina to Kyrgyzstan to Fiji with no warning.",
        sectionHeading: "Why World feels different",
        sectionBody: "A continent quiz lets you keep one mental map loaded. World keeps replacing it. A country that feels obvious in a Europe-only round can take an extra second when the previous question was in the Pacific.",
        challengeHeading: "Where World usually bites back",
        studyTipHeading: "Get comfortable with the continents first"
    },
    africa: {
        overviewHeading: "A huge map with a dense middle",
        exampleSentence: "Ghana is easy to pick out on the coast. Move inland and the shapes stop being so generous.",
        challengeHeading: "The middle is harder than the outline",
        studyTipHeading: "Give the interior its own practice"
    },
    americas: {
        overviewHeading: "Two continents in one run",
        exampleSentence: "You might get Canada, then Panama, then Uruguay. The useful map in your head keeps changing.",
        challengeHeading: "The scale changes fast",
        studyTipHeading: "Central America is the bridge"
    },
    asia: {
        overviewHeading: "Long distances, sharp regional shifts",
        exampleSentence: "Japan and Uzbekistan barely feel like questions from the same map. Add Sri Lanka and the scale changes again.",
        challengeHeading: "Central and western Asia slow things down",
        studyTipHeading: "Asia is easier as several smaller maps"
    },
    balkans: {
        overviewHeading: "Small borders, similar neighbors",
        exampleSentence: "Croatia is recognizable. Keeping Serbia, Bosnia and Herzegovina, Montenegro and North Macedonia in the right order is the harder part.",
        sectionHeading: "Neighbor order matters here",
        sectionBody: "The Balkans make neighbor order matter. Recognizing the country names by themselves will not place them on this map.",
        challengeHeading: "A few kilometers on screen can matter",
        studyTipHeading: "Learn the neighbor chain"
    },
    caribbean_islands: {
        overviewHeading: "Tiny targets across a wide sea",
        exampleSentence: "Cuba gives you plenty to click. Dominica and Saint Lucia do not.",
        sectionHeading: "Island order matters",
        sectionBody: "The Lesser Antilles get much easier once the north-to-south order feels familiar. At world zoom, the individual island shapes are barely useful.",
        challengeHeading: "The eastern chain is the real test",
        studyTipHeading: "Know the island chain in order"
    },
    central_america_and_caribbean: {
        overviewHeading: "The isthmus meets the islands",
        exampleSentence: "Guatemala is a border question. Cuba is an island question. This set makes you switch between the two kinds constantly.",
        challengeHeading: "Two map problems share one set",
        studyTipHeading: "Practice the mainland and islands separately"
    },
    central_and_southern_africa: {
        overviewHeading: "Big interiors and a crowded south",
        exampleSentence: "The Democratic Republic of the Congo takes up huge space. Lesotho and Eswatini can nearly vanish beside South Africa.",
        challengeHeading: "Southern Africa gets compact quickly",
        studyTipHeading: "South Africa is a useful place to start"
    },
    east_africa: {
        overviewHeading: "The Horn, the lakes and the coast",
        exampleSentence: "Somalia gives the Horn a shape you can recognize immediately. The countries around the Great Lakes take more careful neighbor memory.",
        challengeHeading: "The gaps are the hard part",
        studyTipHeading: "Know the Horn and the Great Lakes"
    },
    eastern_europe: {
        overviewHeading: "A compact region with few easy coastlines",
        exampleSentence: "Ukraine is hard to lose. Moldova is much easier once you know exactly what sits around it.",
        challengeHeading: "Neighbor order does most of the work",
        studyTipHeading: "Trace the region from north to south"
    },
    eurasia: {
        overviewHeading: "From the Atlantic edge to the Pacific",
        exampleSentence: "Portugal and Japan can appear in the same round. There are a lot of different maps hiding between them.",
        challengeHeading: "The map never settles down",
        studyTipHeading: "Treat Eurasia as connected regions"
    },
    europe: {
        overviewHeading: "Lots of countries in very little space",
        exampleSentence: "Portugal is hard to confuse. Luxembourg and Slovenia are a different story, and the microstates can disappear at normal zoom.",
        sectionHeading: "Where the map gets crowded",
        sectionBody: "Western and central Europe pack several small countries into very little screen space. Zooming helps. Knowing which neighbors belong around them helps more.",
        challengeHeading: "Central Europe is the bottleneck",
        studyTipHeading: "Give the small-country clusters extra time"
    },
    european_union: {
        overviewHeading: "Membership makes the map weird",
        exampleSentence: "Ireland and Cyprus belong in the same set here. Geography alone would never group them that way.",
        challengeHeading: "The set has holes and outliers",
        studyTipHeading: "Learn the membership while you learn the map"
    },
    former_soviet_union: {
        overviewHeading: "The Baltics to Central Asia",
        exampleSentence: "Estonia feels like a Baltic question. Kazakhstan feels like Central Asia. Both are in the same historical set.",
        sectionHeading: "Four smaller maps work better here",
        sectionBody: "The Baltics, the Caucasus and Central Asia each feel like their own little map. Learn them that way.",
        challengeHeading: "Central Asia is easy to rotate mentally",
        studyTipHeading: "Learn the clusters separately"
    },
    latin_america: {
        overviewHeading: "Several map patterns under one label",
        exampleSentence: "Mexico leads into one long mainland chain. Cuba is an island problem. South America takes up most of the map below them.",
        challengeHeading: "Regional context keeps changing",
        studyTipHeading: "Split the set by geography"
    },
    mena: {
        overviewHeading: "A band from Morocco to Iran",
        exampleSentence: "North Africa is a long strip. Around the Gulf and eastern Mediterranean, the borders bunch together quickly.",
        sectionHeading: "The map changes near Egypt",
        sectionBody: "North Africa mostly reads west to east. The Middle East asks for much tighter border memory, especially around the Gulf and Levant.",
        challengeHeading: "The eastern half gets crowded",
        studyTipHeading: "Practice the two halves on their own"
    },
    middle_east: {
        overviewHeading: "Small Gulf states beside very large neighbors",
        exampleSentence: "Turkey, Iran and Saudi Arabia are hard to miss. Bahrain can be tiny even after you know exactly where to look.",
        challengeHeading: "Scale is the main trap",
        studyTipHeading: "Spend extra time around the Gulf"
    },
    north_america: {
        overviewHeading: "From Canada to the Caribbean",
        exampleSentence: "Canada fills the top of the map. Most close calls happen much farther south, where the land narrows and the islands begin.",
        challengeHeading: "The map gets harder as it narrows",
        studyTipHeading: "Work south from Mexico"
    },
    northern_and_western_europe: {
        overviewHeading: "Coasts, islands and a dense lowland core",
        exampleSentence: "The United Kingdom is hard to lose. Benelux gives you far less room for a rough guess.",
        challengeHeading: "Big coastlines hide a crowded center",
        studyTipHeading: "Keep the North Sea in view"
    },
    oceania: {
        overviewHeading: "A few huge shapes and many tiny ones",
        exampleSentence: "Australia is obvious from almost any zoom. The Pacific island states can be hard to see even when you know their names well.",
        challengeHeading: "Ocean distance distorts your intuition",
        studyTipHeading: "Learn the island groups first"
    },
    pacific_islands: {
        overviewHeading: "A quiz spread across half an ocean",
        exampleSentence: "Fiji feels isolated until you compare it with Kiribati or the Marshall Islands. Pacific distances are enormous.",
        sectionHeading: "Distance is misleading",
        sectionBody: "At world scale the islands look like a loose spray of dots. Micronesia, Melanesia and Polynesia give you three smaller areas to remember.",
        challengeHeading: "The map gives you very few landmarks",
        studyTipHeading: "Learn the Pacific in island groups"
    },
    small_island_countries: {
        overviewHeading: "The countries most likely to disappear at world zoom",
        exampleSentence: "Malta is tiny but sits in a familiar sea. Nauru gives you much less nearby geography to work with.",
        challengeHeading: "Tiny islands punish rough guesses",
        studyTipHeading: "Give the hardest islands some local context"
    },
    south_america: {
        overviewHeading: "A clean outline with a tricky northern edge",
        exampleSentence: "Chile is hard to lose. Guyana and Suriname are where the northern edge starts demanding more attention.",
        challengeHeading: "The north has most of the confusion",
        studyTipHeading: "Use the Andes and the coastlines"
    },
    south_and_central_asia: {
        overviewHeading: "Mountains and landlocked neighbors",
        exampleSentence: "Kazakhstan is enormous. Around Kyrgyzstan and Tajikistan, the available space tightens fast.",
        challengeHeading: "The mountain belt packs countries together",
        studyTipHeading: "Build the region from west to east"
    },
    southeast_asia: {
        overviewHeading: "Mainland chains and island arcs",
        exampleSentence: "Thailand gives you a mainland shape to learn. Indonesia turns the same quiz into an archipelago problem a few questions later.",
        challengeHeading: "Mainland and maritime geography mix",
        studyTipHeading: "Get the mainland comfortable first"
    },
    southern_europe: {
        overviewHeading: "Peninsulas, islands and microstates",
        exampleSentence: "Italy gives you an easy shape. Malta and the microstates ask for much finer map memory.",
        challengeHeading: "The tiny states break the easy pattern",
        studyTipHeading: "The big peninsulas make a good skeleton"
    },
    spanish_speaking: {
        overviewHeading: "A language set that crosses an ocean",
        exampleSentence: "Most of the set is in the Americas, then Spain and Equatorial Guinea pull you across the Atlantic.",
        challengeHeading: "The set is scattered across the world",
        studyTipHeading: "Practice it in geographic chunks"
    },
    sub_saharan_africa: {
        overviewHeading: "A very large set with few obvious shortcuts",
        exampleSentence: "Senegal and South Africa give you distant ends of the set. The inland countries between them are where memory gets tested.",
        challengeHeading: "The interior has fewer distinctive outlines",
        studyTipHeading: "Break the interior into smaller regions"
    },
    tiny_countries: {
        overviewHeading: "The map's smallest targets",
        exampleSentence: "Monaco can disappear beside France. Nauru has the opposite problem: there is hardly anything nearby to orient from.",
        sectionHeading: "You will need to zoom",
        sectionBody: "This set is intentionally awkward at normal world-map scale. Get into the right neighborhood first; the exact target may be microscopic from far away.",
        challengeHeading: "Precision matters more than recognition",
        studyTipHeading: "Know the neighborhood before the outline"
    },
    west_africa: {
        overviewHeading: "A compact coast with a wide Sahel",
        exampleSentence: "Ghana is a useful coastal landmark. Farther west, several small countries sit almost on top of one another at normal zoom.",
        challengeHeading: "The coastal sequence gets crowded",
        studyTipHeading: "Learn the coast in order"
    },
    us_states: {
        overviewHeading: "Fifty familiar names, one internal map",
        exampleSentence: "California and Texas are instant. Delaware is not, and the middle of the country has plenty of similar-looking shapes.",
        sectionHeading: "The rectangle trap",
        sectionBody: "Several western and central states look like plain boxes at first glance. Their neighbors and position on the wider US map are usually better clues than the outline alone.",
        challengeHeading: "The middle is harder than the coasts",
        studyTipHeading: "Use regional chunks that make sense to you"
    }
};

module.exports = { LANDING_PERSONALITY };
