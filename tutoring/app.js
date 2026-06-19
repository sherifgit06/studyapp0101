/* MedMentor — peer tutoring app.
   Hash-routed single-page app. All data in localStorage.
   Views: home, tutors (browse), tutor profile, become-a-tutor, how-it-works, dashboard. */

(() => {
  'use strict';

  const { getSession, uid, toast } = window.MedAuth;
  const TUTORS_KEY   = 'medmentor.tutors';
  const BOOKINGS_KEY = 'medmentor.bookings';

  // ---------- Subject catalogue ----------
  const SUBJECTS = [
    'Anatomy','Physiology','Biochemistry','Histology','Embryology','Pathology',
    'Pharmacology','Microbiology','Immunology','Internal Medicine','Surgery',
    'Pediatrics','OB-GYN','Psychiatry','Neurology','Cardiology','Radiology',
    'USMLE Step 1','USMLE Step 2 CK','OSCE / Clinical skills'
  ];
  const YEARS = ['Year 2','Year 3','Year 4','Year 5','Final year','Intern / PGY-1','Resident'];

  // ---------- Storage helpers ----------
  const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k) || f); } catch { return JSON.parse(f); } };
  const getTutors   = () => read(TUTORS_KEY, '[]');
  const setTutors   = (t) => localStorage.setItem(TUTORS_KEY, JSON.stringify(t));
  const getBookings = () => read(BOOKINGS_KEY, '[]');
  const setBookings = (b) => localStorage.setItem(BOOKINGS_KEY, JSON.stringify(b));

  // ---------- Seed demo tutors (once) ----------
  function seed() {
    if (localStorage.getItem(TUTORS_KEY)) return;
    const demo = [
      { name:'Amira Hassan', year:'Final year', school:'Cairo University', rate:18,
        subjects:['Pathology','Pharmacology','USMLE Step 1'], languages:['English','Arabic'],
        bio:'Scored 260+ on Step 1. I make pathology click with mechanisms, not memorisation. Patient, structured, lots of diagrams.',
        rating:4.9, reviewsList:[
          {name:'Yousef', stars:5, text:'Explained renal path better than any lecture. Booked again immediately.'},
          {name:'Lina', stars:5, text:'So calm and clear. Made pharm autonomics finally make sense.'}],
        avail:['Mon eve','Wed eve','Sat AM','Sun PM'] },
      { name:'Daniel Okafor', year:'Year 4', school:'UCL Medical School', rate:15,
        subjects:['Anatomy','Embryology','OSCE / Clinical skills'], languages:['English'],
        bio:'Anatomy demonstrator. I run cadaver-style walk-throughs over video and drill OSCE stations until they feel automatic.',
        rating:4.8, reviewsList:[
          {name:'Priya', stars:5, text:'OSCE prep was gold — passed my exam with his framework.'}],
        avail:['Tue eve','Thu eve','Sat PM'] },
      { name:'Sofia Rossi', year:'Resident', school:'University of Bologna', rate:25,
        subjects:['Internal Medicine','Cardiology','USMLE Step 2 CK'], languages:['English','Italian'],
        bio:'IM resident. I teach clinical reasoning the way the wards actually test it: scripts, ECGs, and management ladders.',
        rating:5.0, reviewsList:[
          {name:'Marco', stars:5, text:'Best ECG teacher I have met. Worth every penny.'},
          {name:'Tom', stars:5, text:'Turned my Step 2 score around in six sessions.'}],
        avail:['Mon eve','Fri eve','Sun AM'] },
      { name:'Grace Kim', year:'Year 3', school:'Yonsei University', rate:12,
        subjects:['Physiology','Biochemistry','Immunology'], languages:['English','Korean'],
        bio:'I love the molecular stuff. We will build up from first principles so you never have to rote-learn a pathway again.',
        rating:4.7, reviewsList:[
          {name:'Hana', stars:5, text:'Glycolysis finally makes sense. Super friendly.'}],
        avail:['Wed PM','Thu eve','Sat AM','Sun PM'] },
      { name:'Omar Farouk', year:'Year 5', school:'Ain Shams University', rate:14,
        subjects:['Microbiology','Pharmacology','Pathology'], languages:['English','Arabic'],
        bio:'Micro and pharm are just pattern recognition once you see the frameworks. High-yield, exam-focused, no fluff.',
        rating:4.6, reviewsList:[
          {name:'Sara', stars:4, text:'Great high-yield summaries, helped me cram effectively.'}],
        avail:['Mon eve','Tue eve','Sat PM'] },
      { name:'Eleni Papadakis', year:'Intern / PGY-1', school:'University of Athens', rate:20,
        subjects:['Pediatrics','OB-GYN','USMLE Step 2 CK'], languages:['English','Greek'],
        bio:'Just finished finals at the top of my class. I focus on peds and O&G clinical scenarios and viva confidence.',
        rating:4.9, reviewsList:[
          {name:'Nikos', stars:5, text:'Calmed my exam nerves and drilled the key presentations.'}],
        avail:['Tue eve','Thu PM','Sun AM'] },
    ];
    setTutors(demo.map(d => ({
      id: uid('t'), accountId: null, createdAt: Date.now(),
      reviews: d.reviewsList.length, ...d
    })));
  }

  // ---------- Small utils ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const initials = (n) => (n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const stars = (r) => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
  const money = (n) => '£' + Number(n).toFixed(0);

  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
  }
  function fmtTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit' });
  }
  function dayNum(iso) { return new Date(iso).getDate(); }
  function monShort(iso) { return new Date(iso).toLocaleDateString(undefined, { month:'short' }); }

  // Minimum bookable datetime: tomorrow 09:00, formatted for <input type=datetime-local>
  function defaultSlot() {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // ---------- Router ----------
  const app = document.getElementById('app');
  function parseHash() {
    const h = (location.hash || '#/').replace(/^#/, '');
    const parts = h.split('/').filter(Boolean); // e.g. ['tutor','t-abc']
    return { name: parts[0] || 'home', arg: parts[1] || null };
  }

  function render() {
    const { name, arg } = parseHash();
    window.scrollTo(0, 0);
    switch (name) {
      case 'home':      app.innerHTML = viewHome(); break;
      case 'tutors':    renderBrowse(); break;
      case 'tutor':     app.innerHTML = viewProfile(arg); afterProfile(arg); break;
      case 'become':    app.innerHTML = viewBecome(); afterBecome(); break;
      case 'how':       app.innerHTML = viewHow(); break;
      case 'dashboard': app.innerHTML = viewDashboard(); afterDashboard(); break;
      default:          app.innerHTML = viewHome();
    }
    highlightNav(name);
  }
  function highlightNav(name) {
    document.querySelectorAll('.topnav a').forEach(a => {
      a.style.background = a.getAttribute('href') === '#/' + name ? '#eef3f5' : '';
    });
  }

  // ============================================================
  // VIEW: Home
  // ============================================================
  function viewHome() {
    const tutors = getTutors();
    const featured = tutors.slice(0, 3);
    const avgRating = tutors.length ? (tutors.reduce((s, t) => s + t.rating, 0) / tutors.length).toFixed(1) : '5.0';
    return `
    <section class="hero">
      <div class="wrap hero-grid">
        <div>
          <p class="eyebrow">Peer tutoring for medical students</p>
          <h1>Learn from someone who <span style="color:var(--teal-600)">just aced it</span>.</h1>
          <p class="lead">MedMentor connects senior medical students who tutor with juniors who want to catch up, level up, or smash an exam — one focused session at a time.</p>
          <div class="hero-cta">
            <a class="btn btn-primary" href="#/tutors" data-link>Find a tutor →</a>
            <a class="btn btn-outline" href="#/become" data-link>Become a tutor</a>
          </div>
          <div class="hero-stats">
            <div class="stat"><strong>${tutors.length}</strong><span>Verified tutors</span></div>
            <div class="stat"><strong>${SUBJECTS.length}</strong><span>Subjects covered</span></div>
            <div class="stat"><strong>${avgRating}★</strong><span>Average rating</span></div>
          </div>
        </div>
        <div class="hero-card" aria-hidden="true">
          ${featured.map(t => `
            <div class="mini-tutor">
              <span class="avatar">${initials(t.name)}</span>
              <div class="mt-body">
                <div class="mt-name">${esc(t.name)}</div>
                <div class="mt-sub">${esc(t.subjects[0])} · ${esc(t.year)}</div>
              </div>
              <div class="mt-rate">${money(t.rate)}/h</div>
            </div>`).join('')}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <p class="eyebrow center">Why MedMentor</p>
        <h2 class="center">Built around how med school actually works</h2>
        <div class="grid cols-3" style="margin-top:2rem">
          ${[
            ['🎯','Subject-matched','Filter by anatomy, pharm, pathology, USMLE Step 1/2, OSCEs and more — find a tutor for exactly what you are stuck on.'],
            ['🩺','Recent experience','Your tutor sat the same exam a year or two ago. They know the traps, the high-yield, and the examiners.'],
            ['📅','Book in seconds','Pick a subject, choose a slot, add a note on what you want to cover. No back-and-forth emails.'],
            ['💸','Student-friendly','Peer rates, not private-agency rates. Most sessions are ' + money(12) + '–' + money(25) + ' an hour.'],
            ['⭐','Rated & reviewed','Every tutor carries real ratings from students they have helped. No guesswork.'],
            ['🔒','Yours, privately','This demo keeps everything in your browser — no tracking, no spam, no data leaving your machine.'],
          ].map(([i,t,d]) => `
            <div class="card feature-card">
              <div class="ficon">${i}</div>
              <h3>${t}</h3><p>${d}</p>
            </div>`).join('')}
        </div>
      </div>
    </section>

    <section class="section" style="background:#fff;border-top:1px solid var(--line);border-bottom:1px solid var(--line)">
      <div class="wrap">
        <h2 class="center">From stuck to sorted in three steps</h2>
        <div class="grid cols-3 steps" style="margin-top:2.4rem">
          <div class="step"><h3>Find your tutor</h3><p class="muted">Browse senior students by subject, year, language, and rating.</p></div>
          <div class="step"><h3>Book a session</h3><p class="muted">Choose a time and tell them what you want to focus on.</p></div>
          <div class="step"><h3>Learn & review</h3><p class="muted">Meet online, get unstuck, then rate the session to help others.</p></div>
        </div>
        <div class="center" style="margin-top:2rem">
          <a class="btn btn-primary" href="#/tutors" data-link>Browse tutors</a>
        </div>
      </div>
    </section>`;
  }

  // ============================================================
  // VIEW: Browse tutors (with filters — re-rendered in place)
  // ============================================================
  const browseState = { q:'', subject:'', year:'', sort:'rating' };

  function renderBrowse() {
    app.innerHTML = `
    <section class="section">
      <div class="wrap">
        <div class="browse-head">
          <div>
            <p class="eyebrow">Find a tutor</p>
            <h1 style="margin:0">Browse medical student tutors</h1>
          </div>
          <a class="btn btn-outline" href="#/become" data-link>Are you a senior student? Teach →</a>
        </div>
        <div class="filters">
          <input type="search" id="fQ" placeholder="Search name, subject, or keyword…" value="${esc(browseState.q)}" />
          <select id="fSubject">
            <option value="">All subjects</option>
            ${SUBJECTS.map(s => `<option ${browseState.subject===s?'selected':''}>${s}</option>`).join('')}
          </select>
          <select id="fYear">
            <option value="">Any year</option>
            ${YEARS.map(y => `<option ${browseState.year===y?'selected':''}>${y}</option>`).join('')}
          </select>
          <select id="fSort">
            <option value="rating" ${browseState.sort==='rating'?'selected':''}>Top rated</option>
            <option value="priceLow" ${browseState.sort==='priceLow'?'selected':''}>Price: low → high</option>
            <option value="priceHigh" ${browseState.sort==='priceHigh'?'selected':''}>Price: high → low</option>
          </select>
        </div>
        <div id="tutorResults"></div>
      </div>
    </section>`;

    const refresh = () => { document.getElementById('tutorResults').innerHTML = tutorResultsHTML(); };
    const q = document.getElementById('fQ');
    q.addEventListener('input', () => { browseState.q = q.value; refresh(); });
    document.getElementById('fSubject').addEventListener('change', e => { browseState.subject = e.target.value; refresh(); });
    document.getElementById('fYear').addEventListener('change', e => { browseState.year = e.target.value; refresh(); });
    document.getElementById('fSort').addEventListener('change', e => { browseState.sort = e.target.value; refresh(); });
    refresh();
  }

  function tutorResultsHTML() {
    let list = getTutors().slice();
    const q = browseState.q.trim().toLowerCase();
    if (q) list = list.filter(t =>
      (t.name + ' ' + t.bio + ' ' + t.subjects.join(' ') + ' ' + (t.school||'')).toLowerCase().includes(q));
    if (browseState.subject) list = list.filter(t => t.subjects.includes(browseState.subject));
    if (browseState.year) list = list.filter(t => t.year === browseState.year);
    if (browseState.sort === 'rating') list.sort((a, b) => b.rating - a.rating);
    if (browseState.sort === 'priceLow') list.sort((a, b) => a.rate - b.rate);
    if (browseState.sort === 'priceHigh') list.sort((a, b) => b.rate - a.rate);

    if (!list.length) return `<div class="empty-state"><h3>No tutors match yet</h3><p>Try clearing a filter — or be the first to teach this subject.</p><a class="btn btn-primary" href="#/become" data-link>Become a tutor</a></div>`;

    return `<p class="muted" style="margin-bottom:1rem">${list.length} tutor${list.length>1?'s':''} available</p>
      <div class="tutor-grid">
        ${list.map(t => `
          <article class="card tutor-card" data-go="#/tutor/${t.id}">
            <div class="tc-head">
              <span class="avatar">${initials(t.name)}</span>
              <div>
                <div class="tc-name">${esc(t.name)}</div>
                <div class="tc-year">${esc(t.year)}${t.school?' · '+esc(t.school):''}</div>
              </div>
            </div>
            <p class="tc-bio">${esc(t.bio.slice(0, 110))}${t.bio.length>110?'…':''}</p>
            <div class="tags">${t.subjects.slice(0,3).map(s => `<span class="tag">${esc(s)}</span>`).join('')}</div>
            <div class="tc-foot">
              <span class="rating"><span class="star">★</span> ${t.rating.toFixed(1)} <small>(${t.reviews})</small></span>
              <span class="rate-tag">${money(t.rate)}/h</span>
            </div>
          </article>`).join('')}
      </div>`;
  }

  // ============================================================
  // VIEW: Tutor profile + booking
  // ============================================================
  function viewProfile(id) {
    const t = getTutors().find(x => x.id === id);
    if (!t) return `<section class="section"><div class="wrap empty-state"><h2>Tutor not found</h2><a class="btn btn-primary" href="#/tutors" data-link>Back to browse</a></div></section>`;
    const reviews = t.reviewsList || [];
    return `
    <section class="section">
      <div class="wrap">
        <a href="#/tutors" data-link class="muted">← All tutors</a>
        <div class="profile-grid" style="margin-top:1rem">
          <div>
            <div class="profile-head">
              <span class="avatar">${initials(t.name)}</span>
              <div>
                <h1>${esc(t.name)}</h1>
                <p class="muted" style="margin:0">${esc(t.year)}${t.school?' · '+esc(t.school):''}</p>
                <p style="margin:.3rem 0 0"><span class="rating"><span class="star">${stars(t.rating)}</span> ${t.rating.toFixed(1)} <small>(${t.reviews} review${t.reviews!==1?'s':''})</small></span></p>
              </div>
            </div>
            <p>${esc(t.bio)}</p>

            <h3 class="section-title">Subjects</h3>
            <div class="tags">${t.subjects.map(s => `<span class="tag">${esc(s)}</span>`).join('')}</div>

            ${t.languages && t.languages.length ? `
            <h3 class="section-title">Languages</h3>
            <div class="tags">${t.languages.map(l => `<span class="tag" style="background:#eef0fb;color:var(--indigo)">${esc(l)}</span>`).join('')}</div>` : ''}

            ${t.avail && t.avail.length ? `
            <h3 class="section-title">Typical availability</h3>
            <div class="avail-grid">${t.avail.map(a => `<span class="avail-slot">${esc(a)}</span>`).join('')}</div>` : ''}

            <h3 class="section-title">Reviews</h3>
            ${reviews.length ? reviews.map(r => `
              <div class="review">
                <div class="rv-head"><span class="rv-name">${esc(r.name)}</span><span class="star">${stars(r.stars)}</span></div>
                <p style="margin:.3rem 0 0">${esc(r.text)}</p>
              </div>`).join('') : '<p class="muted">No reviews yet — be the first.</p>'}
          </div>

          <aside>
            <div class="card booking-panel">
              <h3>Book a session</h3>
              <p class="muted" style="margin-top:-.4rem">${money(t.rate)} / hour</p>
              <form id="bookForm">
                <label class="field">Subject
                  <select id="bSubject">${t.subjects.map(s => `<option>${esc(s)}</option>`).join('')}</select>
                </label>
                <label class="field">Date & time
                  <input type="datetime-local" id="bWhen" value="${defaultSlot()}" />
                </label>
                <label class="field">Length
                  <select id="bLen">
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="120">120 minutes</option>
                  </select>
                </label>
                <label class="field">Format
                  <select id="bMode"><option>Online (video)</option><option>In person</option></select>
                </label>
                <label class="field">What do you want to cover?
                  <textarea id="bNote" placeholder="e.g. Renal physiology — clearance & acid-base, struggling with compensation."></textarea>
                </label>
                <div class="price-row"><span>Estimated total</span><span id="bTotal">${money(t.rate)}</span></div>
                <button class="btn btn-primary btn-block" type="submit">Request session</button>
                <p class="fine">You can cancel any time from your dashboard.</p>
              </form>
            </div>
          </aside>
        </div>
      </div>
    </section>`;
  }

  function afterProfile(id) {
    const t = getTutors().find(x => x.id === id);
    if (!t) return;
    const form = document.getElementById('bookForm');
    if (!form) return;
    const lenSel = document.getElementById('bLen');
    const total = document.getElementById('bTotal');
    const recalc = () => { total.textContent = money(t.rate * (Number(lenSel.value) / 60)); };
    lenSel.addEventListener('change', recalc); recalc();

    form.addEventListener('submit', e => {
      e.preventDefault();
      const sess = getSession();
      if (!sess) { window.MedAuth.openAuth('signup'); toast('Create an account to book'); return; }
      if (sess.role === 'tutor') { toast('Switch to a student account to book sessions'); return; }
      const whenVal = document.getElementById('bWhen').value;
      if (!whenVal) { toast('Please pick a date & time'); return; }
      const when = new Date(whenVal);
      if (when.getTime() < Date.now()) { toast('Pick a time in the future'); return; }
      const len = Number(lenSel.value);
      const booking = {
        id: uid('b'), tutorId: t.id, tutorName: t.name,
        studentId: sess.id, studentName: sess.name, studentEmail: sess.email,
        subject: document.getElementById('bSubject').value,
        when: when.toISOString(), durationMin: len,
        mode: document.getElementById('bMode').value,
        note: document.getElementById('bNote').value.trim(),
        price: t.rate * (len / 60),
        // Demo tutors auto-confirm; real tutor accounts get a pending request.
        status: t.accountId ? 'pending' : 'confirmed',
        createdAt: Date.now()
      };
      const all = getBookings(); all.push(booking); setBookings(all);
      toast(booking.status === 'confirmed' ? 'Session booked! 🎉' : 'Request sent to tutor');
      location.hash = '#/dashboard';
    });
  }

  // ============================================================
  // VIEW: Become a tutor (create / edit profile)
  // ============================================================
  function viewBecome() {
    const sess = getSession();
    if (!sess) {
      return `<section class="section"><div class="wrap form-wide center">
        <p class="eyebrow">Become a tutor</p>
        <h1>Share what you know. Get paid for it.</h1>
        <p class="lead muted" style="margin:0 auto 1.4rem">Senior students earn flexible income tutoring juniors in the subjects they have already mastered. Create an account to set up your profile.</p>
        <button class="btn btn-primary" data-auth="open" data-tab="signup">Create a tutor account</button>
      </div></section>`;
    }
    const existing = getTutors().find(t => t.accountId === sess.id);
    const t = existing || { name: sess.name, year:'Year 4', school:'', rate:15, subjects:[], languages:['English'], bio:'', avail:[] };
    return `
    <section class="section">
      <div class="wrap form-wide">
        <p class="eyebrow">${existing ? 'Edit your tutor profile' : 'Become a tutor'}</p>
        <h1>${existing ? 'Your tutor profile' : 'Set up your tutor profile'}</h1>
        <p class="muted">${existing ? 'Update your details — students see this instantly.' : 'Tell juniors who you are and what you can teach. You can edit this any time.'}</p>
        <form id="tutorForm" class="card" style="margin-top:1.2rem">
          <div class="form-row">
            <label class="field">Display name
              <input id="tName" value="${esc(t.name)}" placeholder="Your name" />
            </label>
            <label class="field">School / university
              <input id="tSchool" value="${esc(t.school||'')}" placeholder="e.g. Cairo University" />
            </label>
          </div>
          <div class="form-row">
            <label class="field">Year of study
              <select id="tYear">${YEARS.map(y => `<option ${t.year===y?'selected':''}>${y}</option>`).join('')}</select>
            </label>
            <label class="field">Rate (£ / hour)
              <input id="tRate" type="number" min="0" max="200" value="${esc(t.rate)}" />
            </label>
          </div>
          <label class="field">Short bio
            <textarea id="tBio" placeholder="Your teaching style, exam scores, what students can expect…">${esc(t.bio||'')}</textarea>
          </label>
          <label class="field">Languages (comma separated)
            <input id="tLangs" value="${esc((t.languages||[]).join(', '))}" placeholder="English, Arabic" />
          </label>
          <p class="field" style="margin-bottom:.4rem">Subjects you can tutor</p>
          <div class="checks" id="tSubjects">
            ${SUBJECTS.map(s => `<label class="check"><input type="checkbox" value="${esc(s)}" ${t.subjects.includes(s)?'checked':''}/> ${esc(s)}</label>`).join('')}
          </div>
          <label class="field" style="margin-top:1rem">Typical availability (comma separated)
            <input id="tAvail" value="${esc((t.avail||[]).join(', '))}" placeholder="Mon eve, Wed eve, Sat AM" />
          </label>
          <p class="form-error" id="tError"></p>
          <div style="display:flex;gap:.6rem;flex-wrap:wrap">
            <button class="btn btn-primary" type="submit">${existing ? 'Save changes' : 'Publish my profile'}</button>
            ${existing ? `<a class="btn btn-outline" href="#/tutor/${existing.id}" data-link>View public profile</a>` : ''}
          </div>
        </form>
      </div>
    </section>`;
  }

  function afterBecome() {
    const form = document.getElementById('tutorForm');
    if (!form) return;
    const sess = getSession();
    form.addEventListener('submit', e => {
      e.preventDefault();
      const err = document.getElementById('tError');
      err.textContent = '';
      const name = document.getElementById('tName').value.trim();
      const bio  = document.getElementById('tBio').value.trim();
      const subjects = [...document.querySelectorAll('#tSubjects input:checked')].map(c => c.value);
      if (name.length < 2) return err.textContent = 'Please enter your name.';
      if (!subjects.length) return err.textContent = 'Pick at least one subject you can tutor.';
      if (bio.length < 20) return err.textContent = 'Please write a short bio (at least 20 characters).';

      const tutors = getTutors();
      const idx = tutors.findIndex(t => t.accountId === sess.id);
      const data = {
        accountId: sess.id,
        name,
        school: document.getElementById('tSchool').value.trim(),
        year: document.getElementById('tYear').value,
        rate: Math.max(0, Number(document.getElementById('tRate').value) || 0),
        bio,
        languages: document.getElementById('tLangs').value.split(',').map(s => s.trim()).filter(Boolean),
        avail: document.getElementById('tAvail').value.split(',').map(s => s.trim()).filter(Boolean),
        subjects,
      };
      if (idx >= 0) {
        tutors[idx] = { ...tutors[idx], ...data };
        toast('Profile updated');
      } else {
        tutors.push({ id: uid('t'), createdAt: Date.now(), rating: 5.0, reviews: 0, reviewsList: [], ...data });
        toast('Your profile is live! 🎉');
      }
      setTutors(tutors);
      const saved = tutors.find(t => t.accountId === sess.id);
      location.hash = '#/tutor/' + saved.id;
    });
  }

  // ============================================================
  // VIEW: How it works
  // ============================================================
  function viewHow() {
    return `
    <section class="section">
      <div class="wrap form-wide">
        <p class="eyebrow center">How it works</p>
        <h1 class="center">Simple for students. Rewarding for tutors.</h1>

        <h2 class="section-title" style="margin-top:2rem">For students</h2>
        <div class="grid steps stack">
          <div class="step"><h3>Browse & filter</h3><p class="muted">Search by subject, year, language, price, or rating to find someone who fits exactly what you need.</p></div>
          <div class="step"><h3>Request a session</h3><p class="muted">Pick a time, length, and format, then write a note on what you want to cover so your tutor comes prepared.</p></div>
          <div class="step"><h3>Meet & learn</h3><p class="muted">Connect online or in person. Afterwards, leave a rating to help the next student.</p></div>
        </div>

        <h2 class="section-title" style="margin-top:2.4rem">For tutors</h2>
        <div class="grid steps stack">
          <div class="step"><h3>Create a profile</h3><p class="muted">List your subjects, year, languages, availability, and rate. It is live the moment you publish.</p></div>
          <div class="step"><h3>Get requests</h3><p class="muted">Students book the slots that suit them. Accept the ones you want from your dashboard.</p></div>
          <div class="step"><h3>Teach & grow</h3><p class="muted">Run your session, mark it complete, and build a reputation from genuine reviews.</p></div>
        </div>

        <div class="center" style="margin-top:2.2rem;display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap">
          <a class="btn btn-primary" href="#/tutors" data-link>Find a tutor</a>
          <a class="btn btn-outline" href="#/become" data-link>Become a tutor</a>
        </div>

        <h2 class="section-title" style="margin-top:2.6rem">A quick note</h2>
        <p class="muted">MedMentor is a demo. Accounts, profiles, and bookings live only in your browser's local storage — nothing is sent to a server, there are no real payments, and sessions are peer study support, not medical advice.</p>
      </div>
    </section>`;
  }

  // ============================================================
  // VIEW: Dashboard
  // ============================================================
  let dashTab = 'upcoming';

  function viewDashboard() {
    const sess = getSession();
    if (!sess) {
      return `<section class="section"><div class="wrap empty-state">
        <h2>Please log in</h2><p>Your dashboard shows your sessions and profile.</p>
        <button class="btn btn-primary" data-auth="open" data-tab="login">Log in</button>
      </div></section>`;
    }
    const isTutor = sess.role === 'tutor';
    const myTutor = isTutor ? getTutors().find(t => t.accountId === sess.id) : null;
    return `
    <section class="section">
      <div class="wrap">
        <div class="dash-head">
          <div>
            <p class="eyebrow">${isTutor ? 'Tutor dashboard' : 'Student dashboard'}</p>
            <h1 style="margin:0">Hi ${esc((sess.name||'').split(' ')[0] || 'there')} 👋</h1>
          </div>
          ${isTutor
            ? `<a class="btn btn-outline" href="#/become" data-link>${myTutor ? 'Edit profile' : 'Set up tutor profile'}</a>`
            : `<a class="btn btn-primary" href="#/tutors" data-link>Find a tutor</a>`}
        </div>
        <div id="dashStats"></div>
        <div class="tabs" id="dashTabs">
          <button class="tab ${dashTab==='upcoming'?'active':''}" data-tab="upcoming">Upcoming</button>
          <button class="tab ${dashTab==='past'?'active':''}" data-tab="past">Past</button>
          ${isTutor && !myTutor ? '' : ''}
        </div>
        <div id="dashBody"></div>
      </div>
    </section>`;
  }

  function afterDashboard() {
    const sess = getSession();
    if (!sess) return;
    const tabsEl = document.getElementById('dashTabs');
    if (tabsEl) tabsEl.addEventListener('click', e => {
      const b = e.target.closest('.tab'); if (!b) return;
      dashTab = b.dataset.tab;
      tabsEl.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === b));
      renderDashBody();
    });
    renderDashStats();
    renderDashBody();
  }

  function myBookings(sess) {
    const isTutor = sess.role === 'tutor';
    const myTutorIds = getTutors().filter(t => t.accountId === sess.id).map(t => t.id);
    return getBookings().filter(b => isTutor ? myTutorIds.includes(b.tutorId) : b.studentId === sess.id);
  }

  function renderDashStats() {
    const sess = getSession();
    const isTutor = sess.role === 'tutor';
    const mine = myBookings(sess);
    const upcoming = mine.filter(b => new Date(b.when) >= new Date() && b.status !== 'cancelled').length;
    const completed = mine.filter(b => b.status === 'completed').length;
    const hours = mine.filter(b => b.status !== 'cancelled').reduce((s, b) => s + b.durationMin / 60, 0);
    const tiles = isTutor
      ? [[upcoming,'Upcoming sessions'],[completed,'Sessions taught'],['£'+mine.filter(b=>b.status!=='cancelled').reduce((s,b)=>s+(b.price||0),0).toFixed(0),'Booked earnings']]
      : [[upcoming,'Upcoming sessions'],[completed,'Sessions completed'],[hours.toFixed(1)+'h','Total learning time']];
    document.getElementById('dashStats').innerHTML = `<div class="stat-tiles">
      ${tiles.map(([v,l]) => `<div class="stat-tile"><strong>${v}</strong><span>${l}</span></div>`).join('')}
    </div>`;
  }

  function renderDashBody() {
    const sess = getSession();
    const body = document.getElementById('dashBody');
    if (!body) return;
    const isTutor = sess.role === 'tutor';
    const now = new Date();
    let mine = myBookings(sess).sort((a, b) => new Date(a.when) - new Date(b.when));
    if (dashTab === 'upcoming') mine = mine.filter(b => new Date(b.when) >= now && b.status !== 'cancelled' && b.status !== 'completed');
    else mine = mine.filter(b => new Date(b.when) < now || b.status === 'cancelled' || b.status === 'completed').reverse();

    if (!mine.length) {
      body.innerHTML = `<div class="empty-state">
        <h3>${dashTab === 'upcoming' ? 'No upcoming sessions' : 'Nothing here yet'}</h3>
        <p>${isTutor ? 'When students book you, sessions appear here.' : 'Find a tutor and book your first session.'}</p>
        ${isTutor ? '' : '<a class="btn btn-primary" href="#/tutors" data-link>Browse tutors</a>'}
      </div>`;
      return;
    }

    body.innerHTML = mine.map(b => {
      const other = isTutor ? b.studentName : b.tutorName;
      const future = new Date(b.when) >= now;
      return `<div class="session-row">
        <div class="when"><div class="d">${dayNum(b.when)}</div><div class="m">${monShort(b.when)}</div></div>
        <div class="s-body">
          <strong>${esc(b.subject)} <span class="status ${b.status}">${b.status}</span></strong>
          <small>${esc(other)} · ${fmtDate(b.when)}, ${fmtTime(b.when)} · ${b.durationMin} min · ${esc(b.mode)}</small>
          ${b.note ? `<small style="display:block;margin-top:.3rem">📝 ${esc(b.note)}</small>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:.4rem">
          ${actionsFor(b, isTutor, future)}
        </div>
      </div>`;
    }).join('');

    body.querySelectorAll('[data-action]').forEach(btn =>
      btn.addEventListener('click', () => handleBookingAction(btn.dataset.id, btn.dataset.action)));
  }

  function actionsFor(b, isTutor, future) {
    const btns = [];
    if (isTutor && b.status === 'pending') {
      btns.push(`<button class="btn btn-primary btn-sm" data-action="confirm" data-id="${b.id}">Accept</button>`);
      btns.push(`<button class="btn btn-danger btn-sm" data-action="decline" data-id="${b.id}">Decline</button>`);
    }
    if (b.status === 'confirmed' && !future) {
      btns.push(`<button class="btn btn-outline btn-sm" data-action="complete" data-id="${b.id}">Mark complete</button>`);
    }
    if ((b.status === 'confirmed' || b.status === 'pending') && future) {
      btns.push(`<button class="btn btn-danger btn-sm" data-action="cancel" data-id="${b.id}">Cancel</button>`);
    }
    return btns.join('');
  }

  function handleBookingAction(id, action) {
    const all = getBookings();
    const b = all.find(x => x.id === id);
    if (!b) return;
    const map = { confirm:'confirmed', decline:'cancelled', cancel:'cancelled', complete:'completed' };
    if (action === 'cancel' && !confirm('Cancel this session?')) return;
    b.status = map[action] || b.status;
    setBookings(all);
    toast(action === 'complete' ? 'Marked complete' : action === 'confirm' ? 'Session confirmed' : 'Session ' + b.status);
    renderDashStats();
    renderDashBody();
  }

  // ============================================================
  // Global click handling for SPA links + tutor cards
  // ============================================================
  document.addEventListener('click', e => {
    const card = e.target.closest('[data-go]');
    if (card && !e.target.closest('a,button')) { location.hash = card.dataset.go; }
  });

  // ---------- Boot ----------
  seed();
  window.addEventListener('hashchange', render);
  window.addEventListener('medmentor:auth', render);
  if (!location.hash) location.hash = '#/';
  render();
})();
