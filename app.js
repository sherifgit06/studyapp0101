/* MedPomo — Pomodoro study tracker for medical students.
   Pure vanilla JS, persisted to localStorage. No build step. */

(() => {
  'use strict';

  const STORAGE_KEY = 'medpomo.v1';

  const DEFAULT_SUBJECTS = [
    'Anatomy', 'Physiology', 'Biochemistry', 'Histology', 'Embryology',
    'Pathology', 'Pharmacology', 'Microbiology', 'Immunology',
    'Internal Medicine', 'Surgery', 'Pediatrics', 'OB-GYN', 'Psychiatry',
    'Neurology', 'Cardiology', 'Radiology', 'USMLE Step 1', 'USMLE Step 2 CK'
  ];

  const SUBJECT_GROUPS = [
    ['Preclinical', DEFAULT_SUBJECTS.slice(0, 9)],
    ['Clinical',    DEFAULT_SUBJECTS.slice(9, 17)],
    ['Board exams', DEFAULT_SUBJECTS.slice(17)],
  ];

  const SUBJECT_COLORS = [
    '#0e7c66', '#2f7dc1', '#6b4ee0', '#d04a55', '#c97a16',
    '#3aa55a', '#b04a8a', '#1f7a8c', '#e08a3c', '#5a6acf',
    '#7a994a', '#cc4a6f', '#3a8585', '#a05a3a', '#4a8acf',
    '#7d4ad0', '#16958e', '#b07a16', '#5570c7'
  ];

  const TIPS = [
    'Active recall + spaced repetition beats re-reading. Use Anki daily — even 15 min counts.',
    'Pair Pathoma with Pathology lectures, and Sketchy with Microbiology and Pharm for image-based recall.',
    'After each focus block, summarise what you learned in 2 sentences without looking at your notes.',
    'Use UWorld in tutor mode early; switch to timed/random as you approach exam day.',
    'Sleep is consolidation. Aim for 7–8 hrs — pulling all-nighters before exams hurts more than it helps.',
    'Draw diagrams from memory: cardiac cycle, nephron, brachial plexus. If you can draw it, you know it.',
    'Treat your first pass of First Aid as orientation, not memorisation. Detail comes from QBank review.',
    'Block social media during focus blocks. Even short interruptions cost 15+ min of deep focus.',
    'Review a topic the same day, then 3 days later, then a week later — that\'s minimum spaced repetition.',
    'On wards, learn one teaching point per patient encounter and write it down before you go home.',
    'Hydrate and eat protein during long study days — your brain runs on glucose and water.',
    'Difficult cards in Anki? Don\'t suspend — break them into smaller atomic facts.',
    'Make your own mnemonics. Yours stick better than any list you read in a textbook.',
    'When you get a QBank question wrong, write the *concept* — not the answer — into your notes.',
    'Mix subjects within a day (interleaving) — your brain retains better than blocking one topic for hours.'
  ];

  const RESOURCE_LABEL = {
    lectures: 'Lectures', textbook: 'Textbook', qbank: 'QBank',
    anki: 'Anki', video: 'Video', clinical: 'Clinical', other: 'Other'
  };

  const ACHIEVEMENTS = [
    { id: 'first_session', icon: '🥇', name: 'First steps',     desc: 'Log your first focus block',
      check: s => s.sessions.length >= 1 },
    { id: 'streak_3',      icon: '🔥', name: '3-day streak',     desc: 'Study 3 days in a row',
      check: s => computeStreak(s) >= 3 },
    { id: 'streak_7',      icon: '🔥', name: 'Week strong',      desc: 'Study 7 days in a row',
      check: s => computeStreak(s) >= 7 },
    { id: 'streak_30',     icon: '🏆', name: 'Iron month',       desc: 'Study 30 days in a row',
      check: s => computeStreak(s) >= 30 },
    { id: 'hours_10',      icon: '⏱',  name: '10 hours',         desc: 'Total study time ≥ 10 h',
      check: s => totalHours(s) >= 10 },
    { id: 'hours_50',      icon: '⏱',  name: '50 hours',         desc: 'Total study time ≥ 50 h',
      check: s => totalHours(s) >= 50 },
    { id: 'hours_100',     icon: '💪', name: 'Centurion',        desc: 'Total study time ≥ 100 h',
      check: s => totalHours(s) >= 100 },
    { id: 'hours_500',     icon: '🏅', name: 'Half-thousand',    desc: 'Total study time ≥ 500 h',
      check: s => totalHours(s) >= 500 },
    { id: 'qbank_100',     icon: '❓', name: 'QBank rookie',      desc: '100 questions answered',
      check: s => sumField(s, 'qNum') >= 100 },
    { id: 'qbank_1000',    icon: '🎯', name: 'QBank pro',         desc: '1000 questions answered',
      check: s => sumField(s, 'qNum') >= 1000 },
    { id: 'qbank_70',      icon: '✅', name: '70% accuracy',      desc: '70%+ on ≥ 200 questions',
      check: s => { const q = sumField(s, 'qNum'); return q >= 200 && sumField(s, 'qCorrect') / q >= 0.7; } },
    { id: 'anki_500',      icon: '🃏', name: 'Card flipper',      desc: '500 Anki cards reviewed',
      check: s => sumField(s, 'ankiCards') >= 500 },
    { id: 'anki_5000',     icon: '🃏', name: 'Anki addict',       desc: '5000 Anki cards reviewed',
      check: s => sumField(s, 'ankiCards') >= 5000 },
    { id: 'subjects_5',    icon: '📚', name: 'Generalist',        desc: 'Study 5 different subjects',
      check: s => new Set(s.sessions.map(x => x.subject)).size >= 5 },
    { id: 'day_4h',        icon: '🌟', name: '4-hour day',        desc: 'Study 4 h in a single day',
      check: s => maxDayHours(s) >= 4 },
    { id: 'day_8h',        icon: '🌟', name: '8-hour day',        desc: 'Study 8 h in a single day',
      check: s => maxDayHours(s) >= 8 },
    { id: 'early_bird',    icon: '🌅', name: 'Early bird',        desc: 'A focus block starting before 7 am',
      check: s => s.sessions.some(x => new Date(x.start).getHours() < 7) },
    { id: 'night_owl',     icon: '🦉', name: 'Night owl',         desc: 'A focus block starting after 10 pm',
      check: s => s.sessions.some(x => new Date(x.start).getHours() >= 22) },
  ];

  // ---------- State ----------
  const defaultState = () => ({
    settings: {
      focusMin: 25,
      shortMin: 5,
      longMin: 20,
      cyclesPerLong: 4,
      dailyGoalHrs: 4,
      autoStartBreaks: true,
      autoStartFocus: false,
      sound: true,
      notify: false,
      reflect: true,
      theme: 'auto'
    },
    customSubjects: [],
    sessions: [],
    cycleCount: 0,
    lastSubject: DEFAULT_SUBJECTS[0],
    lastResource: 'lectures',
    exams: [],
    plan: { date: '', blocks: [] },  // blocks: {id, subject, topic, minutes, doneSec, sessionId}
    concepts: [],                     // {id, ts, subject, title, text}
    achievements: {}                  // {id: ts}
  });

  let state = load();
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const def = defaultState();
      const merged = Object.assign(def, parsed);
      merged.settings = Object.assign(def.settings, parsed.settings || {});
      merged.plan = Object.assign(def.plan, parsed.plan || {});
      return merged;
    } catch (e) {
      console.warn('Failed to load state, resetting.', e);
      return defaultState();
    }
  }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

  // ---------- Stats helpers (used inside ACHIEVEMENTS) ----------
  function totalHours(s) { return s.sessions.reduce((a, x) => a + (x.durationSec || 0), 0) / 3600; }
  function sumField(s, f) { return s.sessions.reduce((a, x) => a + (x[f] || 0), 0); }
  function maxDayHours(s) {
    const byDay = {};
    for (const x of s.sessions) {
      const d = new Date(x.start); d.setHours(0,0,0,0);
      const k = +d;
      byDay[k] = (byDay[k] || 0) + (x.durationSec || 0);
    }
    return Math.max(0, ...Object.values(byDay)) / 3600;
  }
  function computeStreak(s = state) {
    let n = 0;
    const cursor = new Date(); cursor.setHours(0,0,0,0);
    while (true) {
      const has = s.sessions.some(x => sameDay(new Date(x.start), cursor));
      if (!has) {
        if (n === 0 && sameDay(cursor, new Date())) {
          cursor.setDate(cursor.getDate() - 1);
          continue;
        }
        break;
      }
      n += 1;
      cursor.setDate(cursor.getDate() - 1);
      if (n > 365) break;
    }
    return n;
  }

  // ---------- Timer engine ----------
  const timer = {
    mode: 'focus',
    running: false,
    endTime: 0,
    remaining: 0,
    totalMs: 0,
    startedAt: 0,
    interval: null,
    pendingPlanBlockId: null,   // if a plan block was loaded into the timer
    lastSession: null,           // most recent session (for the reflect modal)
    oneShotMin: 0                // overrides focus minutes for the next block only
  };

  function modeMinutes(mode) {
    if (mode === 'focus' && timer.oneShotMin > 0) return timer.oneShotMin;
    return mode === 'focus' ? state.settings.focusMin
         : mode === 'short' ? state.settings.shortMin
         : state.settings.longMin;
  }

  function setMode(mode, opts = {}) {
    stopTicking();
    timer.mode = mode;
    timer.totalMs = modeMinutes(mode) * 60 * 1000;
    timer.remaining = timer.totalMs;
    timer.running = false;
    timer.endTime = 0;
    timer.startedAt = 0;
    document.querySelectorAll('.mode-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    document.querySelector('.timer-ring').dataset.mode = mode;
    $('#modeLabel').textContent =
      mode === 'focus' ? 'Focus' : mode === 'short' ? 'Short break' : 'Long break';
    $('#startBtn').disabled = false;
    $('#startBtn').textContent = 'Start';
    $('#pauseBtn').disabled = true;
    render();
    if (opts.autoStart) start();
  }

  function start() {
    if (timer.running) return;
    timer.running = true;
    timer.endTime = Date.now() + timer.remaining;
    if (!timer.startedAt && timer.mode === 'focus') timer.startedAt = Date.now();
    $('#startBtn').disabled = true;
    $('#pauseBtn').disabled = false;
    $('#startBtn').textContent = 'Running…';
    startTicking();
  }

  function pause() {
    if (!timer.running) return;
    timer.running = false;
    timer.remaining = Math.max(0, timer.endTime - Date.now());
    stopTicking();
    $('#startBtn').disabled = false;
    $('#pauseBtn').disabled = true;
    $('#startBtn').textContent = 'Resume';
  }

  function reset() {
    stopTicking();
    timer.running = false;
    timer.oneShotMin = 0;
    timer.pendingPlanBlockId = null;
    timer.totalMs = modeMinutes(timer.mode) * 60 * 1000;
    timer.remaining = timer.totalMs;
    timer.endTime = 0;
    timer.startedAt = 0;
    $('#startBtn').disabled = false;
    $('#pauseBtn').disabled = true;
    $('#startBtn').textContent = 'Start';
    render();
  }

  function skip() { finishBlock({ skipped: true }); }

  function startTicking() {
    stopTicking();
    timer.interval = setInterval(tick, 250);
    tick();
  }
  function stopTicking() {
    if (timer.interval) { clearInterval(timer.interval); timer.interval = null; }
  }

  function tick() {
    if (!timer.running) { render(); return; }
    const remaining = timer.endTime - Date.now();
    if (remaining <= 0) {
      timer.remaining = 0;
      finishBlock({ skipped: false });
      return;
    }
    timer.remaining = remaining;
    render();
  }

  function finishBlock({ skipped }) {
    stopTicking();
    timer.running = false;
    const wasFocus = timer.mode === 'focus';
    let savedSession = null;
    if (wasFocus && timer.startedAt) {
      const endedAt = skipped ? Date.now() : timer.startedAt + timer.totalMs;
      const elapsedSec = Math.max(0, Math.round((endedAt - timer.startedAt) / 1000));
      if (elapsedSec >= 60) {
        savedSession = {
          id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
          start: timer.startedAt,
          end:   timer.startedAt + elapsedSec * 1000,
          durationSec: elapsedSec,
          subject:  $('#subjectSelect').value,
          topic:   ($('#topicInput').value || '').trim(),
          resource: $('#resourceSelect').value,
          qNum: 0, qCorrect: 0, ankiCards: 0, note: ''
        };
        state.sessions.push(savedSession);
        state.lastSubject = savedSession.subject;
        state.lastResource = savedSession.resource;
        state.cycleCount += 1;

        // mark planned block done if linked
        if (timer.pendingPlanBlockId) {
          const block = state.plan.blocks.find(b => b.id === timer.pendingPlanBlockId);
          if (block) {
            block.doneSec = (block.doneSec || 0) + elapsedSec;
            if (block.doneSec >= block.minutes * 60 * 0.9) block.done = true;
            block.sessionId = savedSession.id;
          }
        }

        save();
        timer.lastSession = savedSession;
      }
    }
    timer.pendingPlanBlockId = null;
    timer.oneShotMin = 0;

    if (!skipped) {
      notify(wasFocus ? 'Focus block complete — time for a break.' : 'Break over — back to studying.');
      if (state.settings.sound) playDing();
    }

    let next;
    if (wasFocus) {
      const goLong = state.cycleCount > 0 && state.cycleCount % state.settings.cyclesPerLong === 0;
      next = goLong ? 'long' : 'short';
    } else {
      next = 'focus';
    }
    const auto = (wasFocus && state.settings.autoStartBreaks)
              || (!wasFocus && state.settings.autoStartFocus);
    setMode(next, { autoStart: !skipped && auto });

    if (savedSession) {
      checkAchievements();
      if (state.settings.reflect) openReflectModal(savedSession);
    }
    renderAll();
  }

  // ---------- Render: core timer ----------
  function render() {
    const ms = timer.running ? Math.max(0, timer.endTime - Date.now()) : timer.remaining;
    $('#timeDisplay').textContent = formatMS(ms);
    document.title = (timer.running ? formatMS(ms) + ' — ' : '') + 'MedPomo';

    const ring = $('#ringProgress');
    const C = 565.48;
    const pct = timer.totalMs ? (1 - ms / timer.totalMs) : 0;
    ring.style.strokeDashoffset = String(C * pct);

    const cyclesPerLong = state.settings.cyclesPerLong;
    $('#cyclesUntilLong').textContent = cyclesPerLong;
    const inThisRound = state.cycleCount % cyclesPerLong;
    let cycleNumber, filledDots;
    if (timer.mode === 'focus') {
      cycleNumber = inThisRound + 1;
      filledDots = inThisRound;
    } else if (timer.mode === 'long') {
      cycleNumber = cyclesPerLong;
      filledDots = cyclesPerLong;
    } else {
      cycleNumber = inThisRound === 0 ? cyclesPerLong : inThisRound;
      filledDots = inThisRound;
    }
    $('#cycleCount').textContent = cycleNumber;
    const dots = $('#cycleDots');
    dots.innerHTML = '';
    for (let i = 0; i < cyclesPerLong; i++) {
      const d = document.createElement('span');
      d.className = 'dot' + (i < filledDots ? ' done' : '');
      dots.appendChild(d);
    }
  }

  function renderAll() {
    applyTheme();
    renderExamBanner();
    renderTopStats();
    renderTodayList();
    renderWeekBars();
    renderSubjectBreakdown();
    renderGoal();
    renderHeatmap();
    renderPlan();
    renderSpacedReview();
    render();
  }

  function renderTopStats() {
    $('#todayHours').textContent = (sumSec(filterDay(new Date())) / 3600).toFixed(1);
    $('#weekHours').textContent  = (sumSec(filterLastNDays(7)) / 3600).toFixed(1);
    $('#streakDays').textContent = computeStreak();
  }

  function renderTodayList() {
    const list = $('#todayList');
    const today = filterDay(new Date()).slice().reverse();
    if (today.length === 0) {
      list.innerHTML = '<li class="empty">No sessions yet — start your first focus block.</li>';
      return;
    }
    list.innerHTML = '';
    for (const s of today) {
      const li = document.createElement('li');
      const meta = [
        `<span class="sess-tag">${RESOURCE_LABEL[s.resource] || s.resource}</span>`
      ];
      if (s.qNum) meta.push(`<span>${s.qCorrect}/${s.qNum} Qs · ${Math.round(s.qCorrect/s.qNum*100)}%</span>`);
      if (s.ankiCards) meta.push(`<span>${s.ankiCards} cards</span>`);
      li.innerHTML =
        `<span class="sess-time">${fmtTime(s.start)}</span>` +
        `<span><span class="sess-subject">${escapeHtml(s.subject)}</span>` +
          (s.topic ? ` <span class="sess-topic">— ${escapeHtml(s.topic)}</span>` : '') +
        `</span>` +
        `<span class="sess-dur">${Math.round(s.durationSec / 60)}m</span>` +
        `<span class="sess-meta">${meta.join(' ')}</span>` +
        (s.note ? `<span class="sess-note">${escapeHtml(s.note)}</span>` : '');
      list.appendChild(li);
    }
  }

  function renderWeekBars() {
    const bars = $('#weekBars');
    bars.innerHTML = '';
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i); d.setHours(0,0,0,0);
      const sec = sumSec(filterDay(d));
      days.push({ date: d, hours: sec / 3600 });
    }
    const maxH = Math.max(state.settings.dailyGoalHrs, ...days.map(d => d.hours), 1);
    for (const d of days) {
      const col = document.createElement('div'); col.className = 'bar-col';
      const track = document.createElement('div'); track.className = 'bar-track';
      const fill = document.createElement('div');
      fill.className = 'bar-fill' + (sameDay(d.date, new Date()) ? ' today' : '');
      fill.style.height = (Math.min(100, (d.hours / maxH) * 100)).toFixed(1) + '%';
      track.appendChild(fill);
      const val = document.createElement('div');
      val.className = 'bar-val';
      val.textContent = d.hours >= 0.05 ? d.hours.toFixed(1) : '–';
      const lbl = document.createElement('div');
      lbl.className = 'bar-label';
      lbl.textContent = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.date.getDay()];
      col.appendChild(track); col.appendChild(val); col.appendChild(lbl);
      bars.appendChild(col);
    }
  }

  function renderSubjectBreakdown() {
    const list = $('#subjectBreakdown');
    list.innerHTML = '';
    const week = filterLastNDays(7);
    if (week.length === 0) {
      list.innerHTML = '<li class="bd-empty">No data yet for the past 7 days.</li>';
      return;
    }
    const totals = new Map();
    for (const s of week) totals.set(s.subject, (totals.get(s.subject) || 0) + s.durationSec);
    const sum = [...totals.values()].reduce((a, b) => a + b, 0);
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    for (const [subject, sec] of sorted) {
      const pct = sum ? (sec / sum) * 100 : 0;
      const li = document.createElement('li');
      li.innerHTML =
        `<span class="bd-name"><span class="bd-swatch" style="background:${colorFor(subject)}"></span>${escapeHtml(subject)}</span>` +
        `<span>${(sec/3600).toFixed(1)}h · ${pct.toFixed(0)}%</span>` +
        `<span class="bd-bar"><span style="width:${pct}%; background:${colorFor(subject)}"></span></span>`;
      list.appendChild(li);
    }
  }

  function renderGoal() {
    const today = sumSec(filterDay(new Date())) / 3600;
    const goal  = state.settings.dailyGoalHrs;
    const pct   = Math.min(100, (today / goal) * 100);
    const fill  = $('#goalFill');
    fill.style.width = pct + '%';
    fill.classList.toggle('complete', today >= goal);
    $('#goalText').textContent = `${today.toFixed(1)} / ${goal.toFixed(1)} hrs`;
  }

  // ---------- Heatmap ----------
  function renderHeatmap() {
    const wrap = $('#heatmap');
    wrap.innerHTML = '';
    const today = new Date(); today.setHours(0,0,0,0);
    // Last 53 weeks. Start week aligns to Sunday.
    const totalDays = 53 * 7;
    const start = new Date(today);
    start.setDate(today.getDate() - (totalDays - 1));
    // Pad start back to most recent Sunday.
    const padStart = start.getDay(); // 0..6
    start.setDate(start.getDate() - padStart);

    // Build per-day totals for last 60 weeks worth of sessions
    const byDay = new Map();
    for (const s of state.sessions) {
      const d = new Date(s.start); d.setHours(0,0,0,0);
      const k = +d;
      byDay.set(k, (byDay.get(k) || 0) + s.durationSec);
    }

    const cells = (53 + 1) * 7;
    let totalHrsYear = 0;
    let activeDays = 0;
    for (let i = 0; i < cells; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const span = document.createElement('span');
      span.className = 'hm-cell';
      if (d > today) {
        span.classList.add('empty-pad');
      } else {
        const sec = byDay.get(+d) || 0;
        const hrs = sec / 3600;
        if (hrs > 0) { totalHrsYear += hrs; activeDays += 1; }
        const level = hrs === 0 ? 0 : hrs < 0.5 ? 1 : hrs < 2 ? 2 : hrs < 4 ? 3 : 4;
        span.dataset.level = String(level);
        span.title = `${d.toDateString()} — ${hrs.toFixed(1)} h`;
      }
      wrap.appendChild(span);
    }
    $('#heatmapTotal').textContent = `${totalHrsYear.toFixed(1)} h across ${activeDays} active days · last 12 months`;
  }

  // ---------- Plan ----------
  function todayKey() { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,10); }

  function ensureFreshPlan() {
    if (state.plan.date !== todayKey()) {
      state.plan = { date: todayKey(), blocks: [] };
      save();
    }
  }

  function renderPlan() {
    ensureFreshPlan();
    const list = $('#planList');
    list.innerHTML = '';
    if (state.plan.blocks.length === 0) {
      list.innerHTML = '<li class="empty">No blocks planned yet — sketch out today\'s sessions to stay focused.</li>';
      return;
    }
    for (const b of state.plan.blocks) {
      const li = document.createElement('li');
      li.innerHTML =
        `<button class="plan-check ${b.done ? 'done' : ''}" data-toggle="${b.id}" title="Toggle done">${b.done ? '✓' : ''}</button>` +
        `<span class="plan-text"><strong>${escapeHtml(b.subject)}</strong>` +
          (b.topic ? ` <span class="plan-topic">— ${escapeHtml(b.topic)}</span>` : '') +
          ` <span class="plan-min">${b.minutes}m${b.doneSec ? ` · ${Math.round(b.doneSec/60)}m done` : ''}</span></span>` +
        `<button class="plan-load" data-load="${b.id}" title="Load into timer">load</button>` +
        `<button class="plan-del"  data-del="${b.id}"  title="Remove">✕</button>`;
      list.appendChild(li);
    }
  }

  // ---------- Spaced review ----------
  function renderSpacedReview() {
    // Subjects with ≥ 1 hour total study last touched 3+ days ago.
    const lastTouched = new Map();
    const totals = new Map();
    for (const s of state.sessions) {
      const d = new Date(s.start); d.setHours(0,0,0,0);
      const cur = lastTouched.get(s.subject) || 0;
      if (+d > cur) lastTouched.set(s.subject, +d);
      totals.set(s.subject, (totals.get(s.subject) || 0) + (s.durationSec || 0));
    }
    const today = new Date(); today.setHours(0,0,0,0);
    const due = [];
    for (const [subject, ts] of lastTouched) {
      const days = Math.floor((+today - ts) / (24*3600*1000));
      if (days >= 3 && (totals.get(subject) || 0) >= 3600) due.push({ subject, days });
    }
    due.sort((a, b) => b.days - a.days);
    due.splice(5);
    const card = $('#spacedReviewCard');
    const list = $('#reviewList');
    if (due.length === 0) { card.hidden = true; return; }
    card.hidden = false;
    list.innerHTML = '';
    for (const d of due) {
      const li = document.createElement('li');
      li.innerHTML =
        `<span><span class="rv-subject">${escapeHtml(d.subject)}</span><br>` +
          `<span class="rv-when">last studied ${d.days} day${d.days===1?'':'s'} ago</span></span>` +
        `<button class="btn small" data-review="${escapeHtml(d.subject)}">Review now</button>`;
      list.appendChild(li);
    }
  }

  // ---------- Exam banner ----------
  function renderExamBanner() {
    const el = $('#examBanner');
    if (!state.exams || state.exams.length === 0) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '';
    const now = new Date(); now.setHours(0,0,0,0);
    const sorted = state.exams.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    for (const e of sorted) {
      const ed = new Date(e.date + 'T00:00:00');
      const days = Math.ceil((ed - now) / (24*3600*1000));
      const span = document.createElement('span'); span.className = 'exam-pill';
      const label = days < 0 ? 'past'
                  : days === 0 ? 'today!'
                  : days === 1 ? '1 day'
                  : `${days} days`;
      span.innerHTML = `<strong>${escapeHtml(e.name)}</strong> · <span class="exam-days">${label}</span> ` +
        `<button data-rm-exam="${e.id}" title="Remove">✕</button>`;
      el.appendChild(span);
    }
  }

  // ---------- Subjects ----------
  function allSubjects() { return [...DEFAULT_SUBJECTS, ...state.customSubjects]; }
  function colorFor(subject) {
    const list = allSubjects();
    const idx = Math.max(0, list.indexOf(subject));
    return SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
  }
  function fillSubjectSelect(sel, currentVal) {
    sel.innerHTML = '';
    for (const [label, subs] of SUBJECT_GROUPS) {
      const og = document.createElement('optgroup'); og.label = label;
      for (const s of subs) {
        const o = document.createElement('option'); o.value = s; o.textContent = s; og.appendChild(o);
      }
      sel.appendChild(og);
    }
    if (state.customSubjects.length) {
      const og = document.createElement('optgroup'); og.label = 'Custom';
      for (const s of state.customSubjects) {
        const o = document.createElement('option'); o.value = s; o.textContent = s; og.appendChild(o);
      }
      sel.appendChild(og);
    }
    if (currentVal && allSubjects().includes(currentVal)) sel.value = currentVal;
    else sel.value = DEFAULT_SUBJECTS[0];
  }
  function rebuildSubjectSelects() {
    fillSubjectSelect($('#subjectSelect'), $('#subjectSelect').value || state.lastSubject);
    fillSubjectSelect($('#planSubject'),    $('#planSubject') ? $('#planSubject').value : null);
    fillSubjectSelect($('#conceptSubject'), $('#conceptSubject') ? $('#conceptSubject').value : null);

    // concept filter
    const cf = $('#conceptFilterSubject');
    const prev = cf.value;
    cf.innerHTML = '<option value="">All subjects</option>';
    for (const s of allSubjects()) {
      const o = document.createElement('option'); o.value = s; o.textContent = s; cf.appendChild(o);
    }
    cf.value = prev || '';
  }
  function rebuildCustomSubjectChips() {
    const ul = $('#customSubjectList');
    ul.innerHTML = '';
    if (state.customSubjects.length === 0) {
      ul.innerHTML = '<li class="bd-empty">No custom subjects yet.</li>';
      return;
    }
    for (const s of state.customSubjects) {
      const li = document.createElement('li'); li.className = 'chip';
      li.innerHTML = `${escapeHtml(s)} <button data-sub="${escapeHtml(s)}" title="Remove">✕</button>`;
      ul.appendChild(li);
    }
  }
  function rebuildExamChips() {
    const ul = $('#examList');
    ul.innerHTML = '';
    if (!state.exams || state.exams.length === 0) {
      ul.innerHTML = '<li class="bd-empty">No exams yet — add one to get a countdown.</li>';
      return;
    }
    for (const e of state.exams) {
      const li = document.createElement('li'); li.className = 'chip';
      li.innerHTML = `${escapeHtml(e.name)} · ${e.date} <button data-rm-exam-list="${e.id}" title="Remove">✕</button>`;
      ul.appendChild(li);
    }
  }

  // ---------- Concepts ----------
  function renderConcepts() {
    const list = $('#conceptList');
    const q = ($('#conceptSearch').value || '').trim().toLowerCase();
    const subjFilter = $('#conceptFilterSubject').value;
    const items = state.concepts
      .slice().sort((a, b) => b.ts - a.ts)
      .filter(c => !subjFilter || c.subject === subjFilter)
      .filter(c => !q ||
        (c.text || '').toLowerCase().includes(q) ||
        (c.title || '').toLowerCase().includes(q) ||
        (c.subject || '').toLowerCase().includes(q));
    if (items.length === 0) {
      list.innerHTML = '<li class="bd-empty">No concepts match. Tip: capture mnemonics, drug pearls, and difficult facts as you study.</li>';
      return;
    }
    list.innerHTML = '';
    for (const c of items) {
      const li = document.createElement('li');
      li.innerHTML =
        `<div class="c-head">` +
          `<span class="c-subject" style="color:${colorFor(c.subject)}">${escapeHtml(c.subject)}${c.title ? ' · ' + escapeHtml(c.title) : ''}</span>` +
          `<span><span class="c-date">${fmtDate(c.ts)}</span> <button class="c-del" data-cdel="${c.id}" title="Delete">✕</button></span>` +
        `</div>` +
        `<div class="c-text">${escapeHtml(c.text)}</div>`;
      list.appendChild(li);
    }
  }

  // ---------- Stats modal ----------
  function renderStats() {
    const body = $('#statsBody');
    const all = state.sessions;
    const totalSec = all.reduce((a, x) => a + (x.durationSec || 0), 0);
    const totalMin = totalSec / 60;
    const totalHrs = totalSec / 3600;
    const days = new Set(all.map(x => { const d = new Date(x.start); d.setHours(0,0,0,0); return +d; }));
    const avgSession = all.length ? totalMin / all.length : 0;
    const longestStreak = computeLongestStreak();
    const qNum = sumField(state, 'qNum');
    const qCorrect = sumField(state, 'qCorrect');
    const ankiCards = sumField(state, 'ankiCards');
    const accuracy = qNum ? (qCorrect / qNum * 100) : 0;
    const bestDay = (() => {
      const map = {};
      for (const x of all) {
        const d = new Date(x.start); d.setHours(0,0,0,0);
        map[+d] = (map[+d] || 0) + x.durationSec;
      }
      let best = 0, bestKey = null;
      for (const k in map) if (map[k] > best) { best = map[k]; bestKey = k; }
      return bestKey ? { hrs: best/3600, date: new Date(+bestKey) } : null;
    })();

    // Time of day distribution
    const hourBuckets = new Array(24).fill(0);
    for (const s of all) {
      const start = new Date(s.start);
      const startH = start.getHours();
      hourBuckets[startH] += (s.durationSec || 0) / 3600;
    }
    const maxHour = Math.max(0.0001, ...hourBuckets);

    const tile = (v, l) => `<div class="stats-tile"><div class="v">${v}</div><div class="l">${l}</div></div>`;
    let html = '<div class="stats-grid">';
    html += tile(totalHrs.toFixed(1), 'Total hours');
    html += tile(all.length, 'Sessions');
    html += tile(days.size, 'Active days');
    html += tile(computeStreak(), 'Current streak');
    html += tile(longestStreak, 'Longest streak');
    html += tile(avgSession.toFixed(0) + 'm', 'Avg session');
    if (bestDay) html += tile(bestDay.hrs.toFixed(1) + 'h', 'Best day · ' + bestDay.date.toLocaleDateString());
    html += tile(qNum, 'QBank Qs');
    if (qNum) html += tile(accuracy.toFixed(0) + '%', 'QBank accuracy');
    html += tile(ankiCards, 'Anki cards');
    html += '</div>';

    html += '<h3>Time-of-day · all sessions</h3>';
    html += '<div class="hour-bars">';
    for (let h = 0; h < 24; h++) {
      const pct = (hourBuckets[h] / maxHour) * 100;
      html += `<div class="hb" title="${h}:00 — ${hourBuckets[h].toFixed(1)} h"><span style="height:${pct}%"></span></div>`;
    }
    html += '</div><div class="hour-axis">';
    for (let h = 0; h < 24; h++) html += `<span>${h%6===0 ? h : ''}</span>`;
    html += '</div>';

    html += '<h3>Achievements</h3>';
    html += '<ul class="achv-list">';
    for (const a of ACHIEVEMENTS) {
      const unlocked = !!state.achievements[a.id];
      html +=
        `<li class="${unlocked ? 'unlocked' : ''}">` +
          `<span class="achv-icon">${a.icon}</span>` +
          `<span><span class="achv-name">${escapeHtml(a.name)}</span><br>` +
          `<span class="achv-desc">${escapeHtml(a.desc)}</span></span>` +
        `</li>`;
    }
    html += '</ul>';

    body.innerHTML = html;
  }

  function computeLongestStreak() {
    if (state.sessions.length === 0) return 0;
    const days = new Set(state.sessions.map(x => { const d = new Date(x.start); d.setHours(0,0,0,0); return +d; }));
    const sorted = [...days].sort((a, b) => a - b);
    let best = 1, cur = 1;
    for (let i = 1; i < sorted.length; i++) {
      const diff = (sorted[i] - sorted[i-1]) / (24*3600*1000);
      if (diff === 1) { cur += 1; best = Math.max(best, cur); }
      else if (diff > 1) { cur = 1; }
    }
    return best;
  }

  // ---------- Achievements ----------
  function checkAchievements() {
    let any = false;
    for (const a of ACHIEVEMENTS) {
      if (!state.achievements[a.id] && a.check(state)) {
        state.achievements[a.id] = Date.now();
        any = true;
        toast(`${a.icon} <strong>${a.name}</strong> unlocked — ${a.desc}`);
      }
    }
    if (any) save();
  }

  // ---------- Reflect modal ----------
  function openReflectModal(session) {
    $('#reflectQNum').value = '';
    $('#reflectQCorrect').value = '';
    $('#reflectAnkiCards').value = '';
    $('#reflectNote').value = '';
    $('#reflectQbank').hidden = session.resource !== 'qbank';
    $('#reflectAnki').hidden  = session.resource !== 'anki';
    $('#reflectSummary').innerHTML =
      `<strong>${escapeHtml(session.subject)}</strong>` +
      (session.topic ? ` — ${escapeHtml(session.topic)}` : '') +
      ` · ${Math.round(session.durationSec/60)} min · ${RESOURCE_LABEL[session.resource] || session.resource}`;
    $('#reflectModal').hidden = false;
    setTimeout(() => $('#reflectNote').focus(), 50);
  }

  function saveReflect() {
    const session = timer.lastSession;
    if (!session) { closeModal('reflectModal'); return; }
    const qNum = parseInt($('#reflectQNum').value, 10);
    const qCor = parseInt($('#reflectQCorrect').value, 10);
    const cards = parseInt($('#reflectAnkiCards').value, 10);
    const note = ($('#reflectNote').value || '').trim();
    const ref = state.sessions.find(s => s.id === session.id);
    if (ref) {
      if (Number.isFinite(qNum)) ref.qNum = Math.max(0, qNum);
      if (Number.isFinite(qCor)) ref.qCorrect = Math.max(0, Math.min(qCor, ref.qNum || qCor));
      if (Number.isFinite(cards)) ref.ankiCards = Math.max(0, cards);
      if (note) ref.note = note;
      save();
      checkAchievements();
      renderAll();
    }
    closeModal('reflectModal');
  }

  // ---------- Modals ----------
  function openModal(id) { $('#' + id).hidden = false; }
  function closeModal(id) { $('#' + id).hidden = true; }

  // ---------- Theme ----------
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.settings.theme || 'auto');
    document.body.setAttribute('data-theme', state.settings.theme || 'auto');
  }
  function cycleTheme() {
    const order = ['auto', 'light', 'dark'];
    const idx = order.indexOf(state.settings.theme || 'auto');
    state.settings.theme = order[(idx + 1) % order.length];
    save();
    document.querySelectorAll('input[name="theme"]').forEach(r => { r.checked = r.value === state.settings.theme; });
    applyTheme();
    toast(`Theme: ${state.settings.theme}`);
  }

  // ---------- Notifications & sound ----------
  function notify(msg) {
    if (state.settings.notify && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification('MedPomo', { body: msg }); } catch (_) {}
    }
  }
  let audioCtx;
  function playDing() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      [880, 1320].forEach((freq, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0, now + i * 0.18);
        g.gain.linearRampToValueAtTime(0.18, now + i * 0.18 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.4);
        o.connect(g).connect(audioCtx.destination);
        o.start(now + i * 0.18);
        o.stop(now + i * 0.18 + 0.45);
      });
    } catch (e) { /* ignore */ }
  }

  function toast(html) {
    const wrap = $('#toasts');
    const div = document.createElement('div');
    div.className = 'toast';
    div.innerHTML = `<span class="toast-icon">🎉</span><span>${html}</span>`;
    wrap.appendChild(div);
    setTimeout(() => {
      div.style.transition = 'opacity 0.3s ease';
      div.style.opacity = '0';
      setTimeout(() => div.remove(), 300);
    }, 4500);
  }

  // ---------- Helpers ----------
  function $(sel) { return document.querySelector(sel); }
  function filterDay(date) {
    const start = new Date(date); start.setHours(0,0,0,0);
    const end = new Date(start); end.setDate(start.getDate() + 1);
    return state.sessions.filter(s => s.start >= +start && s.start < +end);
  }
  function filterLastNDays(n) {
    const end = new Date(); end.setHours(23,59,59,999);
    const start = new Date(end); start.setDate(end.getDate() - (n - 1)); start.setHours(0,0,0,0);
    return state.sessions.filter(s => s.start >= +start && s.start <= +end);
  }
  function sumSec(arr) { return arr.reduce((a, s) => a + (s.durationSec || 0), 0); }
  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function formatMS(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
  function fmtTime(ts) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  function fmtDate(ts) { return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' }); }
  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function uid() { return Date.now() + '-' + Math.random().toString(36).slice(2, 8); }

  // ---------- Settings UI ----------
  function openSettings() {
    $('#focusMin').value         = state.settings.focusMin;
    $('#shortMin').value         = state.settings.shortMin;
    $('#longMin').value          = state.settings.longMin;
    $('#cyclesPerLong').value    = state.settings.cyclesPerLong;
    $('#dailyGoal').value        = state.settings.dailyGoalHrs;
    $('#autoStartBreaks').checked = state.settings.autoStartBreaks;
    $('#autoStartFocus').checked  = state.settings.autoStartFocus;
    $('#soundOn').checked         = state.settings.sound;
    $('#notifyOn').checked        = state.settings.notify;
    $('#reflectPrompt').checked   = state.settings.reflect;
    document.querySelectorAll('input[name="theme"]').forEach(r => { r.checked = r.value === (state.settings.theme || 'auto'); });
    rebuildCustomSubjectChips();
    rebuildExamChips();
    openModal('settingsModal');
  }

  function bindSettingsInputs() {
    const mapNum = {
      focusMin: 'focusMin', shortMin: 'shortMin', longMin: 'longMin',
      cyclesPerLong: 'cyclesPerLong', dailyGoalHrs: 'dailyGoal'
    };
    Object.entries(mapNum).forEach(([key, id]) => {
      $('#' + id).addEventListener('change', e => {
        let v = parseFloat(e.target.value);
        if (!isFinite(v) || v <= 0) v = state.settings[key];
        state.settings[key] = v;
        save();
        if ((key === 'focusMin' && timer.mode === 'focus')
         || (key === 'shortMin' && timer.mode === 'short')
         || (key === 'longMin'  && timer.mode === 'long')) {
          if (!timer.running) reset();
        }
        renderAll();
      });
    });
    const mapBool = {
      autoStartBreaks: 'autoStartBreaks',
      autoStartFocus:  'autoStartFocus',
      sound:           'soundOn',
      notify:          'notifyOn',
      reflect:         'reflectPrompt'
    };
    Object.entries(mapBool).forEach(([key, id]) => {
      $('#' + id).addEventListener('change', async e => {
        state.settings[key] = e.target.checked;
        if (key === 'notify' && e.target.checked && 'Notification' in window) {
          if (Notification.permission !== 'granted') {
            const p = await Notification.requestPermission();
            if (p !== 'granted') {
              state.settings.notify = false;
              e.target.checked = false;
            }
          }
        }
        save();
      });
    });
    document.querySelectorAll('input[name="theme"]').forEach(r => {
      r.addEventListener('change', e => {
        if (e.target.checked) {
          state.settings.theme = e.target.value;
          save();
          applyTheme();
        }
      });
    });
  }

  // ---------- Wire up ----------
  function init() {
    rebuildSubjectSelects();
    $('#subjectSelect').value = state.lastSubject || DEFAULT_SUBJECTS[0];
    $('#resourceSelect').value = state.lastResource || 'lectures';

    setMode('focus');

    document.querySelectorAll('.mode-tab').forEach(b => {
      b.addEventListener('click', () => setMode(b.dataset.mode));
    });
    $('#startBtn').addEventListener('click', start);
    $('#pauseBtn').addEventListener('click', pause);
    $('#resetBtn').addEventListener('click', reset);
    $('#skipBtn').addEventListener('click', skip);
    $('#captureBtn').addEventListener('click', () => {
      $('#conceptSubject').value = $('#subjectSelect').value;
      openModal('conceptsModal');
      setTimeout(() => $('#conceptText').focus(), 50);
    });

    $('#subjectSelect').addEventListener('change', e => {
      state.lastSubject = e.target.value;
      // If user manually changes subject, drop any planned block link to avoid mis-attribution
      if (timer.pendingPlanBlockId) {
        const b = state.plan.blocks.find(x => x.id === timer.pendingPlanBlockId);
        if (!b || b.subject !== e.target.value) {
          timer.pendingPlanBlockId = null;
          timer.oneShotMin = 0;
          if (!timer.running) reset();
        }
      }
      save();
    });
    $('#resourceSelect').addEventListener('change', e => { state.lastResource = e.target.value; save(); });

    // Top-bar buttons
    $('#settingsBtn').addEventListener('click', openSettings);
    $('#statsBtn').addEventListener('click', () => { renderStats(); openModal('statsModal'); });
    $('#conceptsBtn').addEventListener('click', () => { renderConcepts(); openModal('conceptsModal'); setTimeout(() => $('#conceptText').focus(), 50); });
    $('#themeBtn').addEventListener('click', cycleTheme);
    $('#fabCapture').addEventListener('click', () => { $('#conceptSubject').value = $('#subjectSelect').value; openModal('conceptsModal'); setTimeout(() => $('#conceptText').focus(), 50); });

    // Modal close handling
    document.querySelectorAll('[data-close]').forEach(b => {
      b.addEventListener('click', () => closeModal(b.dataset.close));
    });
    document.querySelectorAll('.modal-backdrop').forEach(bd => {
      bd.addEventListener('click', e => { if (e.target === bd) closeModal(bd.id); });
    });

    bindSettingsInputs();

    // Custom subjects
    $('#addSubjectBtn').addEventListener('click', () => {
      const v = ($('#newSubjectInput').value || '').trim();
      if (!v) return;
      if (allSubjects().some(s => s.toLowerCase() === v.toLowerCase())) return;
      state.customSubjects.push(v);
      save();
      $('#newSubjectInput').value = '';
      rebuildSubjectSelects();
      rebuildCustomSubjectChips();
    });
    $('#newSubjectInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); $('#addSubjectBtn').click(); }
    });
    $('#customSubjectList').addEventListener('click', e => {
      const btn = e.target.closest('button[data-sub]');
      if (!btn) return;
      const sub = btn.dataset.sub;
      state.customSubjects = state.customSubjects.filter(s => s !== sub);
      save();
      rebuildSubjectSelects();
      rebuildCustomSubjectChips();
    });

    // Exams
    $('#addExamForm').addEventListener('submit', e => {
      e.preventDefault();
      const name = ($('#examName').value || '').trim();
      const date = ($('#examDate').value || '').trim();
      if (!name || !date) return;
      state.exams.push({ id: uid(), name, date });
      save();
      $('#examName').value = ''; $('#examDate').value = '';
      rebuildExamChips();
      renderExamBanner();
    });
    $('#examList').addEventListener('click', e => {
      const btn = e.target.closest('button[data-rm-exam-list]');
      if (!btn) return;
      const id = btn.dataset.rmExamList;
      state.exams = state.exams.filter(x => x.id !== id);
      save();
      rebuildExamChips();
      renderExamBanner();
    });
    $('#examBanner').addEventListener('click', e => {
      const btn = e.target.closest('button[data-rm-exam]');
      if (!btn) return;
      const id = btn.dataset.rmExam;
      state.exams = state.exams.filter(x => x.id !== id);
      save();
      rebuildExamChips();
      renderExamBanner();
    });

    // Plan
    $('#addPlanBtn').addEventListener('click', () => {
      $('#addPlanForm').hidden = false;
      $('#planSubject').value = $('#subjectSelect').value;
      $('#planMin').value = state.settings.focusMin;
      setTimeout(() => $('#planTopic').focus(), 50);
    });
    $('#cancelPlanBtn').addEventListener('click', () => { $('#addPlanForm').hidden = true; });
    $('#addPlanForm').addEventListener('submit', e => {
      e.preventDefault();
      ensureFreshPlan();
      const block = {
        id: uid(),
        subject: $('#planSubject').value,
        topic: ($('#planTopic').value || '').trim(),
        minutes: Math.max(5, parseInt($('#planMin').value, 10) || 25),
        doneSec: 0,
        done: false
      };
      state.plan.blocks.push(block);
      save();
      $('#planTopic').value = '';
      $('#addPlanForm').hidden = true;
      renderPlan();
    });
    $('#planList').addEventListener('click', e => {
      const t = e.target.closest('button');
      if (!t) return;
      ensureFreshPlan();
      if (t.dataset.toggle) {
        const b = state.plan.blocks.find(x => x.id === t.dataset.toggle);
        if (b) { b.done = !b.done; save(); renderPlan(); }
      } else if (t.dataset.del) {
        state.plan.blocks = state.plan.blocks.filter(x => x.id !== t.dataset.del);
        save(); renderPlan();
      } else if (t.dataset.load) {
        const b = state.plan.blocks.find(x => x.id === t.dataset.load);
        if (b) {
          $('#subjectSelect').value = b.subject;
          $('#topicInput').value = b.topic || '';
          state.lastSubject = b.subject; save();
          // Override focus duration just for this run (without changing user's defaults)
          if (!timer.running) {
            timer.oneShotMin = b.minutes;
            setMode('focus');
          }
          timer.pendingPlanBlockId = b.id;
          window.scrollTo({ top: 0, behavior: 'smooth' });
          toast(`Loaded "${escapeHtml(b.subject)}${b.topic ? ' — ' + escapeHtml(b.topic) : ''}" into the timer.`);
        }
      }
    });

    // Spaced review "Review now"
    $('#reviewList').addEventListener('click', e => {
      const btn = e.target.closest('button[data-review]');
      if (!btn) return;
      $('#subjectSelect').value = btn.dataset.review;
      state.lastSubject = btn.dataset.review;
      save();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast(`Set up a focus block for ${escapeHtml(btn.dataset.review)}.`);
    });

    $('#clearTodayBtn').addEventListener('click', () => {
      if (!confirm('Remove today\'s logged sessions?')) return;
      const start = new Date(); start.setHours(0,0,0,0);
      state.sessions = state.sessions.filter(s => s.start < +start);
      save(); renderAll();
    });

    // Data
    $('#exportBtn').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'medpomo-export-' + new Date().toISOString().slice(0,10) + '.json';
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
    });
    $('#importBtn').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0]; if (!file) return;
      try {
        const text = await file.text();
        const incoming = JSON.parse(text);
        if (!incoming || typeof incoming !== 'object') throw new Error('Invalid file');
        if (!confirm('Replace current data with the imported file?')) return;
        const def = defaultState();
        state = Object.assign(def, incoming);
        state.settings = Object.assign(def.settings, incoming.settings || {});
        state.plan = Object.assign(def.plan, incoming.plan || {});
        save();
        rebuildSubjectSelects(); rebuildCustomSubjectChips(); rebuildExamChips();
        setMode('focus'); renderAll();
      } catch (err) {
        alert('Could not import file: ' + err.message);
      } finally {
        e.target.value = '';
      }
    });
    $('#resetAllBtn').addEventListener('click', () => {
      if (!confirm('This will delete ALL sessions, settings, exams, plans, concepts and achievements. Continue?')) return;
      state = defaultState();
      save();
      rebuildSubjectSelects(); rebuildCustomSubjectChips(); rebuildExamChips();
      setMode('focus'); renderAll();
    });

    // Concepts
    $('#conceptForm').addEventListener('submit', e => {
      e.preventDefault();
      const text = ($('#conceptText').value || '').trim();
      if (!text) return;
      state.concepts.push({
        id: uid(),
        ts: Date.now(),
        subject: $('#conceptSubject').value,
        title: ($('#conceptTitle').value || '').trim(),
        text
      });
      save();
      $('#conceptTitle').value = '';
      $('#conceptText').value = '';
      renderConcepts();
      toast('💡 Concept saved');
    });
    $('#conceptList').addEventListener('click', e => {
      const btn = e.target.closest('button[data-cdel]');
      if (!btn) return;
      state.concepts = state.concepts.filter(c => c.id !== btn.dataset.cdel);
      save();
      renderConcepts();
    });
    $('#conceptSearch').addEventListener('input', renderConcepts);
    $('#conceptFilterSubject').addEventListener('change', renderConcepts);

    // Reflect modal
    $('#reflectSaveBtn').addEventListener('click', saveReflect);
    $('#reflectSkipBtn').addEventListener('click', () => closeModal('reflectModal'));
    // Live correctness clamp
    $('#reflectQNum').addEventListener('input', () => {
      const max = parseInt($('#reflectQNum').value, 10) || 0;
      $('#reflectQCorrect').max = max;
    });

    // Tip
    let tipIdx = Math.floor(Math.random() * TIPS.length);
    const renderTip = () => { $('#tipText').textContent = TIPS[tipIdx]; };
    renderTip();
    $('#newTipBtn').addEventListener('click', () => {
      tipIdx = (tipIdx + 1) % TIPS.length;
      renderTip();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      // Don't fire shortcuts when modals are open
      const anyModalOpen = !document.querySelector('#settingsModal').hidden ||
                           !document.querySelector('#statsModal').hidden ||
                           !document.querySelector('#conceptsModal').hidden ||
                           !document.querySelector('#reflectModal').hidden;
      if (e.key === 'Escape') {
        ['settingsModal','statsModal','conceptsModal','reflectModal'].forEach(m => {
          if (!$('#' + m).hidden) closeModal(m);
        });
        return;
      }
      if (anyModalOpen) return;
      if (e.target.matches('input, textarea, select')) return;
      if (e.key === ' ') {
        e.preventDefault();
        timer.running ? pause() : start();
      } else if (e.key.toLowerCase() === 'r') {
        reset();
      } else if (e.key.toLowerCase() === 's') {
        skip();
      } else if (e.key.toLowerCase() === 'c') {
        $('#conceptSubject').value = $('#subjectSelect').value;
        openModal('conceptsModal');
        setTimeout(() => $('#conceptText').focus(), 50);
      }
    });

    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

    // Initial achievement check (in case data was imported)
    checkAchievements();
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
