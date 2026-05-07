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
    'Make your own mnemonics. Yours stick better than any list you read in a textbook.'
  ];

  const RESOURCE_LABEL = {
    lectures: 'Lectures', textbook: 'Textbook', qbank: 'QBank',
    anki: 'Anki', video: 'Video', clinical: 'Clinical', other: 'Other'
  };

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
      notify: false
    },
    customSubjects: [],
    sessions: [], // {id, start, end, durationSec, subject, topic, resource}
    cycleCount: 0,
    lastSubject: DEFAULT_SUBJECTS[0],
    lastResource: 'lectures'
  });

  let state = load();
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed, {
        settings: Object.assign(defaultState().settings, parsed.settings || {})
      });
    } catch (e) {
      console.warn('Failed to load state, resetting.', e);
      return defaultState();
    }
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // ---------- Timer engine ----------
  const timer = {
    mode: 'focus',          // 'focus' | 'short' | 'long'
    running: false,
    endTime: 0,             // epoch ms when current block ends
    remaining: 0,           // ms remaining when paused
    totalMs: 0,             // total ms of current block
    startedAt: 0,           // epoch ms when current focus block started (for logging)
    interval: null
  };

  function modeMinutes(mode) {
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
    timer.totalMs = modeMinutes(timer.mode) * 60 * 1000;
    timer.remaining = timer.totalMs;
    timer.endTime = 0;
    timer.startedAt = 0;
    $('#startBtn').disabled = false;
    $('#pauseBtn').disabled = true;
    $('#startBtn').textContent = 'Start';
    render();
  }

  function skip() {
    // Treat skip as if the current block ended — but only log focus time actually elapsed.
    finishBlock({ skipped: true });
  }

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
    let elapsedSec = 0;
    if (wasFocus && timer.startedAt) {
      const endedAt = skipped ? Date.now() : timer.startedAt + timer.totalMs;
      elapsedSec = Math.max(0, Math.round((endedAt - timer.startedAt) / 1000));
      // Only log if at least 60s of focus actually happened
      if (elapsedSec >= 60) {
        const sess = {
          id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
          start: timer.startedAt,
          end: timer.startedAt + elapsedSec * 1000,
          durationSec: elapsedSec,
          subject: $('#subjectSelect').value,
          topic: ($('#topicInput').value || '').trim(),
          resource: $('#resourceSelect').value
        };
        state.sessions.push(sess);
        state.lastSubject = sess.subject;
        state.lastResource = sess.resource;
        state.cycleCount += 1;
        save();
      }
    }

    if (!skipped) {
      notify(wasFocus ? 'Focus block complete — time for a break.' :
                       'Break over — back to studying.');
      if (state.settings.sound) playDing();
    }

    // Decide next mode
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
    renderAll();
  }

  // ---------- Rendering ----------
  function render() {
    const ms = timer.running ? Math.max(0, timer.endTime - Date.now()) : timer.remaining;
    $('#timeDisplay').textContent = formatMS(ms);
    document.title = (timer.running ? formatMS(ms) + ' — ' : '') + 'MedPomo';

    const ring = $('#ringProgress');
    const C = 565.48;
    const pct = timer.totalMs ? (1 - ms / timer.totalMs) : 0;
    ring.style.strokeDashoffset = String(C * pct);

    // cycle dots
    const cyclesPerLong = state.settings.cyclesPerLong;
    $('#cyclesUntilLong').textContent = cyclesPerLong;
    const inThisRound = state.cycleCount % cyclesPerLong;
    let cycleNumber, filledDots;
    if (timer.mode === 'focus') {
      // about-to-do or doing the (inThisRound+1)-th cycle of this round
      cycleNumber = inThisRound + 1;
      filledDots = inThisRound;
    } else if (timer.mode === 'long') {
      // long break sits *after* finishing the round, so show it complete
      cycleNumber = cyclesPerLong;
      filledDots = cyclesPerLong;
    } else {
      // short break: reflects cycle just completed
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
    renderTopStats();
    renderTodayList();
    renderWeekBars();
    renderSubjectBreakdown();
    renderGoal();
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
      li.innerHTML =
        `<span class="sess-time">${fmtTime(s.start)}</span>` +
        `<span><span class="sess-subject">${escapeHtml(s.subject)}</span>` +
          (s.topic ? ` <span class="sess-topic">— ${escapeHtml(s.topic)}</span>` : '') +
          ` <span class="sess-topic">· ${RESOURCE_LABEL[s.resource] || s.resource}</span></span>` +
        `<span class="sess-dur">${Math.round(s.durationSec / 60)}m</span>`;
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

  // ---------- Stats helpers ----------
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
  function computeStreak() {
    let n = 0;
    const cursor = new Date(); cursor.setHours(0,0,0,0);
    while (true) {
      const has = filterDay(cursor).length > 0;
      if (!has) {
        // allow today to be empty without breaking the streak
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

  // ---------- Subjects ----------
  function allSubjects() {
    return [...DEFAULT_SUBJECTS, ...state.customSubjects];
  }
  function colorFor(subject) {
    const list = allSubjects();
    const idx = Math.max(0, list.indexOf(subject));
    return SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
  }
  function rebuildSubjectSelect() {
    const sel = $('#subjectSelect');
    const current = sel.value || state.lastSubject;
    sel.innerHTML = '';
    const groups = [
      ['Preclinical', DEFAULT_SUBJECTS.slice(0, 9)],
      ['Clinical',    DEFAULT_SUBJECTS.slice(9, 17)],
      ['Board exams', DEFAULT_SUBJECTS.slice(17)],
    ];
    for (const [label, subs] of groups) {
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
    sel.value = allSubjects().includes(current) ? current : DEFAULT_SUBJECTS[0];
  }
  function rebuildCustomSubjectChips() {
    const ul = $('#customSubjectList');
    ul.innerHTML = '';
    if (state.customSubjects.length === 0) {
      const li = document.createElement('li');
      li.className = 'bd-empty';
      li.textContent = 'No custom subjects yet.';
      ul.appendChild(li);
      return;
    }
    for (const s of state.customSubjects) {
      const li = document.createElement('li'); li.className = 'chip';
      li.innerHTML = `${escapeHtml(s)} <button data-sub="${escapeHtml(s)}" title="Remove">✕</button>`;
      ul.appendChild(li);
    }
  }

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
    rebuildCustomSubjectChips();
    $('#settingsModal').hidden = false;
  }
  function closeSettings() { $('#settingsModal').hidden = true; }

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
        // If the change affects the current mode's duration, reset display
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
      notify:          'notifyOn'
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
  }

  // ---------- Notifications & sound ----------
  function notify(msg) {
    if (state.settings.notify && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification('MedPomo', { body: msg }); } catch (_) {}
    }
  }

  // Generate a short ding using WebAudio so we don't ship an audio file.
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

  // ---------- Helpers ----------
  function $(sel) { return document.querySelector(sel); }
  function formatMS(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
  function fmtTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // ---------- Wire up ----------
  function init() {
    rebuildSubjectSelect();
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

    $('#subjectSelect').addEventListener('change', e => {
      state.lastSubject = e.target.value; save();
    });
    $('#resourceSelect').addEventListener('change', e => {
      state.lastResource = e.target.value; save();
    });

    $('#settingsBtn').addEventListener('click', openSettings);
    $('#closeSettings').addEventListener('click', closeSettings);
    $('#settingsModal').addEventListener('click', (e) => {
      if (e.target.id === 'settingsModal') closeSettings();
    });
    bindSettingsInputs();

    $('#addSubjectBtn').addEventListener('click', () => {
      const v = ($('#newSubjectInput').value || '').trim();
      if (!v) return;
      if (allSubjects().some(s => s.toLowerCase() === v.toLowerCase())) return;
      state.customSubjects.push(v);
      save();
      $('#newSubjectInput').value = '';
      rebuildSubjectSelect();
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
      rebuildSubjectSelect();
      rebuildCustomSubjectChips();
    });

    $('#clearTodayBtn').addEventListener('click', () => {
      if (!confirm('Remove today\'s logged sessions?')) return;
      const start = new Date(); start.setHours(0,0,0,0);
      state.sessions = state.sessions.filter(s => s.start < +start);
      save(); renderAll();
    });

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
        state = Object.assign(defaultState(), incoming, {
          settings: Object.assign(defaultState().settings, incoming.settings || {})
        });
        save();
        rebuildSubjectSelect(); rebuildCustomSubjectChips();
        setMode('focus'); renderAll();
      } catch (err) {
        alert('Could not import file: ' + err.message);
      } finally {
        e.target.value = '';
      }
    });
    $('#resetAllBtn').addEventListener('click', () => {
      if (!confirm('This will delete ALL sessions, settings and custom subjects. Continue?')) return;
      state = defaultState();
      save();
      rebuildSubjectSelect(); rebuildCustomSubjectChips();
      setMode('focus'); renderAll();
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
      if (e.target.matches('input, textarea, select')) return;
      if (e.key === ' ') {
        e.preventDefault();
        timer.running ? pause() : start();
      } else if (e.key.toLowerCase() === 'r') {
        reset();
      } else if (e.key.toLowerCase() === 's') {
        skip();
      }
    });

    // Re-sync when tab returns from background
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) tick();
    });

    renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
