# MedMentor — Peer tutoring for medical students

A standalone web app where **senior medical students give tutoring sessions
to younger students**. Juniors browse tutors by subject, year, language, and
rating, then book a focused session; seniors publish a profile, take requests,
and build a reputation from real reviews.

This is a **separate app** from the Study Medicus tracker in the repo root — it
has its own pages, styles, scripts, and `localStorage` namespace
(`medmentor.*`). Nothing is shared.

Pure HTML/CSS/JS — no build step, no server, no dependencies. All data lives in
the browser's `localStorage`.

## Run it

```bash
# from the repo root
python3 -m http.server 8000
# then open http://localhost:8000/tutoring/
```

…or just open `tutoring/index.html` in a browser.

## What you can do

### As a student (juniors)
- **Browse & filter tutors** by subject (Anatomy → USMLE Step 2 CK → OSCEs),
  year of study, and sort by rating or price.
- **Search** by name, subject, or keyword.
- **View a tutor profile** — bio, subjects, languages, availability, reviews.
- **Book a session** — pick a subject, date/time, length, and format, and add
  a note on what you want to cover. See a live price estimate.
- **Manage sessions** from your dashboard: upcoming/past, cancel, and track
  your total learning time.

### As a tutor (seniors)
- **Create a profile** — name, school, year, hourly rate, bio, languages,
  subjects you can teach, and your typical availability. Live the moment you
  publish.
- **Receive booking requests** and **accept / decline** them.
- **Mark sessions complete** and track booked earnings from your dashboard.

## Files

- `index.html` — app shell (header, footer, auth modal) + view container
- `styles.css` — full design system and component styles
- `auth.js` — local, role-aware auth (student | tutor); session + accounts
- `app.js` — hash router, seed tutors, all views, booking + dashboard logic

## How it's built

- **Single-page app** with hash routing (`#/`, `#/tutors`, `#/tutor/:id`,
  `#/become`, `#/how`, `#/dashboard`).
- **Role-aware accounts** — sign up as a student or a tutor; the header and
  dashboard adapt to your role.
- **Six demo tutors** are seeded on first load so the app feels alive. Booking
  a demo tutor confirms instantly; booking a real tutor account creates a
  pending request that tutor can accept.

## Notes

MedMentor is a demo. Accounts, profiles, and bookings live only in your
browser — nothing is sent to a server, there are no real payments, and
sessions are peer study support, not medical advice. The auth API
(`getSession` / `setSession` / `clearSession` in `auth.js`) is the seam where a
real backend would plug in.
