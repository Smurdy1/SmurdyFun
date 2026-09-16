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
        sectionBody: "A continent quiz lets you keep one mental map loaded. World keeps making you throw that map away and load another one, which is why familiar countries can suddenly take a second longer.",
        challengeHeading: "Where World usually bites back",
        studyTipHeading: "Build it continent by continent"
    },
    africa: {
        overviewHeading: "A huge map with a dense middle",
        exampleSentence: "Ghana and Kenya are easy to find. The countries between the better-known shapes are where this set usually slows down.",
        challengeHeading: "The middle is harder than the outline",
        studyTipHeading: "Learn a few big shapes first"
    },
    americas: {
        overviewHeading: "Two continents in one run",
        exampleSentence: "A question can move from Canada to Panama to Uruguay without leaving the set.",
        challengeHeading: "The scale changes fast",
        studyTipHeading: "Use the isthmus as a hinge"
    },
    asia: {
        overviewHeading: "Long distances, sharp regional shifts",
        exampleSentence: "Japan, Uzbekistan, Sri Lanka, and Saudi Arabia all belong to the same quiz, but almost none of the same visual shortcuts carry between them.",
        challengeHeading: "Central and western Asia slow things down",
        studyTipHeading: "Split Asia into smaller mental maps"
    },
    balkans: {
        overviewHeading: "Small borders, similar neighbors",
        exampleSentence: "Slovenia, Croatia, Bosnia and Herzegovina, Serbia, Montenegro, and North Macedonia sit close enough that a rough sense of direction is not enough.",
        sectionHeading: "Neighbor order matters here",
        sectionBody: "The Balkans make neighbor order matter. Recognizing the country names by themselves will not place them on this map.",
        challengeHeading: "A few kilometers on screen can matter",
        studyTipHeading: "Learn the neighbor chain"
    },
    caribbean_islands: {
        overviewHeading: "Tiny targets across a wide sea",
        exampleSentence: "Jamaica and Cuba are forgiving; Dominica, Saint Lucia, and the smaller eastern islands are much less so.",
        sectionHeading: "Island order matters",
        sectionBody: "For the Lesser Antilles, memorizing a north-to-south sequence is often more useful than trying to recognize every island shape at world-map scale.",
        challengeHeading: "The eastern chain is the real test",
        studyTipHeading: "Memorize the island chain in order"
    },
    central_america_and_caribbean: {
        overviewHeading: "The isthmus meets the islands",
        exampleSentence: "Guatemala and Panama reward land-border memory, while Cuba, Hispaniola, and the Lesser Antilles ask for a completely different kind of map sense.",
        challengeHeading: "Two map problems share one set",
        studyTipHeading: "Separate mainland and island practice"
    },
    central_and_southern_africa: {
        overviewHeading: "Big interiors and a crowded south",
        exampleSentence: "The Democratic Republic of the Congo, Zambia, Botswana, Lesotho, and Eswatini create very different scale problems in the same part of the map.",
        challengeHeading: "Southern Africa gets compact quickly",
        studyTipHeading: "Work outward from South Africa"
    },
    east_africa: {
        overviewHeading: "The Horn, the lakes, and the coast",
        exampleSentence: "Ethiopia, Kenya, Uganda, Tanzania, and Somalia give you several strong shapes, then the smaller neighbors test the gaps between them.",
        challengeHeading: "The gaps are the hard part",
        studyTipHeading: "Know the Horn and the Great Lakes"
    },
    eastern_europe: {
        overviewHeading: "A compact region with few easy coastlines",
        exampleSentence: "Belarus, Ukraine, Moldova, Romania, and Bulgaria are easier when you remember who touches whom than when you search for one distinctive outline.",
        challengeHeading: "Neighbor order does most of the work",
        studyTipHeading: "Trace the region from north to south"
    },
    eurasia: {
        overviewHeading: "From the Atlantic edge to the Pacific",
        exampleSentence: "This set can put Portugal and Japan in the same run, with dozens of countries and several very different map scales between them.",
        challengeHeading: "The map never settles down",
        studyTipHeading: "Treat Eurasia as connected regions"
    },
    europe: {
        overviewHeading: "Lots of countries in very little space",
        exampleSentence: "Portugal is hard to confuse, but Belgium, Luxembourg, Slovakia, Slovenia, and the microstates make the center of the map much less forgiving.",
        sectionHeading: "Where the map gets crowded",
        sectionBody: "Western and central Europe contain several small countries whose screen area can be tiny compared with their neighbors. Zooming helps, but knowing the neighbor pattern helps more.",
        challengeHeading: "Central Europe is the bottleneck",
        studyTipHeading: "Learn the small-country clusters"
    },
    european_union: {
        overviewHeading: "Membership makes the map weird",
        exampleSentence: "Portugal, Finland, Cyprus, and Ireland belong together here because of membership, not because they form one neat region on the map.",
        challengeHeading: "The set has holes and outliers",
        studyTipHeading: "Learn membership and location together"
    },
    former_soviet_union: {
        overviewHeading: "The Baltics to Central Asia",
        exampleSentence: "Estonia, Belarus, Georgia, Kazakhstan, and Tajikistan make this set stretch across several very different geographic bands.",
        sectionHeading: "Four smaller maps work better here",
        sectionBody: "The Baltics, the Caucasus and Central Asia each feel like their own little map. Learn them that way.",
        challengeHeading: "Central Asia is easy to rotate mentally",
        studyTipHeading: "Learn the four clusters separately"
    },
    latin_america: {
        overviewHeading: "Several map patterns under one label",
        exampleSentence: "Mexico, Cuba, Brazil, and Chile all belong here, so the quiz moves between mainland chains, islands, and an entire continent.",
        challengeHeading: "Regional context keeps changing",
        studyTipHeading: "Break it into three chunks"
    },
    mena: {
        overviewHeading: "A band from Morocco to Iran",
        exampleSentence: "Morocco, Egypt, Saudi Arabia, and Iran are strong reference points; the smaller states around the eastern Mediterranean and Gulf make the transitions harder.",
        sectionHeading: "Two different map problems",
        sectionBody: "North Africa is mostly a west-to-east sequence, while the Middle East depends much more on compact border relationships. The two halves really do need different map memory.",
        challengeHeading: "The eastern half gets crowded",
        studyTipHeading: "Learn North Africa and the Middle East separately"
    },
    middle_east: {
        overviewHeading: "Small Gulf states beside very large neighbors",
        exampleSentence: "Turkey, Iran and Saudi Arabia are hard to miss. The Gulf states and the Levant need much finer placement.",
        challengeHeading: "Scale is the main trap",
        studyTipHeading: "Place the small states around their neighbors"
    },
    north_america: {
        overviewHeading: "From Canada to the Caribbean",
        exampleSentence: "Canada and Mexico dominate the land area, but Central America and the island countries create most of the close calls.",
        challengeHeading: "The map gets harder as it narrows",
        studyTipHeading: "Work south from Mexico"
    },
    northern_and_western_europe: {
        overviewHeading: "Coasts, islands, and a dense lowland core",
        exampleSentence: "The United Kingdom and Scandinavia provide strong outlines, while Benelux and nearby small countries demand much tighter map memory.",
        challengeHeading: "Big coastlines hide a crowded center",
        studyTipHeading: "Use the North Sea as a reference"
    },
    oceania: {
        overviewHeading: "A few huge shapes and many tiny ones",
        exampleSentence: "Australia and New Zealand are obvious. The Pacific island states are a completely different kind of question.",
        challengeHeading: "Ocean distance distorts your intuition",
        studyTipHeading: "Learn the island groups first"
    },
    pacific_islands: {
        overviewHeading: "A quiz spread across half an ocean",
        exampleSentence: "Fiji, Kiribati, the Marshall Islands, Samoa, and Palau are separated by distances that would span continents elsewhere.",
        sectionHeading: "Distance is misleading",
        sectionBody: "On a world map the islands can look like a loose spray of dots. Grouping them into Micronesia, Melanesia, and Polynesia gives the empty ocean some structure.",
        challengeHeading: "The map gives you very few landmarks",
        studyTipHeading: "Learn the Pacific in island groups"
    },
    small_island_countries: {
        overviewHeading: "The countries most likely to disappear at world zoom",
        exampleSentence: "The Bahamas, Mauritius, Malta, and the Maldives are memorable names, but their map targets are tiny and scattered far apart.",
        challengeHeading: "Tiny islands punish rough guesses",
        studyTipHeading: "Give each island a nearby reference point"
    },
    south_america: {
        overviewHeading: "A clean outline with a tricky northern edge",
        exampleSentence: "Chile and Argentina are easy to orient, while Colombia, Venezuela, Guyana, Suriname, and the smaller interior borders make the north more demanding.",
        challengeHeading: "The north has most of the confusion",
        studyTipHeading: "Use the Andes and the two coasts"
    },
    south_and_central_asia: {
        overviewHeading: "Mountains and landlocked neighbors",
        exampleSentence: "Kazakhstan and India are huge on the map. Kyrgyzstan, Tajikistan, Nepal and Bhutan are where the spacing gets tight.",
        challengeHeading: "The mountain belt packs countries together",
        studyTipHeading: "Build a west-to-east sequence"
    },
    southeast_asia: {
        overviewHeading: "Mainland chains and island arcs",
        exampleSentence: "Thailand and Vietnam belong to one visual pattern; Indonesia and the Philippines belong to another, and the quiz switches between them constantly.",
        challengeHeading: "Mainland and maritime geography mix",
        studyTipHeading: "Learn the mainland before the archipelagos"
    },
    southern_europe: {
        overviewHeading: "Peninsulas, islands, and microstates",
        exampleSentence: "Spain, Italy and Greece are easy to orient around. Malta, the microstates and the Balkans need much closer map memory.",
        challengeHeading: "The tiny states break the easy pattern",
        studyTipHeading: "Use the three big peninsulas first"
    },
    spanish_speaking: {
        overviewHeading: "A language set that crosses an ocean",
        exampleSentence: "Spain, Mexico, Argentina, the Caribbean, and Equatorial Guinea make this one of the least geographically compact sets on Smurdy.",
        challengeHeading: "The set is scattered across the world",
        studyTipHeading: "Learn the geographic clusters separately"
    },
    sub_saharan_africa: {
        overviewHeading: "A very large set with few obvious shortcuts",
        exampleSentence: "Senegal, Ethiopia and South Africa are easy landmarks. There is still a lot of inland Africa between the obvious shapes.",
        challengeHeading: "The interior has fewer distinctive outlines",
        studyTipHeading: "Learn the region in smaller pieces"
    },
    tiny_countries: {
        overviewHeading: "The map's smallest targets",
        exampleSentence: "Monaco, Liechtenstein, San Marino, Vatican City, Nauru, and Tuvalu turn ordinary map knowledge into a precision exercise.",
        sectionHeading: "You will need to zoom",
        sectionBody: "This set is intentionally awkward at normal world-map scale. Knowing the correct neighborhood first matters more than trying to spot a microscopic shape from far away.",
        challengeHeading: "Precision matters more than recognition",
        studyTipHeading: "Memorize the neighborhood before the outline"
    },
    west_africa: {
        overviewHeading: "A compact coast with a wide Sahel",
        exampleSentence: "Senegal, Ghana, Niger, and Nigeria make useful reference points, while the smaller coastal states reward learning the exact west-to-east order.",
        challengeHeading: "The coastal sequence gets crowded",
        studyTipHeading: "Learn the coast in order"
    },
    us_states: {
        overviewHeading: "Fifty familiar names, one internal map",
        exampleSentence: "California and Texas are instant. Delaware, Rhode Island and the middle of the country take more work.",
        sectionHeading: "The rectangle trap",
        sectionBody: "Several western and central states look simple enough that it is tempting to remember them as interchangeable boxes. Their neighbors and relative position are usually the better clue.",
        challengeHeading: "The middle is harder than the coasts",
        studyTipHeading: "Learn states in regional blocks"
    }
};

module.exports = { LANDING_PERSONALITY };
