from pathlib import Path
import json
import re

# This runs after anti_ai_copy_pass.py. Keep it focused on the patterns that were
# still too uniform after the broader rewrite.
p = Path("src/data/quiz_page_descriptions.json")
data = json.loads(p.read_text())
m = data["modes"]

m["click-country"].update({
    "skillsHeading": "What starts to stick",
    "strategyHeading": "Stuck on one?",
    "bestForHeading": "Best starting mode",
    "bestFor": "For a map you barely know, this is usually the easiest place to start. It also works well as a refresher after leaving a region alone for a while.",
    "mistakesHeading": "Common miss"
})
m["type-country"].update({
    "skillsHeading": "Where typing catches you",
    "strategyHeading": "When a name disappears",
    "bestForHeading": "Once the map looks familiar",
    "bestFor": "Typing is useful once the shapes feel familiar but some of the names still lag behind.",
    "mistakesHeading": "Common miss"
})
m["find-country"].update({
    "skillsHeading": "What the missing borders change",
    "strategyHeading": "When the map turns blank",
    "bestForHeading": "After bordered maps get easy",
    "bestFor": "Borderless mode is a good follow-up once the normal click map has become comfortable.",
    "mistakesHeading": "Common miss"
})
m["find-point"].update({
    "skillsHeading": "What the point exposes",
    "strategyHeading": "Read the dot",
    "bestForHeading": "For maps you already know",
    "bestFor": "Point mode works best on a map you already know pretty well. It exposes fuzzy boundaries quickly.",
    "mistakesHeading": "Common miss",
    "mistakes": "A dot beside a famous country can still be across the border. Its exact side of the line decides the answer."
})
m["click-subdivision"].update({
    "skillsHeading": "What starts to stick",
    "strategyHeading": "Stuck on one?",
    "bestForHeading": "Best starting mode",
    "bestFor": "This is the easiest subdivision mode to begin with on a new map.",
    "mistakesHeading": "Common miss"
})
m["type-subdivision"].update({
    "skillsHeading": "Where typing catches you",
    "strategyHeading": "When the name is slow",
    "bestForHeading": "Once the map looks familiar",
    "bestFor": "Typing is useful when the subdivision map looks familiar but the names are still slower than the shapes.",
    "mistakesHeading": "Common miss"
})
m["find-subdivision"].update({
    "skillsHeading": "What the missing lines change",
    "strategyHeading": "When the inside looks empty",
    "bestForHeading": "After the bordered version",
    "bestFor": "This gets interesting once the bordered subdivision map has become comfortable.",
    "mistakesHeading": "Common miss",
    "mistakes": "The blank interior is still full of clues. The outside border, coast and corners can narrow the answer down a lot."
})
m["find-point-subdivision"].update({
    "skillsHeading": "What the point exposes",
    "strategyHeading": "Read the dot",
    "bestForHeading": "For maps you already know",
    "bestFor": "This is mainly for subdivision maps whose basic outlines are already familiar.",
    "mistakesHeading": "Common miss"
})
m["type-capital"].update({
    "skillsHeading": "What starts to stick",
    "strategyHeading": "When a capital keeps slipping",
    "bestForHeading": "After the map itself",
    "bestFor": "Capital mode makes the most sense once the countries or states themselves are familiar.",
    "mistakesHeading": "Common miss"
})

groups = data["groups"]
groups["world"]["studyTip"] = "World works best after the continent quizzes feel comfortable. It is good at exposing slow switches between regions."
groups["asia"]["studyTip"] = "Asia is easier to remember as several smaller maps. Central Asia and mainland Southeast Asia are the two parts most likely to deserve their own practice."
groups["africa"]["studyTip"] = "The coast gives the continent a useful skeleton. Once that is familiar, the landlocked countries have somewhere to sit."
groups["eurasia"]["studyTip"] = "Eurasia works better as a combination quiz after Europe and the Asian subregions already feel familiar."
groups["small_island_countries"]["studyTip"] = "Ocean and subregion groups make this set much less random than one giant list."
groups["former_soviet_union"]["studyTip"] = "The Baltics, eastern Europe, the Caucasus and Central Asia are four useful chunks. Each has a different map pattern."

pages = data.get("pages", {})
pages["click-country/eurasia"]["overview"] = "The set joins the Europe and Asia groups on one continuous landmass. Questions can jump thousands of miles from one side of the map to the other."
pages["type-country/eurasia"]["overview"] = "The round runs from Western Europe to East Asia. The difficulty is keeping a lot of country names ready at once."
pages["type-country/eurasia"]["studyTip"] = "The Balkans, the -stan countries and the Caucasus are worth short spelling sessions. A few stubborn names do not need another full-map run."

# "Anchor" was one of the user's examples and remained in a few old page-level
# overrides. Remove the word completely while keeping the geography concrete.
def clean_string(value):
    replacements = {
        "the continent's largest anchor": "the continent's biggest reference point",
        "the obvious anchor": "the obvious reference point",
        "familiar anchors": "familiar starting points",
        "easy anchors": "easy reference points",
        "an anchor": "a reference point",
        "anchors": "reference points",
        "anchor": "reference point",
    }
    for old, new in replacements.items():
        value = re.sub(r"\b" + re.escape(old) + r"\b", new, value, flags=re.I)
    return value


def walk(value):
    if isinstance(value, dict):
        return {k: walk(v) for k, v in value.items()}
    if isinstance(value, list):
        return [walk(v) for v in value]
    if isinstance(value, str):
        return clean_string(value)
    return value


data = walk(data)
p.write_text(json.dumps(data, indent=4, ensure_ascii=False) + "\n")

# Personality copy got the same broad rewrite, but a few contrast-heavy headings
# and sentences survived it.
lp = Path("tools/landing_personality.js")
text = lp.read_text()
text = text.replace("reference pointss", "reference points")
text = text.replace("Learn the island groups, not just the dots", "Learn the island groups first")
text = text.replace(
    "The Balkans are a good test of whether you know the actual order of neighboring countries instead of only recognizing the names as a regional cluster.",
    "The Balkans make neighbor order matter. Recognizing the country names by themselves will not place them on this map."
)
# No authored personality copy should still use the signature word.
text = re.sub(r"\banchors\b", "reference points", text, flags=re.I)
text = re.sub(r"\banchor\b", "reference point", text, flags=re.I)
lp.write_text(text)
