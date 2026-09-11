# Smurdy Design Guidelines

Smurdy should feel like a deliberately built geography site, not a generic component-library demo or an AI-generated SaaS interface. Avoiding a "vibe-coded" look is a product requirement, not a minor stylistic preference.

Before adding any visible UI, ask: **does this element communicate something useful or make an interaction clearer, or does it mainly exist to make the page look designed?** If the answer is mostly the latter, simplify it.

## Core direction

- Prefer plain, restrained, conventional web UI over decorative interface patterns.
- Let hierarchy come from typography, spacing, alignment, and structure before adding another component.
- Preserve Smurdy's own identity through the eye logo, maps, flags, geography content, and eventually the handmade icon family rather than through generic SaaS styling.
- Keep important actions obvious, but do not make every action look equally important.
- Design for quick recognition and low friction. A geography quiz should feel easy to start and easy to understand.
- Functional surfaces such as dialogs, floating map panels, and inputs may look like surfaces. Do not flatten useful structure just to avoid cards.

## Motifs to actively avoid

Treat these as warning signs, especially when several appear together:

- Tiny uppercase eyebrow/kicker labels above headings, such as `RECOMMENDED NEXT`, when the heading already explains the section.
- Soft gray all-caps micro-labels with letter spacing used mainly for visual hierarchy.
- Redundant labels that narrate obvious structure.
- Excessive cards, nested cards, bordered boxes, or rounded containers around content that works as plain text or rows.
- Excessive pills and badges. A badge is appropriate for exceptional state or compact status information, not as default taxonomy decoration.
- Decorative gradients, glows, glassmorphism, unnecessary shadows, or oversized rounded corners.
- Repeated callout boxes for tips, explanations, or ordinary prose.
- Excessive helper microcopy explaining controls that are already clear.
- Decorative icons that do not improve recognition or function.
- Generic startup/SaaS language or components added mainly because they are fashionable.
- Creating hierarchy by adding more wrappers instead of improving spacing or typography.

## Labels and headings

- Use sentence case by default.
- Do not add a small label directly above a heading unless it conveys genuinely different information.
- Prefer short, concrete labels such as `Quiz`, `Mode`, and `Places` when a control group needs clarification.
- If spacing, alignment, or an icon can distinguish groups clearly, avoid additional explanatory text.
- Headings should sound specific to the actual page. Avoid interchangeable headings like `What you'll practice`, `Key benefits`, or `Why it matters` unless they genuinely fit the content.

## Cards, borders, and surfaces

Use a card or panel when the content is actually a separate surface or interaction. Good examples include:

- the map quiz control panel
- Choose a Quiz
- dialogs
- the flag display area
- form inputs

Do not automatically turn these into cards:

- directory entries
- related links
- explanatory paragraphs
- ordinary section content
- every quiz option

Prefer subtle dividers and whitespace for lists and directories.

## Buttons and links

- Primary actions should be visually obvious.
- Secondary utilities should be quieter and clearly separate from primary controls.
- Do not turn every navigation link into a button.
- Keep related controls together and unrelated utilities apart. For example, Share should not look like a fourth core quiz control beside Back, Give Up, and Restart.
- Avoid duplicating the same action on a short page unless there is a real scrolling or usability reason.

## Badges and status indicators

Badges are useful when they communicate compact state, for example:

- Weak Spots count
- `New`
- `Beta`
- a real notification count

Avoid badges for ordinary metadata when plain secondary text is enough.

## Icons

The planned icon family should strengthen Smurdy's identity, not replace useful words indiscriminately.

- Keep text beside icons for important concepts such as Maps, Flags, Capitals, Click, Type, No Borders, Point, Weak Spots, World, and US States.
- Icon-only controls are appropriate when the symbol is already standard UI language, such as close, collapse/expand, compact favorite, or compact share.
- Handmade icons should visually relate to the smurdeye: simple black line work, recognizable at small sizes, and not over-polished into a generic icon-library look.
- Do not add decorative icons beside headings simply to fill space.

## Quiz browser

The browser has multiple kinds of controls, so distinguish them intentionally without making every row a separate component.

- Browse / Favorites / Recent is navigation.
- Quiz / Mode / Places are separate filter dimensions.
- Use plain labels, alignment, spacing, and eventually icons to distinguish those dimensions.
- Avoid returning to large segmented-control cards or tiny uppercase section labels.

## Quiz landing pages

Landing pages are allowed to have more personality than the rest of the site.

- Prefer region-specific observations, examples, quirks, and practical study advice over generic SEO prose.
- Pages should not feel like the same template with region names substituted.
- It is fine for some pages to have an extra section or unusual heading when there is something genuinely interesting to say.
- Avoid manufacturing structure just to make a page longer.
- Related quizzes should remain easy to scan without becoming a wall of rounded chips.

## Information pages

- About should sound like a real independent project with a real author and point of view.
- Contact and Privacy should prioritize clarity over visual decoration.
- Plain editorial structure is preferable to feature-card grids.
- A rare authored callout can work if it says something specific and memorable; avoid generic quote/callout components.

## Generated UI and copy

Generated pages must still feel intentional.

- Shared generators should allow meaningful variation instead of forcing identical headings and section structures everywhere.
- Do not mass-produce filler sections solely to make pages look substantial.
- Generated copy should be concrete enough that it could not be pasted onto almost any other region unchanged.
- Prefer fewer strong pages or sections over more thin ones.

## Pre-merge anti-vibe audit

Before merging a user-facing change, explicitly review it for vibe-coded motifs. Ask:

1. Did this change add an eyebrow/kicker, tiny uppercase label, pill, badge, card, callout, or decorative wrapper?
2. If so, does that element communicate information that would be lost without it?
3. Is anything being explained twice through a label plus a heading, a button plus a nearby duplicate link, or helper text plus an obvious control?
4. Could spacing, typography, alignment, or a divider solve the same problem more simply?
5. Does the result look like Smurdy, or like a generic generated dashboard/SaaS component?
6. Is a secondary action competing visually with the main quiz action?
7. Does mobile still preserve the intended hierarchy rather than stacking every control into equally prominent blocks?

If any new UI feels suspicious, simplify first. It is easier to add necessary structure later than to repeatedly remove decorative structure after it spreads across the site.

## Testing conventions

Where practical, regression tests should enforce objective parts of these guidelines. Good candidates include:

- banning known redundant kicker/eyebrow text
- preventing duplicate controls on short landing pages
- preventing fixed/absolute placement for controls intended to live in panels
- preserving semantic labels and accessible names when icons replace visible text
- keeping generated page conventions consistent

Do not attempt to encode subjective visual taste into brittle tests. Tests should protect clear conventions; human review should handle the rest.
