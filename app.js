// Legendary Pay web app. Plain JavaScript, no build step.
const API = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || '';
const $app = document.getElementById('app');
const $toast = document.getElementById('toast');

const PROTECTED = ['home', 'send', 'deposit', 'history', 'verify', 'verify-email'];
const TX_LABELS = {
  deposit: 'Deposit',
  internal_transfer: 'Wallet transfer',
  bank_transfer: 'Bank transfer',
  refund: 'Refund',
  cashback: 'Cashback',
  bonus: 'Bonus',
  referral: 'Referral bonus',
};

const state = {
  screen: 'login',
  authMode: 'login',     // login | signup | forgot | reset
  resetEmail: '',
  wallet: null,
  history: null,
  rewards: null,
  banks: null,
  bankFeeKobo: 0,
  sendType: 'wallet',    // wallet | bank
  idem: newId(),
};

// ---------- helpers ----------
function newId() {
  return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'k' + Date.now() + Math.random().toString(16).slice(2);
}
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const naira = (k) => '₦' + (Number(k || 0) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (name) => (name || 'LP').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => $toast.classList.remove('show'), 3000);
}

function toKobo(v) {
  const n = Number(String(v).replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n < 10 || n > 500000) throw new Error('Enter an amount between ₦10 and ₦500,000');
  return Math.round(n * 100);
}

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'content-type': 'application/json' };
  const token = store.get('lp_token');
  if (auth && token) headers.authorization = 'Bearer ' + token;
  let r;
  try {
    r = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Cannot reach the server. Check your internet and try again.');
  }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && j.error === 'Unauthorized' && auth) {
    logout();
    throw new Error('Your session has ended. Please log in again.');
  }
  if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.');
  return j;
}

async function loadWallet() {
  state.wallet = await api('/wallet');
  return state.wallet;
}

function logout() {
  store.del('lp_token');
  state.wallet = null;
  state.history = null;
  state.rewards = null;
  state.authMode = 'login';
  navigate('login');
}

// ---------- navigation ----------
async function navigate(screen) {
  if (PROTECTED.includes(screen) && !store.get('lp_token')) screen = 'login';
  state.screen = screen;

  if (PROTECTED.includes(screen) && !state.wallet) {
    try { await loadWallet(); } catch (e) { toast(e.message); }
  }
  if (screen === 'home') {
    api('/rewards').then((r) => { state.rewards = r; render(); }).catch(() => {});
  }
  if (screen === 'history') {
    try { state.history = await api('/wallet/history'); } catch (e) { toast(e.message); state.history = []; }
  }
  if (screen === 'send') {
    state.idem = newId();
    if (!state.banks) {
      try {
        const b = await api('/banks', { auth: false });
        state.banks = b.banks;
        state.bankFeeKobo = b.bankFeeKobo;
      } catch { state.banks = []; }
    }
  }
  render();
}

function nextScreen() {
  const w = state.wallet;
  if (!w.email_verified) return 'verify-email';
  return w.kyc_verified ? 'home' : 'verify';
}

function render() {
  $app.innerHTML = view();
  window.scrollTo(0, 0);
}

function view() {
  switch (state.screen) {
    case 'login': return authView();
    case 'verify': return verifyView();
    case 'verify-email': return verifyEmailView();
    case 'home': return homeView();
    case 'send': return sendView();
    case 'deposit': return depositView();
    case 'history': return historyView();
    default: return authView();
  }
}

function nav(active) {
  const item = (id, ico, label) =>
    `<button data-go="${id}" class="${active === id ? 'on' : ''}"><span class="ico">${ico}</span>${label}</button>`;
  return `<nav class="nav">
    ${item('home', '🏠', 'Home')}
    ${item('send', '↗', 'Send')}
    ${item('deposit', '↙', 'Deposit')}
    ${item('history', '🧾', 'History')}
  </nav>`;
}

function brand() {
  return `<div class="brand">
    <img src="logo.jpg" alt="Legendary Pay logo">
    <h1>Legendary Pay</h1>
    <p>Send, receive and save in naira</p>
  </div>`;
}

// ---------- screens ----------
function authView() {
  const m = state.authMode;
  if (m === 'forgot') {
    return `<div class="app-inner">${brand()}
      <div class="card">
        <h2>Reset your PIN</h2>
        <p class="sub">Enter the email you signed up with. We will send a 6-digit code.</p>
        <form data-form="forgot" style="margin-top:14px">
          <label>Email<input name="email" type="email" required autocomplete="email"></label>
          <button type="submit">Send code</button>
          <button type="button" class="link" data-act="auth-mode" data-mode="login">Back to log in</button>
        </form>
      </div></div>`;
  }
  if (m === 'reset') {
    return `<div class="app-inner">${brand()}
      <div class="card">
        <h2>Enter your code</h2>
        <p class="sub">We sent a code to ${esc(state.resetEmail)}. It expires in 15 minutes.</p>
        <form data-form="reset" style="margin-top:14px">
          <label>6-digit code<input name="code" inputmode="numeric" maxlength="6" required></label>
          <label>New 4-digit PIN<input name="newPin" inputmode="numeric" maxlength="4" pattern="\\d{4}" required></label>
          <button type="submit">Set new PIN</button>
          <button type="button" class="link" data-act="auth-mode" data-mode="login">Back to log in</button>
        </form>
      </div></div>`;
  }

  const isLogin = m === 'login';
  return `<div class="app-inner">${brand()}
    <div class="tabs">
      <button class="${isLogin ? 'on' : ''}" data-act="auth-mode" data-mode="login">Log in</button>
      <button class="${!isLogin ? 'on' : ''}" data-act="auth-mode" data-mode="signup">Sign up</button>
    </div>
    <div class="card">
      ${isLogin ? `
      <form data-form="login">
        <label>Phone or email<input name="identifier" required autocomplete="username"></label>
        <label>4-digit PIN<input name="pin" inputmode="numeric" maxlength="4" pattern="\\d{4}" required autocomplete="current-password"></label>
        <button type="submit">Log in</button>
        <button type="button" class="link" data-act="auth-mode" data-mode="forgot">Forgot PIN?</button>
      </form>` : `
      <form data-form="signup">
        <label>Phone number<input name="phone" inputmode="tel" placeholder="08012345678" maxlength="11" pattern="0\\d{10}" required></label>
        <label>Email<input name="email" type="email" required autocomplete="email"></label>
        <label>Create a 4-digit PIN<input name="pin" inputmode="numeric" maxlength="4" pattern="\\d{4}" required></label>
        <label>Referral code (optional)<input name="referralCode" autocomplete="off"></label>
        <button type="submit">Create my wallet</button>
      </form>`}
    </div>
  </div>`;
}

function verifyEmailView() {
  const email = state.wallet ? state.wallet.email : '';
  return `<div class="app-inner">
    <div class="topbar"><h2>Check your email</h2></div>
    <div class="card">
      <p class="sub">We sent a 6-digit code to <strong>${esc(email)}</strong>. It expires in 15 minutes.</p>
      <form data-form="verify-email" style="margin-top:14px">
        <label>6-digit code<input name="code" inputmode="numeric" maxlength="6" pattern="\\d{6}" required autocomplete="one-time-code"></label>
        <button type="submit">Confirm email</button>
        <button type="button" class="link" data-act="resend-verify">Resend code</button>
      </form>
    </div>
  </div>`;
}

function verifyView() {
  return `<div class="app-inner">
    <div class="topbar"><h2>Verify your identity</h2></div>
    <div class="card">
      <p class="sub">Your name must match your BVN exactly. We use it to open your funding account. Your ID number is never stored, only a secure fingerprint.</p>
      <form data-form="verify" style="margin-top:14px">
        <label>Full name (as on your ID)<input name="fullName" required autocomplete="name"></label>
        <label>ID type
          <select name="idType">
            <option value="bvn">BVN</option>
            <option value="nin">NIN</option>
          </select>
        </label>
        <label>ID number (11 digits)<input name="idNumber" inputmode="numeric" maxlength="11" pattern="\\d{11}" required></label>
        <button type="submit">Verify and get my account</button>
      </form>
    </div>
    <p class="note center"><button class="link" data-go="home">Skip for now</button></p>
  </div>`;
}

function homeView() {
  const w = state.wallet;
  if (!w) return `<div class="app-inner"><p class="center muted">Loading your wallet…</p></div>`;
  const r = state.rewards || {};
  const recent = (state.history || []).slice(0, 4);
  return `<div class="app-inner">
    <div class="topbar">
      <div>
        <p class="sub" style="margin:0">Hi, ${esc((w.full_name || w.email || '').split(' ')[0] || 'there')}</p>
        <h2>Your wallet</h2>
      </div>
      <button class="small secondary" data-act="logout">Log out</button>
    </div>

    ${w.kyc_verified ? '' : `<div class="banner"><span>Verify your identity to get your funding account and send to banks.</span>
      <button class="small" data-go="verify">Verify</button></div>`}

    <div class="card hero">
      <p class="label">Main balance</p>
      <div class="amount">${naira(w.mainKobo)}</div>
      <div class="row">
        <span>Account ${esc(w.account_number)}</span>
        <button class="small secondary" data-act="copy" data-copy="${esc(w.account_number)}">Copy</button>
      </div>
    </div>

    <div class="actions">
      <button class="action" data-go="send"><span class="ico">↗</span>Send</button>
      <button class="action" data-go="deposit"><span class="ico">↙</span>Deposit</button>
      <button class="action" data-go="history"><span class="ico">🧾</span>History</button>
    </div>

    <div class="card">
      <div class="row-between"><span class="muted">Bonus balance</span><strong>${naira(w.bonusKobo)}</strong></div>
      <div class="row-between" style="margin-top:10px"><span class="muted">Friends referred</span><strong>${Number(r.friends || 0)}</strong></div>
      <div class="row-between" style="margin-top:10px"><span class="muted">Your referral code</span><strong>${esc(w.referral_code)}</strong></div>
    </div>

    <div class="card">
      <div class="row-between" style="margin-bottom:6px"><h3 style="font-size:17px">Recent activity</h3>
        <button class="link" data-go="history">See all</button></div>
      ${recent.length ? txList(recent) : '<p class="muted">No transactions yet.</p>'}
    </div>
  </div>
  ${nav('home')}`;
}

function sendView() {
  const isBank = state.sendType === 'bank';
  const banks = state.banks || [];
  return `<div class="app-inner">
    <div class="topbar"><h2>Send money</h2></div>
    <div class="seg">
      <button class="${!isBank ? 'on' : ''}" data-act="send-type" data-type="wallet">To a Legendary wallet</button>
      <button class="${isBank ? 'on' : ''}" data-act="send-type" data-type="bank">To a bank</button>
    </div>
    <div class="card">
      ${isBank ? `
      <form data-form="send-bank" data-lookup-form>
        <label>Bank
          <select name="bankCode" data-lookup required>
            <option value="">Choose a bank</option>
            ${banks.map((b) => `<option value="${esc(b.code)}">${esc(b.name)}</option>`).join('')}
          </select>
        </label>
        <label>Account number<input name="accountNumber" inputmode="numeric" maxlength="10" pattern="\\d{10}" data-lookup required></label>
        <div class="recipient"></div>
        <label>Amount (₦)<input name="amount" inputmode="decimal" placeholder="0.00" required></label>
        <p class="note">Bank transfer fee: ${naira(state.bankFeeKobo)}</p>
        <label>Your 4-digit PIN<input name="pin" inputmode="numeric" maxlength="4" pattern="\\d{4}" required></label>
        <input type="hidden" name="idemKey" value="${esc(state.idem)}">
        <button type="submit">Send to bank</button>
      </form>` : `
      <form data-form="send-wallet" data-lookup-form>
        <label>Recipient wallet number<input name="toAccount" inputmode="numeric" maxlength="10" pattern="\\d{10}" data-lookup required></label>
        <div class="recipient"></div>
        <label>Amount (₦)<input name="amount" inputmode="decimal" placeholder="0.00" required></label>
        <label>Your 4-digit PIN<input name="pin" inputmode="numeric" maxlength="4" pattern="\\d{4}" required></label>
        <input type="hidden" name="idemKey" value="${esc(state.idem)}">
        <button type="submit">Send</button>
      </form>`}
    </div>
  </div>
  ${nav('send')}`;
}

function depositView() {
  const w = state.wallet;
  if (!w) return `<div class="app-inner"><p class="center muted">Loading…</p></div>`;
  if (!w.kyc_verified || !w.virtual_account) {
    return `<div class="app-inner">
      <div class="topbar"><h2>Deposit</h2></div>
      <div class="card"><p>Verify your identity first to get your personal funding account.</p>
        <button style="margin-top:12px" data-go="verify">Verify now</button></div>
    </div>${nav('deposit')}`;
  }
  return `<div class="app-inner">
    <div class="topbar"><h2>Deposit</h2></div>
    <div class="card">
      <p class="muted" style="margin:0">Send money from any bank to this account. It goes straight into your wallet.</p>
      <div class="copy-row">
        <div>
          <div class="muted" style="font-size:13px">Account number</div>
          <strong>${esc(w.virtual_account)}</strong>
        </div>
        <button class="small secondary" data-act="copy" data-copy="${esc(w.virtual_account)}">Copy</button>
      </div>
      <p class="sub" style="margin-top:12px">Bank: ${esc(w.virtual_bank || 'Shown on your account')}</p>
      <p class="sub">Account name: ${esc(w.full_name)}</p>
    </div>
  </div>${nav('deposit')}`;
}

function historyView() {
  const items = state.history || [];
  return `<div class="app-inner">
    <div class="topbar"><h2>History</h2>
      <button class="small secondary" data-act="refresh-history">Refresh</button></div>
    <div class="card">${items.length ? txList(items) : '<p class="muted">No transactions yet.</p>'}</div>
  </div>${nav('history')}`;
}

function txList(items) {
  return `<ul class="list">${items.map((t) => {
    const amt = Number(t.amountKobo || 0);
    const label = TX_LABELS[t.kind] || esc(t.kind);
    const when = t.at ? new Date(t.at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    return `<li>
      <div><div class="t-title">${label}</div><div class="t-meta">${esc(when)}</div></div>
      <div class="${amt < 0 ? 'amt-out' : 'amt-in'}">${amt < 0 ? '-' : '+'}${naira(Math.abs(amt))}</div>
    </li>`;
  }).join('')}</ul>`;
}

// ---------- actions ----------
const SUBMIT = {
  async login(d) {
    const r = await api('/auth/login', { method: 'POST', body: { identifier: d.identifier.trim(), pin: d.pin }, auth: false });
    store.set('lp_token', r.token);
    state.wallet = null;
    await loadWallet();
    navigate(nextScreen());
  },

  async signup(d) {
    const r = await api('/auth/signup', {
      method: 'POST',
      auth: false,
      body: {
        phone: d.phone.trim(),
        email: d.email.trim(),
        pin: d.pin,
        referralCode: d.referralCode.trim() || undefined,
        deviceId: deviceId(),
      },
    });
    store.set('lp_token', r.token);
    state.wallet = null;
    toast('Account created. Enter the code we emailed you.');
    navigate('verify-email');
  },

  async forgot(d) {
    await api('/auth/forgot', { method: 'POST', body: { email: d.email.trim() }, auth: false });
    state.resetEmail = d.email.trim();
    state.authMode = 'reset';
    toast('If that email is registered, a code is on its way.');
    render();
  },

  async reset(d) {
    await api('/auth/reset', { method: 'POST', auth: false, body: { email: state.resetEmail, code: d.code.trim(), newPin: d.newPin } });
    state.authMode = 'login';
    toast('PIN reset. Log in with your new PIN.');
    render();
  },

  async 'verify-email'(d) {
    await api('/auth/verify-email', { method: 'POST', body: { code: d.code.trim() } });
    if (state.wallet) state.wallet.email_verified = true;
    toast('Email confirmed.');
    navigate(nextScreen());
  },

  async verify(d) {
    await api('/kyc/verify', {
      method: 'POST',
      body: { fullName: d.fullName.trim(), idType: d.idType, idNumber: d.idNumber.trim() },
    });
    state.wallet = null;
    await loadWallet();
    toast('Identity verified. Your funding account is ready.');
    navigate('home');
  },

  async 'send-wallet'(d) {
    await api('/transfer/internal', {
      method: 'POST',
      body: { toAccount: d.toAccount.trim(), amount: toKobo(d.amount), pin: d.pin, idemKey: state.idem },
    });
    state.idem = newId();
    state.wallet = null;
    toast('Sent.');
    navigate('home');
  },

  async 'send-bank'(d) {
    await api('/transfer/bank', {
      method: 'POST',
      body: { accountNumber: d.accountNumber.trim(), bankCode: d.bankCode, amount: toKobo(d.amount), pin: d.pin, idemKey: state.idem },
    });
    state.idem = newId();
    state.wallet = null;
    toast('Transfer is processing. You will see it in your history.');
    navigate('home');
  },
};

function deviceId() {
  let id = store.get('lp_device');
  if (!id) { id = newId(); store.set('lp_device', id); }
  return id;
}

async function handleSubmit(form) {
  const kind = form.dataset.form;
  const d = Object.fromEntries(new FormData(form));
  const btn = form.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;
  try {
    await SUBMIT[kind](d);
  } catch (err) {
    toast(err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function runLookup(form) {
  const out = form.querySelector('.recipient');
  if (!out) return;
  out.className = 'recipient';
  out.textContent = '';
  const f = new FormData(form);
  try {
    if (form.dataset.form === 'send-wallet') {
      const acc = String(f.get('toAccount') || '');
      if (!/^\d{10}$/.test(acc)) return;
      const r = await api(`/lookup/wallet?account=${encodeURIComponent(acc)}`);
      out.textContent = 'Sending to: ' + r.name;
    } else if (form.dataset.form === 'send-bank') {
      const acc = String(f.get('accountNumber') || ''), bank = String(f.get('bankCode') || '');
      if (!/^\d{10}$/.test(acc) || !bank) return;
      const r = await api(`/lookup/bank?accountNumber=${encodeURIComponent(acc)}&bankCode=${encodeURIComponent(bank)}`);
      out.textContent = 'Account name: ' + r.name;
    }
  } catch (e) {
    out.className = 'recipient err';
    out.textContent = e.message;
  }
}

const ACTIONS = {
  'auth-mode'(el) { state.authMode = el.dataset.mode; render(); },
  'send-type'(el) { state.sendType = el.dataset.type; render(); },
  logout() { logout(); },
  async 'resend-verify'() {
    try { await api('/auth/resend-verify', { method: 'POST' }); toast('A new code is on its way.'); } catch (e) { toast(e.message); }
  },
  retry() { navigate(state.screen); },
  async 'refresh-history'() {
    try { state.history = await api('/wallet/history'); render(); toast('Updated'); } catch (e) { toast(e.message); }
  },
  copy(el) {
    const text = el.dataset.copy;
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Copied'), () => toast(text));
    else toast(text);
  },
};

// ---------- wiring ----------
$app.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { navigate(go.dataset.go); return; }
  const act = e.target.closest('[data-act]');
  if (act && ACTIONS[act.dataset.act]) ACTIONS[act.dataset.act](act);
});

$app.addEventListener('submit', (e) => {
  e.preventDefault();
  handleSubmit(e.target);
});

let lookupTimer = null;
function onLookupEvent(e) {
  if (!e.target.matches('[data-lookup]')) return;
  const form = e.target.closest('form');
  clearTimeout(lookupTimer);
  lookupTimer = setTimeout(() => runLookup(form), 400);
}
$app.addEventListener('input', onLookupEvent);
$app.addEventListener('change', onLookupEvent);

// ---------- start ----------
(async function init() {
  if (!API) {
    $app.innerHTML = `<div class="card center"><p>The app is not connected yet. Set API_BASE in config.js.</p></div>`;
    return;
  }
  if (store.get('lp_token')) {
    try {
      await loadWallet();
      navigate(nextScreen());
      return;
    } catch {
      // token invalid or server unreachable: fall through to login
    }
  }
  navigate('login');
})();
