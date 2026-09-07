# Daily Calorie Tracker

A minimal, black/gray/white calorie & protein tracker for a single day, built as a static
HTML/CSS/JS mini app (no build step, no dependencies).

## Run it

Any static file server works, e.g.:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in a browser.

You can also just open `index.html` directly in a browser.

## How it works

- **Summary card**: total foods logged, total calories, total protein, and total calories
  burned, plus progress bars against the daily goals (1700 kcal + any workouts / 130g protein).
- **Today's Log** sits directly under the summary card, above the food catalog — every food you
  add appears with its calories, protein, portion, and time added, with an edit (✎) and a
  remove (×) button. Editing lets you correct the name, calories, protein, or portion of an
  already-logged item at any time; press Enter to save or Escape to cancel, or use the Delete
  button inside the edit form to remove it outright.
- **Frictionless delete**: removing a single item or clearing the whole log happens instantly
  — no confirmation popup — and shows a floating "Undo" toast for 6 seconds so a mis-tap is
  never permanent.
- **Food list**: built from the food reference sheet — fixed-portion items (e.g. air fryer
  grilled chicken, boiled egg, Greek yogurt) get a single tap **+** button; per-100g items
  (banana, turkey bacon, blueberries, potato) let you enter grams before adding.
- **Add Any Food**: anything not in the preset list can be logged directly — enter a name,
  calories, protein, and an optional portion label.
- **Workouts**: log calories burned from exercise (activity name + calories) the same way as
  food — add, edit, or delete, with the same instant/undo behavior. Calories burned are added
  to the day's calorie budget (`1700 base + burned`), so the Calories progress bar reflects
  what you've actually eaten against goal-plus-exercise, matching the "eat back your exercise
  calories" model most calorie trackers use.
- **Daily reset**: the log and workouts are stored in `localStorage` keyed by the local
  calendar date (`calorie-tracker-log-YYYY-MM-DD`, `calorie-tracker-workouts-YYYY-MM-DD`). At
  midnight local time the key rolls over, so both start empty for the new day — no manual
  reset needed. If the app is left open across midnight, it detects the date change and
  refreshes itself. A live countdown to the next reset is shown in the header.

There's no "Ask a nutrition question" box in this copy — that needs a live connection to
Claude, which a static page can't have, so it only exists in the separately-published
Artifact version, not in these files or the GitHub Pages site they build.

## Using it on iPhone

The layout is edge-to-edge and sized for phone screens (tested at iPhone SE, iPhone 14, and
iPhone 14 Pro Max widths), respects the notch/home-indicator safe areas, and inputs use a
16px minimum font size so Safari doesn't auto-zoom when you tap them.

To use it like a native app: open `index.html` in Safari on your iPhone, tap the Share icon,
then **Add to Home Screen**. It will launch full-screen (no browser address bar) with a
black status bar and its own icon, via the included `manifest.webmanifest` and
`icons/apple-touch-icon.png`.

## Editing the food list

Foods are defined in `app.js` in the `FIXED_FOODS` and `SCALABLE_FOODS` arrays, sourced from
the food reference sheet (goal: 130g protein/day, ~1700 kcal/day).
