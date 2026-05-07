# MedPomo — Study Tracker for Medical Students

A focused, no-frills Pomodoro study tracker built for medical students. Plan
focus blocks, log them against a medical-school subject (preclinical, clinical,
or board-exam), tag the resource (lectures, QBank, Anki, Sketchy/Pathoma…),
and watch the streaks and weekly hours add up.

Pure HTML/CSS/JS — no build step, no server, no account. All data lives in
your browser's `localStorage` and never leaves your machine.

## Features

- **Pomodoro timer** with Focus / Short break / Long break modes and a circular
  progress ring.
- **Configurable durations** (defaults: 25 / 5 / 20 minutes; long break every
  4 cycles).
- **Subject library** pre-loaded for med-school: Anatomy, Physiology,
  Biochemistry, Histology, Embryology, Pathology, Pharmacology, Microbiology,
  Immunology, Internal Medicine, Surgery, Pediatrics, OB-GYN, Psychiatry,
  Neurology, Cardiology, Radiology, USMLE Step 1, USMLE Step 2 CK — plus your
  own custom subjects.
- **Resource tagging** — Lectures, Textbook, QBank (UWorld/Amboss), Anki,
  Video (Boards & Beyond, Sketchy, Pathoma), Clinical/wards.
- **Today's log**, **weekly hours bar chart**, **7-day subject breakdown**, and
  a **daily-goal** progress bar.
- **Streak tracking** across consecutive study days.
- **Auto-start breaks/focus**, **sound ding** (synthesised, no audio file), and
  optional **browser notifications**.
- **Med-school study tips** rotated on demand.
- **Export / import** your data as JSON, or wipe it all.
- **Keyboard shortcuts**: `Space` start/pause, `R` reset, `S` skip.
- **Responsive** layout, **light & dark** mode (follows your OS setting).

## Run it

It's static — just open `index.html` in a browser:

```bash
# from the repo root
python3 -m http.server 8000
# then visit http://localhost:8000
```

…or simply double-click `index.html`.

## Files

- `index.html` — markup and DOM layout
- `styles.css` — theme, responsive grid, components
- `app.js` — timer engine, persistence, stats, settings

## Tips for using it well

1. Start with a clear **topic** for the block (e.g. "Renal pharmacology — loop
   diuretics") — vague blocks make weak recall.
2. Tag the **resource** so your weekly breakdown shows whether you're spending
   too much time passively (videos/lectures) vs. actively (QBank/Anki).
3. Set a realistic **daily goal**. For most preclinical days 4–6 hrs of true
   focused study is plenty; on dedicated, 8–10 hrs is the upper end.
4. Don't break your streak — even 25 minutes counts.

## Privacy

Everything is local. No analytics, no network calls. Export your JSON if you
want a backup.
