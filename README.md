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

- **Food list**: built from the food reference sheet — fixed-portion items (e.g. air fryer
  grilled chicken, boiled egg, Greek yogurt) get a single tap **+** button; per-100g items
  (banana, turkey bacon, blueberries, potato) let you enter grams before adding.
- **Today's Log**: every food you add appears with its calories, protein, portion, and time
  added, with a remove button.
- **Summary**: total foods logged, total calories, and total protein are shown at the top,
  plus progress bars against the daily goals (1700 kcal / 130g protein).
- **Daily reset**: the log is stored in `localStorage` keyed by the local calendar date
  (`calorie-tracker-log-YYYY-MM-DD`). At midnight local time the key rolls over, so the log
  automatically starts empty for the new day — no manual reset needed. If the app is left
  open across midnight, it detects the date change and refreshes itself. A live countdown to
  the next reset is shown in the header.

## Editing the food list

Foods are defined in `app.js` in the `FIXED_FOODS` and `SCALABLE_FOODS` arrays, sourced from
the food reference sheet (goal: 130g protein/day, ~1700 kcal/day).
