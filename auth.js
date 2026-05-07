/* Study Medicus — local-only auth shim.
   Handles signup, login, session, and the app/landing page bridge.
   This is a placeholder for the future backend: same shape, different storage. */

(() => {
  'use strict';

  const SESSION_KEY  = 'medpomo.session';
  const ACCOUNTS_KEY = 'medpomo.accounts';

  // ---------- Session storage ----------
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  }
  function setSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  function getAccounts() {
    try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]'); }
    catch { return []; }
  }
  function setAccounts(arr) { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(arr)); }

  async function hashPassword(pw) {
    try {
      const buf = new TextEncoder().encode('medpomo:' + pw);
      const h = await crypto.subtle.digest('SHA-256', buf);
      return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      let h = 5381;
      for (let i = 0; i < pw.length; i++) h = ((h << 5) + h + pw.charCodeAt(i)) | 0;
      return 'plain-' + h;
    }
  }

  // Public helpers (used by app.js too)
  window.MedAuth = { getSession, setSession, clearSession };

  // ---------- Page detection ----------
  const isAppPage = /(^|\/)app\.html$/.test(location.pathname);

  if (isAppPage) {
    // Gate the app: if no session, bounce to landing.
    if (!getSession()) {
      const target = location.pathname.replace(/app\.html$/, '') || './';
      location.replace(target);
      return;
    }
    document.addEventListener('DOMContentLoaded', wireAppHeader);
  } else {
    document.addEventListener('DOMContentLoaded', initLanding);
  }

  // ---------- App-side: header user pill + logout ----------
  function wireAppHeader() {
    const sess = getSession();
    const pill = document.getElementById('userPill');
    const name = document.getElementById('userName');
    const avatar = document.getElementById('userAvatar');
    if (pill && sess) {
      pill.hidden = false;
      const display = sess.name || (sess.email || '').split('@')[0] || 'Student';
      name.textContent = display;
      avatar.textContent = (display.trim()[0] || 'M').toUpperCase();
    }
    const logout = document.getElementById('logoutBtn');
    if (logout) logout.addEventListener('click', () => {
      if (!confirm('Sign out? Your study data stays in this browser.')) return;
      clearSession();
      const target = location.pathname.replace(/app\.html$/, '') || './';
      location.replace(target);
    });
  }

  // ---------- Landing-side: auth modal, signup, login ----------
  function initLanding() {
    const modal = document.getElementById('authModal');
    if (!modal) return;

    const tabSignup = document.getElementById('tabSignup');
    const tabLogin  = document.getElementById('tabLogin');
    const formSignup = document.getElementById('signupForm');
    const formLogin  = document.getElementById('loginForm');
    const errSignup  = document.getElementById('signupError');
    const errLogin   = document.getElementById('loginError');

    const session = getSession();
    if (session) {
      // Already logged in — change CTAs to "Continue"
      document.querySelectorAll('[data-auth="open"]').forEach(b => {
        b.textContent = 'Continue to app →';
        b.dataset.action = 'continue';
      });
      const w = document.getElementById('welcomeBack');
      if (w) {
        w.hidden = false;
        const display = session.name || (session.email || '').split('@')[0] || 'Student';
        w.querySelector('[data-name]').textContent = display;
      }
    }

    function openModal(tab = 'signup') {
      modal.hidden = false;
      switchTab(tab);
      setTimeout(() => {
        const first = (tab === 'login' ? formLogin : formSignup).querySelector('input');
        first && first.focus();
      }, 30);
    }
    function closeModal() { modal.hidden = true; }

    function switchTab(tab) {
      const isSignup = tab === 'signup';
      tabSignup.classList.toggle('active', isSignup);
      tabLogin.classList.toggle('active', !isSignup);
      formSignup.hidden = !isSignup;
      formLogin.hidden  =  isSignup;
      errSignup.textContent = '';
      errLogin.textContent  = '';
    }

    // CTA buttons that open auth or jump to app
    document.querySelectorAll('[data-auth]').forEach(b => {
      b.addEventListener('click', e => {
        e.preventDefault();
        if (b.dataset.action === 'continue') {
          location.href = 'app.html';
        } else if (b.dataset.auth === 'open') {
          openModal(b.dataset.tab || 'signup');
        }
      });
    });

    // Tabs inside modal
    tabSignup.addEventListener('click', () => switchTab('signup'));
    tabLogin .addEventListener('click', () => switchTab('login'));

    // Close handlers
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    document.querySelectorAll('[data-close-auth]').forEach(b =>
      b.addEventListener('click', closeModal));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    // Submit: sign up
    formSignup.addEventListener('submit', async e => {
      e.preventDefault();
      errSignup.textContent = '';
      const name = (document.getElementById('signupName').value || '').trim();
      const email = (document.getElementById('signupEmail').value || '').trim().toLowerCase();
      const pw = document.getElementById('signupPassword').value || '';
      if (name.length < 2)        return errSignup.textContent = 'Please enter your name.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                                  return errSignup.textContent = 'Please enter a valid email.';
      if (pw.length < 6)          return errSignup.textContent = 'Password must be at least 6 characters.';

      const accts = getAccounts();
      if (accts.some(a => a.email === email)) {
        return errSignup.textContent = 'An account with this email already exists. Try signing in.';
      }
      const passwordHash = await hashPassword(pw);
      const acct = { id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
                     name, email, passwordHash, createdAt: Date.now() };
      accts.push(acct);
      setAccounts(accts);
      setSession({ id: acct.id, name, email, loggedInAt: Date.now() });
      goToApp();
    });

    // Submit: log in
    formLogin.addEventListener('submit', async e => {
      e.preventDefault();
      errLogin.textContent = '';
      const email = (document.getElementById('loginEmail').value || '').trim().toLowerCase();
      const pw = document.getElementById('loginPassword').value || '';
      const accts = getAccounts();
      const acct = accts.find(a => a.email === email);
      if (!acct) {
        // For demo convenience: if no account exists yet, allow blind login as a guest
        // so the user can experience the flow without signing up.
        if (accts.length === 0) {
          setSession({ id: 'guest', name: email.split('@')[0] || 'Student', email, loggedInAt: Date.now() });
          return goToApp();
        }
        return errLogin.textContent = 'No account found. Try signing up.';
      }
      const ok = (await hashPassword(pw)) === acct.passwordHash;
      if (!ok) return errLogin.textContent = 'Wrong password.';
      setSession({ id: acct.id, name: acct.name, email: acct.email, loggedInAt: Date.now() });
      goToApp();
    });

    function goToApp() {
      // Smooth transition feel
      modal.hidden = true;
      document.body.style.transition = 'opacity 0.2s ease';
      document.body.style.opacity = '0';
      setTimeout(() => { location.href = 'app.html'; }, 180);
    }
  }
})();
