# MedPomo — Study Tracker for Medical Students

A focused, no-frills Pomodoro study tracker built **for medical students**.
Plan focus blocks, log them against a med-school subject (preclinical,
clinical, board-exam), tag the resource (lectures, QBank, Anki,
Sketchy/Pathoma…), capture mnemonics in a vault, and watch your streaks,
heatmap, and exam countdown push you forward.

Pure HTML/CSS/JS — no build step, no server, no account. All data lives in
your browser's `localStorage` and never leaves your machine.

## Features

### Core timer
- **Pomodoro timer** with Focus / Short break / Long break modes and a
  circular progress ring.
- **Configurable durations** (defaults: 25 / 5 / 20 minutes; long break every
  4 cycles).
- **Auto-start** breaks and/or next focus block.
- **Sound ding** (synthesised via WebAudio, no audio file shipped) and
  optional **browser notifications**.

### Built for med school
- **Subject library** preloaded across **Preclinical** (Anatomy, Physiology,
  Biochemistry, Histology, Embryology, Pathology, Pharmacology,
  Microbiology, Immunology), **Clinical** (Internal Medicine, Surgery,
  Pediatrics, OB-GYN, Psychiatry, Neurology, Cardiology, Radiology), and
  **Board exams** (USMLE Step 1, Step 2 CK) — plus your own.
- **Resource tagging**: Lectures · Textbook · QBank (UWorld/Amboss) · Anki ·
  Video (B&B / Sketchy / Pathoma) · Clinical/wards.
- **Exam countdowns** at the top of the page — add USMLE Step 1, Step 2,
  shelves, or any exam date. The pill turns to "today!" on the day.
- **Today's plan** — sketch out blocks for the day with subject, topic, and
  duration; click **load** to pull a block straight into the timer.
- **Spaced-review nudges** — subjects you've put real time into but haven't
  touched in 3+ days surface as "Due for review" suggestions.
- **Concepts & mnemonics vault** — quick-capture (`💡` button or `C` key)
  any pearl, mnemonic, or hard fact tagged by subject; search and filter
  later.

### Logging that matches how med students actually study
- After each focus block, an optional **reflection prompt** asks for a
  short "what did you learn?" note.
- For **QBank** sessions, log questions answered + correct → automatic
  running totals and accuracy.
- For **Anki** sessions, log cards reviewed → running counter.

### Visual progress
- **Today's session log** with notes, QBank accuracy, and Anki cards inline.
- **Daily-goal** progress bar.
- **Weekly hours** bar chart.
- **7-day subject breakdown** with per-subject hours and percentages.
- **Year activity heatmap** — GitHub-contributions-style 53×7 grid coloured
  by daily hours.
- **Stats deep-dive** modal: total hours, sessions, active days, streaks
  (current + longest), best day, average session, QBank totals & accuracy,
  Anki totals, time-of-day distribution, and **achievements**.

### Achievements
First session · 3-/7-/30-day streaks · 10/50/100/500 hours · 100/1000 QBank
questions · 70% accuracy · 500/5000 Anki cards · 5 different subjects ·
4-hour and 8-hour days · Early bird · Night owl.

### Quality-of-life
- Light / Dark / Auto **theme** (toggle in the top bar or settings).
- Responsive layout — works on phones, tablets, and desktops.
- **Keyboard shortcuts**: `Space` start/pause · `R` reset · `S` skip ·
  `C` capture concept · `Esc` close modals.
- **Export / import** all data as JSON; **reset** wipes everything.
- Privacy-first: no analytics, no network calls, no account.

## Run it

It's static — just open `index.html` in a browser:

```bash
# from the repo root
python3 -m http.server 8000
# then visit http://localhost:8000
```

…or simply double-click `index.html`. For a permanent home, deploy via
**GitHub Pages** (Settings → Pages → deploy from branch).

## Pages

- `index.html` — marketing landing page with hero, features, FAQ, and the
  signup/login modal. Pressing **Get started** or **Log in** drops you into
  the app.
- `app.html` — the actual study tracker. Gated by a local session — visiting
  it without signing in bounces back to the landing page.

## Local-only auth (placeholder)

The "Sign up" and "Log in" forms are **local-only** for now: name, email
and a SHA-256-hashed password are stored in `localStorage` so the app feels
like a real product, and so a future backend can be plugged in without
changing any of the UI. **Don't reuse a real password.** The public API in
`auth.js` (`getSession`, `setSession`, `clearSession`) is the seam where the
backend will swap in.

## Files

- `index.html` — landing page
- `landing.css` — landing-page styles
- `app.html` — the tracker (gated by session)
- `styles.css` — app theme, layout, components
- `auth.js` — local auth, session storage, page bridge
- `app.js` — timer engine, persistence, stats, settings, concepts, plan,
  heatmap, achievements

## Tips for using it well

1. **Plan the day first**. Sketch 4–8 blocks in the morning — what subject,
   what topic, how long. Click **load** on each block when you start it.
2. **Always pick a real topic** (e.g. "Renal pharm — loop diuretics") — vague
   blocks make weak recall.
3. **Reflect for 30 seconds** after each block. The prompt is short on
   purpose: 1–3 things you want to remember.
4. **Capture concepts as you go**. If you see a mnemonic or a confusing fact,
   hit `C` (or the floating 💡 button) and dump it. Review the vault on
   weekends.
5. **Use the heatmap as a streak engine**. Don't break the chain — even 25
   minutes counts.
6. **Hit your daily goal** — start at 4 h preclinical, push to 8–10 h on
   dedicated.
7. **Trust spaced repetition**. When the "Due for review" card surfaces a
   subject, give it 25 minutes that day.

## Privacy

Everything is local. No analytics, no network calls. Export your JSON if you
want a backup.
