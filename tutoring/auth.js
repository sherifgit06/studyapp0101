/* MedMentor — local-only auth.
   Role-aware (student | tutor). Same shape as a future backend would expose:
   getSession / setSession / clearSession are the seam to swap in a real API. */

(() => {
  'use strict';

  const SESSION_KEY  = 'medmentor.session';
  const ACCOUNTS_KEY = 'medmentor.accounts';

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || fallback); }
    catch { return JSON.parse(fallback); }
  }
  const getSession  = () => read(SESSION_KEY, 'null');
  const setSession  = (s) => localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  const clearSession = () => localStorage.removeItem(SESSION_KEY);
  const getAccounts = () => read(ACCOUNTS_KEY, '[]');
  const setAccounts = (a) => localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a));

  async function hashPassword(pw) {
    try {
      const buf = new TextEncoder().encode('medmentor:' + pw);
      const h = await crypto.subtle.digest('SHA-256', buf);
      return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      let h = 5381;
      for (let i = 0; i < pw.length; i++) h = ((h << 5) + h + pw.charCodeAt(i)) | 0;
      return 'plain-' + h;
    }
  }

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // Expose for app.js
  window.MedAuth = { getSession, setSession, clearSession, getAccounts, setAccounts, uid };

  // ---------- Header wiring (runs on every page) ----------
  document.addEventListener('DOMContentLoaded', () => {
    refreshHeader();
    wireModal();
  });

  function refreshHeader() {
    const sess = getSession();
    const pill = document.getElementById('userPill');
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    if (!pill) return;
    if (sess) {
      pill.hidden = false;
      loginBtn.hidden = true;
      signupBtn.hidden = true;
      const display = sess.name || (sess.email || '').split('@')[0] || 'Member';
      document.getElementById('userName').textContent = display;
      document.getElementById('userRole').textContent = sess.role || 'member';
      document.getElementById('userAvatar').textContent = (display.trim()[0] || 'M').toUpperCase();
    } else {
      pill.hidden = true;
      loginBtn.hidden = false;
      signupBtn.hidden = false;
    }
    const logout = document.getElementById('logoutBtn');
    if (logout && !logout.dataset.wired) {
      logout.dataset.wired = '1';
      logout.addEventListener('click', () => {
        clearSession();
        refreshHeader();
        location.hash = '#/';
        toast('Logged out');
      });
    }
  }
  window.MedAuth.refreshHeader = refreshHeader;

  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.hidden = true, 250); }, 2400);
  }
  window.MedAuth.toast = toast;

  // ---------- Auth modal ----------
  function wireModal() {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    const tabSignup = document.getElementById('tabSignup');
    const tabLogin  = document.getElementById('tabLogin');
    const formSignup = document.getElementById('signupForm');
    const formLogin  = document.getElementById('loginForm');
    const errSignup  = document.getElementById('signupError');
    const errLogin   = document.getElementById('loginError');
    const roleToggle = document.getElementById('roleToggle');

    function open(tab = 'signup') {
      modal.hidden = false;
      switchTab(tab);
      setTimeout(() => {
        const f = (tab === 'login' ? formLogin : formSignup).querySelector('input:not([type=radio])');
        f && f.focus();
      }, 30);
    }
    function close() { modal.hidden = true; }
    window.MedAuth.openAuth = open;

    function switchTab(tab) {
      const s = tab === 'signup';
      tabSignup.classList.toggle('active', s);
      tabLogin.classList.toggle('active', !s);
      formSignup.hidden = !s;
      formLogin.hidden = s;
      errSignup.textContent = ''; errLogin.textContent = '';
    }

    // Open triggers (delegated so dynamically-rendered buttons work too)
    document.addEventListener('click', e => {
      const opener = e.target.closest('[data-auth="open"]');
      if (opener) { e.preventDefault(); open(opener.dataset.tab || 'signup'); }
    });

    tabSignup.addEventListener('click', () => switchTab('signup'));
    tabLogin.addEventListener('click', () => switchTab('login'));
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.querySelectorAll('[data-close-auth]').forEach(b => b.addEventListener('click', close));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    // Role toggle visual state
    roleToggle && roleToggle.addEventListener('change', () => {
      roleToggle.querySelectorAll('.role-opt').forEach(o =>
        o.classList.toggle('selected', o.querySelector('input').checked));
    });

    formSignup.addEventListener('submit', async e => {
      e.preventDefault();
      errSignup.textContent = '';
      const name = (document.getElementById('signupName').value || '').trim();
      const email = (document.getElementById('signupEmail').value || '').trim().toLowerCase();
      const pw = document.getElementById('signupPassword').value || '';
      const role = (roleToggle.querySelector('input:checked') || {}).value || 'student';
      if (name.length < 2) return errSignup.textContent = 'Please enter your name.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errSignup.textContent = 'Enter a valid email.';
      if (pw.length < 6) return errSignup.textContent = 'Password must be at least 6 characters.';
      const accts = getAccounts();
      if (accts.some(a => a.email === email)) return errSignup.textContent = 'Email already registered — try logging in.';
      const passwordHash = await hashPassword(pw);
      const acct = { id: uid('u'), name, email, passwordHash, role, createdAt: Date.now() };
      accts.push(acct); setAccounts(accts);
      setSession({ id: acct.id, name, email, role, loggedInAt: Date.now() });
      finish(role, true);
    });

    formLogin.addEventListener('submit', async e => {
      e.preventDefault();
      errLogin.textContent = '';
      const email = (document.getElementById('loginEmail').value || '').trim().toLowerCase();
      const pw = document.getElementById('loginPassword').value || '';
      const accts = getAccounts();
      const acct = accts.find(a => a.email === email);
      if (!acct) return errLogin.textContent = 'No account found. Try signing up.';
      const ok = (await hashPassword(pw)) === acct.passwordHash;
      if (!ok) return errLogin.textContent = 'Wrong password.';
      setSession({ id: acct.id, name: acct.name, email: acct.email, role: acct.role, loggedInAt: Date.now() });
      finish(acct.role, false);
    });

    function finish(role, isNew) {
      close();
      refreshHeader();
      toast(isNew ? 'Welcome to MedMentor!' : 'Welcome back!');
      // Tutors land on their profile editor; students head to browse.
      location.hash = role === 'tutor' ? '#/become' : '#/tutors';
      window.dispatchEvent(new CustomEvent('medmentor:auth'));
    }
  }
})();
