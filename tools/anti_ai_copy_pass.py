from pathlib import Path
import json


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Missing expected text in {path}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


data_path = Path("src/data/quiz_page_descriptions.json")
data = json.loads(data_path.read_text())

mode_updates = {
    "click-country": {
        "howToPlay": "A {unitName} name appears above the map. Click it and keep going until the set is finished. The borders stay on the map, which makes this the easiest map mode to learn from.",
        "tip": "If one answer keeps getting you, remember one neighbor or coastline beside it. That is usually enough to find it next time.",
        "skillsHeading": "What this mode is good at",
        "skills": "This is mostly about matching names to shapes and positions. After a while, the borders start looking familiar before you even read the whole prompt.",
        "strategyHeading": "If you get stuck",
        "strategy": "Look at the part of the map you are in and find one country you already know. The target is usually easier from there.",
        "bestForHeading": "Good place to begin",
        "bestFor": "This is the normal starting point for a new map. It is also useful after you have not played a region for a while.",
        "mistakesHeading": "Easy mistake",
        "mistakes": "A familiar neighbor can look right for half a second. Check the border before clicking."
    },
    "type-country": {
        "howToPlay": "One {unitName} is highlighted. Type its name and move on to the next one. You get the location as a clue, but the name has to come from memory.",
        "tip": "If you recognize the shape but the name is slow, say the name out loud or in your head before typing.",
        "skillsHeading": "What this catches",
        "skills": "You can know exactly where a place is and still blank on its name. This mode catches that gap fast.",
        "strategyHeading": "When the name will not come",
        "strategy": "Work out the region first. Nearby countries will often jog the name better than staring at the outline.",
        "bestForHeading": "When to use it",
        "bestFor": "Use this once the map looks familiar and you want to make sure the names are actually there too.",
        "mistakesHeading": "Easy mistake",
        "mistakes": "A similar shape can send you to the wrong name. Check where the highlight sits on the map."
    },
    "find-country": {
        "howToPlay": "A {unitName} name appears on a map with the political borders hidden. Click where it belongs. The coastline stays, so you still have some geography to work with.",
        "tip": "Pick out a coastline, peninsula or big country you know and judge the target from there.",
        "skillsHeading": "What gets harder here",
        "skills": "Once the border lines disappear, you are relying on the layout in your head. Distance and neighbor order matter a lot more.",
        "strategyHeading": "When the map looks blank",
        "strategy": "Ignore the whole map for a second. Find the right coast or subregion first and make the click from there.",
        "bestForHeading": "When to use it",
        "bestFor": "This is a good next step after the bordered map starts feeling automatic.",
        "mistakesHeading": "Easy mistake",
        "mistakes": "The empty interior makes people guess too early. There are still coastlines, corners and big shapes to use."
    },
    "find-point": {
        "howToPlay": "A point appears somewhere on the map. Type the {unitName} that actually contains it. The round keeps going through {countPhrase}.",
        "tip": "Points near borders are the nasty ones. Check which side of the border the dot is really on.",
        "skillsHeading": "What this catches",
        "skills": "This is good at exposing fuzzy boundaries. Knowing the general area is not much help when the point lands near an edge.",
        "strategyHeading": "Read the point first",
        "strategy": "Notice whether the point is coastal, inland or on an island. That usually cuts the possibilities down quickly.",
        "bestForHeading": "When to use it",
        "bestFor": "Play this when the country outlines are already familiar and you want a stricter location test.",
        "mistakesHeading": "Easy mistake",
        "mistakes": "The nearest famous country is not automatically the answer. The dot has to be inside it."
    },
    "click-subdivision": {
        "howToPlay": "A {unitName} name appears. Click that subdivision on the map and continue through the set.",
        "tip": "One familiar state or province nearby can make the rest of the area much easier.",
        "skillsHeading": "What this mode is good at",
        "skills": "You learn how the smaller pieces fit inside {groupTopic}, especially which ones touch and which shapes repeat.",
        "strategyHeading": "If you get stuck",
        "strategy": "Find the part of {groupTopic} you are in. From there, use any subdivision you already know to narrow it down.",
        "bestForHeading": "Good place to begin",
        "bestFor": "Start here for a new subdivision map before moving to the harder versions.",
        "mistakesHeading": "Easy mistake",
        "mistakes": "Two nearby subdivisions can look almost interchangeable. Compare the whole shape before clicking."
    },
    "type-subdivision": {
        "howToPlay": "One {unitName} is highlighted. Type its name and continue through {countPhrase}.",
        "tip": "Think about where the highlight sits inside the parent country. That often brings the name back.",
        "skillsHeading": "What this catches",
        "skills": "Recognizing the right area is only half of it here. You also have to pull up the full subdivision name.",
        "strategyHeading": "When the name is slow",
        "strategy": "Find the region inside {groupTopic} and think through the nearby subdivisions. The name usually comes faster with that context.",
        "bestForHeading": "When to use it",
        "bestFor": "Try this after the click version feels familiar but some names still take a second.",
        "mistakesHeading": "Easy mistake",
        "mistakes": "A partial name can feel convincing too early. Check the location before submitting it."
    },
    "find-subdivision": {
        "howToPlay": "The quiz names a {unitName} while the internal subdivision lines are hidden. Click where it belongs inside the parent country.",
        "tip": "The outside shape of the country matters a lot here. Coasts and corners give you more than they seem to.",
        "skillsHeading": "What gets harder here",
        "skills": "You have to remember the internal layout from memory once the subdivision lines are gone.",
        "strategyHeading": "When the inside looks empty",
        "strategy": "Start with the edge of {groupTopic}. A coast, corner or big neighboring subdivision can give you a useful starting point.",
        "bestForHeading": "When to use it",
        "bestFor": "Move here when the bordered subdivision map has become pretty comfortable.",
        "mistakesHeading": "Easy mistake",
        "mistakes": "Do not treat the blank interior like empty space. The outer border still tells you a lot."
    },
    "find-point-subdivision": {
        "howToPlay": "A point appears inside one subdivision. Type the {unitName} that contains it.",
        "tip": "Near a boundary, slow down and check which side the point is on.",
        "skillsHeading": "What this catches",
        "skills": "This tests the parts of a subdivision far away from its best-known city or shape.",
        "strategyHeading": "Read the point first",
        "strategy": "Estimate where the point sits inside {groupTopic}. Its distance from the outer edge can be more useful than the nearest city.",
        "bestForHeading": "When to use it",
        "bestFor": "Use this once you already know the main subdivision outlines and want a stricter boundary test.",
        "mistakesHeading": "Easy mistake",
        "mistakes": "A famous city nearby can pull you toward the wrong subdivision. The point itself decides the answer."
    },
    "type-capital": {
        "howToPlay": "A {unitName} is highlighted and named. Type its capital. Smurdy marks the capital on the map for a moment before the next question.",
        "tip": "Try to get the city from memory before you look for the answer dot.",
        "skillsHeading": "What this mode is good at",
        "skills": "The country and its capital stay tied to the same map, so you learn the city with some geographic context instead of as a loose flashcard fact.",
        "strategyHeading": "If a capital keeps slipping",
        "strategy": "Picture the country first and say the capital before typing. The answer dot gives you a quick location check afterward.",
        "bestForHeading": "When to use it",
        "bestFor": "Use this once the countries or states themselves are familiar and you want to add the capitals.",
        "mistakesHeading": "Easy mistake",
        "mistakes": "The biggest city is not always the capital. A few countries are especially good at punishing that guess."
    }
}
for mode, changes in mode_updates.items():
    data["modes"][mode].update(changes)

group_updates = {
    "world": {
        "overview": "World mixes every region into one round. A huge mainland country can be followed by a tiny island on the next question, so there is no single part of the map to settle into.",
        "challenge": "The hard part is the constant jump in scale. Europe can get crowded, and the Caribbean or Pacific can force a lot of zooming.",
        "studyTip": "Get comfortable with the continents on their own first. The World quiz is where you find out whether you can switch between them quickly."
    },
    "us_states": {
        "overview": "This set is the 50 US states. The western half gives you some big, obvious shapes; the Northeast and parts of the Midwest are much tighter.",
        "challenge": "The center and Northeast usually cause more misses because a lot of states are similar in size or packed together.",
        "studyTip": "Learn the states in chunks that make sense to you. The Great Lakes and Northeast are worth extra time if the middle keeps blending together."
    },
    "europe": {
        "overview": "Europe puts a lot of countries into a small map. The big peninsulas are easy to orient around, but the middle of the continent gets crowded fast.",
        "challenge": "Central Europe and the Balkans are where a rough guess stops working. Several small countries sit only a short distance apart.",
        "studyTip": "Know the big peninsulas and coastlines cold. Once those are automatic, the small-country clusters have somewhere to fit."
    },
    "asia": {
        "overview": "Asia is enormous, and the quiz can move from the Middle East to Central Asia or the Pacific coast in a few questions. Some regions have giant countries; others are packed tightly.",
        "challenge": "Central Asia and mainland Southeast Asia are common trouble spots. The shapes are less forgiving when several neighbors sit close together.",
        "studyTip": "Asia gets much easier when the subregions stop feeling like one giant map. Practice the parts that keep slowing you down on their own."
    },
    "africa": {
        "overview": "Africa has more than fifty answers in this set. The coast gives you a good outline, while the interior has long runs of neighboring countries that are harder to separate.",
        "challenge": "West Africa gets crowded along the coast. Central and eastern Africa can be tough for the opposite reason: several large inland countries sit next to each other.",
        "studyTip": "If the interior feels random, learn the coast first. It gives the landlocked countries something concrete to sit behind."
    },
    "south_america": {
        "overview": "South America has only a dozen sovereign countries, so the whole set is manageable. Most of the trouble is near the north and around the two landlocked countries.",
        "challenge": "Guyana and Suriname are easy to swap. Bolivia and Paraguay also take longer if you only remember the coastline.",
        "studyTip": "Brazil is hard to miss and touches most of the continent. Use it as the country you check everything else against."
    },
    "north_america": {
        "overview": "This North America set includes the mainland, Central America and the sovereign Caribbean countries in Smurdy. Canada, the United States and Mexico take up most of the land area; the small-country work is farther south.",
        "challenge": "Central America is narrow, and the Caribbean puts a lot of small answers close together.",
        "studyTip": "The mainland is straightforward enough to learn first. Give the Caribbean its own practice until the islands stop blurring together."
    },
    "middle_east": {
        "overview": "This group covers the eastern Mediterranean, the Arabian Peninsula, Iran, Iraq and nearby western Asia. It is a much smaller set than all of Asia.",
        "challenge": "The Gulf and the Levant have several small neighbors. A tiny shift on the map can put you in the wrong country.",
        "studyTip": "Get the Arabian Peninsula fixed in your head. The smaller countries around it make more sense once that shape is familiar."
    },
    "european_union": {
        "overview": "This set is based on EU membership. Geography still matters, but the quiz also expects you to know which nearby European countries are outside the union.",
        "challenge": "A country can be surrounded by EU members and still not belong to the EU. That is where location knowledge alone stops helping.",
        "studyTip": "The shortest route is often learning the nearby non-members. Once those stand out, the membership map is easier to remember."
    },
    "southeast_asia": {
        "overview": "Southeast Asia has two very different-looking halves: the mainland around Thailand and Vietnam, and the island countries farther south and east.",
        "challenge": "The mainland is tightly packed. Indonesia, Malaysia and the Philippines create a separate island problem.",
        "studyTip": "Treat mainland and maritime Southeast Asia as two small maps until both feel easy."
    },
    "latin_america": {
        "overview": "Latin America stretches from Mexico through Central America and the Caribbean into South America. It is a language-and-history grouping spread across a huge area.",
        "challenge": "The quiz keeps changing map scale. An island question can be followed by a country covering a large part of South America.",
        "studyTip": "South America and Central America are easier to learn on their own. Add the Caribbean after those two are solid."
    },
    "spanish_speaking": {
        "overview": "This set has the 20 sovereign countries where Spanish is an official or dominant national language. Most are in the Americas, with Spain and Equatorial Guinea far away from the rest.",
        "challenge": "The countries are spread across three continents. Nearby non-Spanish-speaking countries also make the set less obvious than a normal regional quiz.",
        "studyTip": "The American countries are the bulk of the set. Learn those by region, then remember the two outliers: Spain and Equatorial Guinea."
    },
    "oceania": {
        "overview": "Oceania gives you Australia, New Zealand, Papua New Guinea and the independent Pacific island countries. On the world map, many of the island answers are tiny and very far apart.",
        "challenge": "There are not many land borders to help you. A lot of the quiz comes down to remembering where each island group sits in the ocean.",
        "studyTip": "Know the big three first. The smaller islands are easier once you can place them relative to Australia, New Zealand and Papua New Guinea."
    },
    "central_america_and_caribbean": {
        "overview": "This set combines the seven Central American mainland countries with the sovereign Caribbean islands. The two parts of the quiz feel quite different.",
        "challenge": "Central America is a narrow chain. The Caribbean is mostly an island-order problem.",
        "studyTip": "Learn Central America from Mexico down to Colombia. Practice the Caribbean separately until the island order starts to stick."
    },
    "caribbean_islands": {
        "overview": "The Caribbean set focuses on the sovereign island countries in and around the Caribbean Sea. Cuba and Hispaniola are easy to see; many of the smaller islands are not.",
        "challenge": "Several answers are tiny at normal zoom, and some nearby islands are territories rather than sovereign-country answers.",
        "studyTip": "Start with the big islands you already recognize. The smaller eastern Caribbean countries are easier once you know where that chain begins and ends."
    },
    "balkans": {
        "overview": "The Balkans pack a lot of countries into southeastern Europe. The shapes are small enough that knowing the rough region is rarely enough.",
        "challenge": "The middle of the peninsula is full of short borders and similarly sized neighbors. Regional definitions also vary, so Smurdy uses one fixed country list.",
        "studyTip": "Learn who borders whom. For this region, neighbor order is more useful than memorizing each outline by itself."
    },
    "eastern_europe": {
        "overview": "Eastern Europe is a smaller slice of the Europe map using Smurdy's fixed group list. The exact definition changes from source to source, but the quiz list does not.",
        "challenge": "A lot of the countries are inland or share long borders. They are easier to confuse when you rely on outline shape alone.",
        "studyTip": "Poland, Ukraine and the Black Sea give you enough structure to place most of the rest."
    },
    "mena": {
        "overview": "MENA runs from Morocco across North Africa to the Middle East and Iran. It crosses two continents, which is part of why the full set feels bigger than the name suggests.",
        "challenge": "North Africa is spread out; the eastern Mediterranean and Gulf are much tighter.",
        "studyTip": "North Africa is basically a west-to-east chain. Learn that part first and the Middle East will feel like a separate, smaller problem."
    },
    "west_africa": {
        "overview": "West Africa has a crowded Atlantic coast and a broad inland Sahel. Nigeria and Ghana are familiar to many players, but several smaller coastal countries sit right beside them.",
        "challenge": "The coastline is where most close misses happen. Inland, the large shapes can also blend together.",
        "studyTip": "The coast has a useful order. Once that order is familiar, Mali, Burkina Faso and Niger are much easier to place behind it."
    },
    "southern_europe": {
        "overview": "Southern Europe is built around the Mediterranean-facing part of the continent: Iberia, Italy, Greece, nearby islands and the smaller states in the region.",
        "challenge": "The famous peninsulas are easy. The microstates and compact Balkan borders are where the precision starts.",
        "studyTip": "If Spain, Italy and Greece are automatic, the small countries around them are much easier to organize."
    },
    "east_africa": {
        "overview": "East Africa in Smurdy includes the Horn, the Great Lakes area, the Indian Ocean coast and nearby islands. The coast has several memorable shapes, while the inland countries are more compact.",
        "challenge": "The Great Lakes area gets crowded quickly. Regional definitions also differ near central and southern Africa, so this quiz follows Smurdy's stored list.",
        "studyTip": "The Horn and the Indian Ocean coast are the easiest places to recognize. Learn those well and work inland from them."
    },
    "south_and_central_asia": {
        "overview": "This group joins the Indian subcontinent with the landlocked countries north of it. India and Kazakhstan take up a lot of the map, with much smaller neighbors around them.",
        "challenge": "Central Asian names are easy to mix up, and South Asia squeezes several countries into narrow spaces around India.",
        "studyTip": "Think of this as two neighborhoods. India is the obvious center of one; Kazakhstan is the big one in the other."
    },
    "northern_and_western_europe": {
        "overview": "This group covers the British Isles, Scandinavia, the Nordic area and much of western continental Europe. Long coastlines give way to a much denser center.",
        "challenge": "Benelux and nearby small countries demand more precision than the big northern shapes.",
        "studyTip": "The North Sea is a useful center for this set. Once the countries around it are fixed, the rest spreads out pretty naturally."
    },
    "central_and_southern_africa": {
        "overview": "This set runs from the Congo Basin down to the southern end of Africa. It includes a mix of very large inland countries and several compact states around South Africa.",
        "challenge": "The two Congos are an obvious source of mistakes. Farther south, the countries get smaller and tighter together.",
        "studyTip": "Learn the Congo Basin and southern Africa as two separate patches before mixing the whole set."
    },
    "sub_saharan_africa": {
        "overview": "This is the large Africa set with North Africa removed. It still spans the west, center, east and south of the continent.",
        "challenge": "There are many landlocked countries and very few shortcuts that work across the whole set.",
        "studyTip": "Practice the regional sets first. This quiz works better as a combination test than as the place to learn every country from scratch."
    },
    "americas": {
        "overview": "The Americas round combines North America, Central America, the Caribbean and South America. The map swings between huge mainland countries and tiny islands.",
        "challenge": "The scale changes constantly. Caribbean questions are especially easy to miss after a run of large countries.",
        "studyTip": "Get North and South America comfortable on their own. Central America and the Caribbean are the bridge that makes the combined set harder."
    },
    "eurasia": {
        "overview": "Eurasia puts Europe and Asia on one continuous map. It is a huge set, from the Atlantic edge to the Pacific, with every kind of country size in between.",
        "challenge": "A tiny European state and one of the world's largest countries can appear back to back. The constant scale change is the real difficulty.",
        "studyTip": "Do not try to learn Eurasia as one list. Europe and the Asian subregions should already feel familiar before you use the combined quiz."
    },
    "former_soviet_union": {
        "overview": "This group contains the countries that became independent after the Soviet Union dissolved. They stretch from the Baltics through the Caucasus and into Central Asia.",
        "challenge": "The five Central Asian countries are a common source of confusion, especially when the names are more familiar than the shapes.",
        "studyTip": "The Baltics, eastern Europe, the Caucasus and Central Asia are four useful chunks. Learn each chunk before mixing them."
    },
    "tiny_countries": {
        "overview": "Tiny Countries collects small sovereign states from several parts of the world. Many of them are barely visible at normal world-map zoom.",
        "challenge": "Screen size is the main problem. Some answers are so small that knowing the neighborhood matters more than recognizing an outline.",
        "studyTip": "Group them by region. European microstates are one batch, and the island countries make more sense by ocean."
    },
    "small_island_countries": {
        "overview": "This set pulls small sovereign island countries from several oceans and regions. Most of them show up as tiny shapes or points on the world map.",
        "challenge": "The answers are scattered far apart, so there is rarely a neat chain of land borders to follow.",
        "studyTip": "Learn them by ocean or subregion. Trying to memorize the whole list in one run makes the set feel much more random than it is."
    },
    "pacific_islands": {
        "overview": "This set is the independent Pacific island countries in Smurdy's group list. Australia and New Zealand are left out so the smaller island states get the attention.",
        "challenge": "The ocean distances are huge, and several countries are tiny on the map.",
        "studyTip": "Papua New Guinea and Fiji are useful reference points. Once those are fixed, the rest is mostly an ocean-position problem."
    }
}
for group, changes in group_updates.items():
    if group in data["groups"]:
        data["groups"][group].update(changes)

page_updates = {
    "find-country/asia": {
        "lead": "All the country borders are gone in this Asia quiz. You still have the coast, islands and peninsulas, so the job is figuring out where each name belongs from the shape of the continent itself.",
        "overview": "The full Asia set reaches from Turkey and Cyprus across Central and South Asia to Japan, Indonesia and Timor-Leste. With no internal lines, familiar subregions matter more than individual country outlines.",
        "howToPlay": "A country name appears over a blank political map. Click roughly where it belongs and keep going through the set. The coastline stays visible.",
        "gameplayTip": "If an inland country feels impossible, find the nearest sea, peninsula or country-sized shape you know first.",
        "challenge": "Central Asia is the part most likely to turn into empty space. Mainland Southeast Asia is different: the countries are narrow and packed along a complicated coast.",
        "studyTipHeading": "Studying the blank Asia map",
        "studyTip": "Give each subregion one physical feature you can picture. The Caspian Sea is useful for Central Asia; India does the same job for South Asia.",
        "sectionHeading": "Learn the outside edge first",
        "sectionBody": "Trace the continent around Arabia, India and Southeast Asia before worrying about the inland countries. Japan, the Philippines, Indonesia and Sri Lanka also give the empty ocean some structure."
    },
    "find-country/europe": {
        "lead": "Europe gets much harder when the borders disappear. The coastlines and peninsulas are still there, but the small countries in the middle no longer have boxes around them.",
        "overview": "All 44 European countries are in the round, including the microstates. Western Europe is fairly forgiving; Central Europe and the Balkans can be off by only a small distance.",
        "howToPlay": "Smurdy names a country on a borderless Europe map. Click where it belongs. The outer coastline and islands stay visible for reference.",
        "gameplayTip": "The big peninsulas are the easiest places to get your bearings when the middle of the map starts looking blank.",
        "challenge": "Benelux, Central Europe and the Balkans leave very little room for a sloppy click once the outlines vanish.",
        "studyTipHeading": "Getting used to blank Europe",
        "studyTip": "Know Iberia, Italy and Scandinavia well. For the crowded parts, neighbor order is more useful than trying to imagine every missing border at once.",
        "sectionHeading": "The tiny-country problem",
        "sectionBody": "Luxembourg, Kosovo, Montenegro and the microstates are unforgiving on a blank map. A rough idea of the region is not enough there.",
        "exampleSentence": "Italy and Iberia are still obvious. Benelux and the western Balkans are where the map starts getting mean."
    },
    "click-country/eurasia": {
        "lead": "This is Europe and Asia in one long bordered-map round. The next question might be in Portugal, the Caucasus or the Pacific side of Asia.",
        "overview": "The set joins the Europe and Asia groups on one continuous landmass. There is no break between the two during play, so the map can jump across thousands of miles from one answer to the next.",
        "howToPlay": "Read the country name and click the bordered shape. Keep going until the full Eurasia set is done.",
        "gameplayTip": "Get the subregion right before you worry about the exact outline. That is usually faster than scanning the entire continent.",
        "challenge": "The scale is all over the place. Tiny European states can appear right beside enormous Asian countries in the same run.",
        "studyTipHeading": "Before playing the full set",
        "studyTip": "Europe and the major Asian subregions should already feel familiar. Eurasia is best used for practicing the jumps between them.",
        "sectionHeading": "Where Europe meets Asia",
        "sectionBody": "The Black Sea, Caucasus and Caspian area is the part worth learning carefully. It stops the middle of the map from feeling like a vague gap between Europe and Central Asia."
    },
    "type-country/eurasia": {
        "lead": "This is the long version of the typing quiz: Europe and Asia on one map, with every highlighted country needing a name.",
        "overview": "The round runs from Western Europe to East Asia. It is less about one difficult region than keeping a lot of country names ready at once.",
        "howToPlay": "A country is highlighted on the bordered Eurasia map. Type the name and move on to the next one.",
        "gameplayTip": "If you know the location but the name is slow, pause before typing. That tells you whether the problem is spelling or recall.",
        "challenge": "Similar names and long multiword names slow this mode down even when the map itself is easy. The tiny states add a separate visual problem.",
        "studyTipHeading": "Names that deserve their own practice",
        "studyTip": "The Balkans, the -stan countries and the Caucasus are worth short spelling sessions. There is no reason to replay the whole map just to fix a few names.",
        "sectionHeading": "Map mistake or name mistake?",
        "sectionBody": "When you miss one, notice why. A country you recognized but could not name needs different practice from one you placed in the wrong part of the map."
    },
    "find-country/south_america": {
        "lead": "South America only has 12 sovereign-country answers here, but removing the internal lines makes the north and the landlocked middle much less obvious.",
        "overview": "The round includes every sovereign country on the continent. Brazil fills most of the center and east; Bolivia and Paraguay are the two landlocked answers.",
        "howToPlay": "A country name appears on a South America map with the internal borders removed. Click its approximate location and keep going through all 12.",
        "gameplayTip": "Brazil touches most of the continent, so it is the easiest country to judge the others against.",
        "challenge": "Uruguay and Paraguay can blur together near southern Brazil. Colombia and Venezuela split the northern coast, and Guyana and Suriname are easy to reverse.",
        "studyTipHeading": "Learning the blank map",
        "studyTip": "The Pacific side has a clean north-to-south order. The two landlocked countries are also worth learning as a pair.",
        "exampleSentence": "Chile is hard to lose. The northeast around Guyana and Suriname is where a blank map gets less friendly."
    },
    "find-subdivision/us_states": {
        "lead": "The state lines are gone. You get the outline of the United States and have to place all 50 states from your mental map.",
        "overview": "The quiz includes the 48 contiguous states plus Alaska and Hawaii. With the internal lines hidden, rectangle-shaped states stop being easy just because you recognize their outline.",
        "howToPlay": "A state name appears on a US map with the state borders removed. Click where it belongs. Coastlines and the national outline stay visible.",
        "gameplayTip": "Find the region first. A rough click from the whole national map is usually worse than narrowing it to the right part of the country.",
        "challenge": "The Northeast is crowded, and the Great Plains lose the rectangular borders that normally do half the work for you.",
        "studyTipHeading": "Learning the blank US map",
        "studyTip": "The coasts and Great Lakes give you useful structure. The Plains and interior West need more pure position memory.",
        "sectionBody": "Washington, DC is a federal district, so it is not one of the 50 state answers in this quiz.",
        "exampleSentence": "Florida and Michigan still give you obvious shapes. Kansas does not."
    },
    "click-country/europe": {
        "lead": "This is the standard Europe map quiz: a country name appears, the borders stay visible and you click the matching shape.",
        "overview": "All 44 countries are here, from the big peninsulas and islands to the microstates. Most players get slowed down in the crowded middle of the continent.",
        "howToPlay": "Read the country name and click its bordered area. A wrong click stays useful because you can see exactly which neighbor you chose.",
        "gameplayTip": "When two small countries keep swapping places, learn the border they share rather than memorizing both shapes separately."
    }
}
for page, changes in page_updates.items():
    if page in data.get("pages", {}):
        data["pages"][page].update(changes)


def clean_string(s):
    replacements = {
        " as anchors": " as reference points",
        " as an anchor": " as a reference point",
        "anchor countries": "countries you already know",
        "anchor country": "country you already know",
        "main anchors": "main reference points",
        "large anchors": "large reference points",
        "geographic anchors": "geographic clues",
        "anchors before": "reference points before",
        "central anchor": "main reference point",
    }
    for a, b in replacements.items():
        s = s.replace(a, b)
    return s


def walk(obj):
    if isinstance(obj, dict):
        return {k: walk(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [walk(v) for v in obj]
    if isinstance(obj, str):
        return clean_string(obj)
    return obj


data = walk(data)
data_path.write_text(json.dumps(data, indent=4, ensure_ascii=False) + "\n")

# The personality layer should be short and specific. These replacements remove the
# most obvious canned contrast/list patterns while keeping the geographic detail.
lp = Path("tools/landing_personality.js")
text = lp.read_text()
replacements = {
    "Ghana, Kenya, Botswana, and the two Congos make useful anchors, but a lot of the work happens between those anchors.": "Ghana and Kenya are easy to find. The countries between the better-known shapes are where this set usually slows down.",
    "Learn a few anchor countries first": "Learn a few big shapes first",
    "Use the Horn and the lakes as anchors": "Know the Horn and the Great Lakes",
    "Turkey, Iran, and Saudi Arabia are easy anchors, while Bahrain, Qatar, Kuwait, Lebanon, and Israel demand much finer placement.": "Turkey, Iran and Saudi Arabia are hard to miss. The Gulf states and the Levant need much finer placement.",
    "Anchor the small states to a large neighbor": "Place the small states around their neighbors",
    "Australia and New Zealand are obvious anchors; the Pacific island states turn the same quiz into a search across enormous stretches of ocean.": "Australia and New Zealand are obvious. The Pacific island states are a completely different kind of question.",
    "Kazakhstan and India are strong anchors, but Kyrgyzstan, Tajikistan, Nepal, Bhutan, and Bangladesh compress a lot of geography into narrow spaces.": "Kazakhstan and India are huge on the map. Kyrgyzstan, Tajikistan, Nepal and Bhutan are where the spacing gets tight.",
    "Spain, Italy, and Greece are excellent anchors, but Malta, San Marino, Vatican City, and the Balkans make the small-scale details matter.": "Spain, Italy and Greece are easy to orient around. Malta, the microstates and the Balkans need much closer map memory.",
    "Senegal, Ethiopia, South Africa, Madagascar, and the Democratic Republic of the Congo are useful anchors, but they leave a lot of map between them.": "Senegal, Ethiopia and South Africa are easy landmarks. There is still a lot of inland Africa between the obvious shapes.",
    "Build a network of anchor countries": "Learn the region in smaller pieces",
    "California and Texas are instant anchors; Delaware, Rhode Island, and several central states ask for much finer shape and neighbor memory.": "California and Texas are instant. Delaware, Rhode Island and the middle of the country take more work.",
    "Pair every island with a nearby anchor": "Give each island a nearby reference point",
    "Use Brazil as the central anchor, then learn which countries touch its long border and which do not.": "Brazil touches almost everyone. Use that border pattern to sort out the rest.",
    "The Baltic states, eastern Europe, the Caucasus, and Central Asia are easier to remember as separate clusters connected by the history of the set.": "The Baltics, the Caucasus and Central Asia each feel like their own little map. Learn them that way.",
    "Treating them the same usually makes the set harder.": "The two halves really do need different map memory.",
    "Knowing the region is not enough": "Tiny islands punish rough guesses",
    "Think in bands, not one block": "Four smaller maps work better here",
    "A political set, not a geographic one": "Membership makes the map weird",
    "Language does not give you a map region": "The set is scattered across the world",
    "There is no single useful center": "The map never settles down",
    "The landmarks are strong, the gaps are not": "The gaps are the hard part",
    "Names are only half the problem": "Neighbor order matters here",
    "Zoom is part of the challenge": "You will need to zoom",
}
for old, new in replacements.items():
    text = text.replace(old, new)
text = text.replace("anchor", "reference point")
lp.write_text(text)

# A couple generator-level fallbacks were also written in the same polished template voice.
replace_once(
    "tools/generate_quiz_pages.js",
    "`Review nearby places together, then return to the full group for mixed practice.`,",
    "`If this set is rough, spend a while on one of its smaller regional quizzes.`,"
)

flag = Path("tools/generate_flag_pages.js")
flag_text = flag.read_text()
flag_text = flag_text.replace(
    "This flag quiz uses the same countries as the matching map quizzes, keeping flag and map practice aligned.",
    "This uses the same country list as the matching map quizzes."
)
flag.write_text(flag_text)

# About page: keep the first-person voice and get rid of the overly polished list cadence.
about = Path("about/index.html")
s = about.read_text()
s = s.replace(
    "Smurdy is a free geography quiz site that I build and run independently. I started it because I wanted map practice that was quick to open, had more than one kind of question, and let me keep making the difficulty weirder when the normal quizzes got easy.",
    "Smurdy is a free geography quiz site I build and run myself. It started as a map quiz I wanted to play. Every time that got too easy, I added a harder version or some new kind of geography question."
)
s = s.replace(
    "I go by Smurdy online. I like geography and programming, and I spend a ridiculous amount of time staring at maps, planning trips, and thinking of geography challenges. A lot of features here started because I was playing the site myself and thought, \"this would be better if it did this instead.\"",
    "I go by Smurdy online. I like geography and programming. I also spend a ridiculous amount of time staring at maps and thinking up geography challenges. A lot of features exist because I was playing the site, got annoyed by something, and changed it."
)
s = s.replace(
    "I do not think knowing a map is one skill. Recognizing France with every border visible is different from typing its name from a shape, placing it on a blank map, recognizing its flag, or remembering Paris. Smurdy keeps those as separate quizzes instead of treating one score as proof that you know everything.",
    "Knowing a map has a few different failure modes. I can recognize France instantly and still blank on a flag or capital. That is why those show up as separate quizzes and separate Weak Spots."
)
s = s.replace(
    "The order changes constantly, but the current list includes Locate modes for flags and capitals, country-shape quizzes, major-city quizzes, Study Mode, and a Smurdy Daily challenge. I also want to keep expanding subdivisions and make the site much better for teachers without making the normal quizzes harder to start.",
    "The order changes constantly. Right now I want to add Locate modes, country-shape quizzes, more city stuff, Study Mode and a daily challenge. Subdivisions still have a lot of room to grow too."
)
s = s.replace(
    "Some of the smaller changes come from things I notice while playing, and others come directly from people who send bug reports or suggestions. If something feels wrong, confusing, or missing, <a href=\"/contact/\">send it here</a>.",
    "I catch plenty of bugs by playing Smurdy myself, but people also send useful corrections and weirdly specific ideas. If you notice something, <a href=\"/contact/\">send it here</a>."
)
about.write_text(s)

contact = Path("contact/index.html")
s = contact.read_text()
s = s.replace(
    "<li><strong>Bug:</strong> the quiz link, what you did, and what happened.</li>",
    "<li><strong>Bug:</strong> send the quiz link and tell me what happened. What you clicked right before it broke is useful too.</li>"
)
s = s.replace(
    "<li><strong>Wrong answer or map data:</strong> the quiz link and a source if you have one.</li>",
    "<li><strong>Wrong answer or map data:</strong> send the quiz link. A source helps if you have one.</li>"
)
s = s.replace(
    "<li><strong>Visual problem:</strong> a screenshot is usually the fastest way for me to understand it.</li>",
    "<li><strong>Visual problem:</strong> screenshots help a lot.</li>"
)
contact.write_text(s)

privacy = Path("privacy/index.html")
s = privacy.read_text()
s = s.replace(
    "This information is used to deliver the site, maintain security, understand usage, and improve the quizzes.",
    "This information helps run the site, keep it secure and show which parts people actually use."
)
s = s.replace(
    "Favorites and recent history stay in your browser and are not attached to an account. You can remove this data by clearing site data in your browser.",
    "Favorites and recent history stay in your browser. There is no Smurdy account attached to them. Clearing the site data in your browser removes them."
)
privacy.write_text(s)

# Make the voice rules durable so future page work does not reintroduce the same templates.
guidelines = Path("DESIGN_GUIDELINES.md")
g = guidelines.read_text()
marker = "## Writing voice\n"
block = """## Writing voice

Smurdy copy should sound like one person who actually plays the site. Plain and a little uneven is better than polished template prose.

Watch for these AI-heavy habits:
- repeated em dashes, slogan-like colons, or tidy three-part lists
- perfectly parallel bullets where every line has the same grammar
- abstract helper words such as “anchor,” “framework,” “seamless,” “robust,” “enhance,” or “delve” when a concrete noun works
- “not X, but Y,” “rather than,” “instead of,” and other contrast framing used just to make a sentence sound sharper
- instructions that always read like “Do X, then Y”
- paragraphs that end by restating the paragraph in cleaner words
- every sentence having the same medium length and polished cadence

Keep specific geography details. Let sentences be short sometimes. Lists do not need to be symmetrical, and the Oxford comma is optional when the meaning is clear.

"""
if marker not in g:
    g = block + g
guidelines.write_text(g)

# Version bump.
app = Path("src/js/app_core.js")
s = app.read_text()
if 'const APP_VERSION = "1.16.6";' not in s:
    raise SystemExit("Expected 1.16.6 app version")
app.write_text(s.replace('const APP_VERSION = "1.16.6";', 'const APP_VERSION = "1.16.7";', 1))

# Regression coverage for the strongest tells. This intentionally does not ban every
# use of words such as "instead"; the problem is repetitive structure, not one word.
Path("tests/anti_ai_copy.test.js").write_text(r'''const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("authored landing copy avoids the strongest recurring AI tells", () => {
    const source = [
        read("src/data/quiz_page_descriptions.json"),
        read("tools/landing_personality.js"),
        read("about/index.html"),
        read("contact/index.html")
    ].join("\n");
    assert.doesNotMatch(source, /—/);
    assert.doesNotMatch(source, /\bnot just\b/i);
    assert.doesNotMatch(source, /\bdelve\b|\btapestry\b|\bpivotal\b|\bseamless(?:ly)?\b|\brobust\b/i);
    assert.doesNotMatch(source, /\banchor(?:s|ed|ing)?\b/i);
});

test("anti-AI copy pass is versioned", () => {
    assert.match(read("src/js/app_core.js"), /const APP_VERSION = "1\.16\.7";/);
});
''')
