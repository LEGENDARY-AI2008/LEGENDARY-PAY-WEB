// Legendary Pay web app. Plain JavaScript, no build step.
const API = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || '';
const $app = document.getElementById('app');
const $toast = document.getElementById('toast');

const PROTECTED = ['home', 'send', 'deposit', 'history', 'verify', 'verify-email', 'receipt', 'rewards', 'profile', 'goals', 'airtime', 'admin'];
const TX_LABELS = {
  deposit: 'Deposit',
  internal_transfer: 'Wallet transfer',
  bank_transfer: 'Bank transfer',
  refund: 'Refund',
  cashback: 'Cashback',
  bonus: 'Bonus',
  referral: 'Referral bonus',
  goal_deposit: 'Saved to goal',
  goal_withdraw: 'Moved from goal',
  bill_airtime: 'Airtime top-up',
};
const REWARD_NAMES = { welcome: 'Welcome bonus', referral: 'Referral bonus', cashback: 'Cashback' };
const REWARD_STATUS = { paid: 'Paid', pending: 'Pending', void: 'Cancelled' };
const PAYOUT_STATUS = { queued: 'Processing', success: 'Successful', refunded: 'Refunded' };

const state = {
  screen: 'login',
  authMode: 'login',     // login | signup | forgot | reset
  resetEmail: '',
  wallet: null,
  history: null,
  rewards: null,
  rewardsList: null,
  goals: null,
  admin: null,           // { stats, users, payouts, bills, settings, query } for admin accounts
  beneficiaries: null,
  prefill: null,         // values for the send form, set by "Use" on a saved person
  receiptId: null,
  receipt: null,
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
  state.rewardsList = null;
  state.receipt = null;
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
  if (screen === 'rewards') {
    try {
      [state.rewards, state.rewardsList] = await Promise.all([api('/rewards'), api('/rewards/list')]);
    } catch (e) { toast(e.message); }
  }
  if (screen === 'receipt') {
    try { state.receipt = await api(`/wallet/receipt/${encodeURIComponent(state.receiptId)}`); }
    catch (e) { toast(e.message); state.receipt = null; }
  }
  if (screen === 'goals') {
    try { state.goals = await api('/goals'); } catch (e) { toast(e.message); state.goals = []; }
  }
  if (screen === 'airtime') state.idem = newId();
  if (screen === 'admin') {
    try { state.admin = await fetchAdmin(''); } catch (e) { toast(e.message); state.admin = null; }
  }
  if (screen === 'send') {
    state.idem = newId();
    state.prefill = null;
    try { state.beneficiaries = await api('/beneficiaries'); } catch { state.beneficiaries = []; }
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
  if (w.is_admin) return 'admin';
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
    case 'receipt': return receiptView();
    case 'rewards': return rewardsView();
    case 'profile': return profileView();
    case 'goals': return goalsView();
    case 'airtime': return airtimeView();
    case 'admin': return adminView();
    default: return authView();
  }
}

function nav(active) {
  const item = (id, ico, label) =>
    `<button data-go="${id}" class="${active === id ? 'on' : ''}"><span class="ico">${ico}</span>${label}</button>`;
  return `<nav class="nav">
    ${item('home', '🏠', 'Home')}
    ${item('send', '↗', 'Send')}
    ${item('history', '🧾', 'History')}
    ${item('rewards', '🎁', 'Rewards')}
    ${item('profile', '👤', 'Me')}
  </nav>`;
}

function brand() {
  return `<div class="brand">
    <img src="logo.jpg" alt="Legendary Pay logo">
    <h1>Legendary Pay</h1>
    <p>Send, receive and save in naira</p>
  </div>`;
}

// Every page except Home gets a Back button.
function backBtn() {
  return `<p class="back-row"><button type="button" class="link back-btn" data-act="back">‹ Back</button></p>`;
}

// ---------- screens ----------
function authView() {
  const m = state.authMode;
  if (m === 'forgot') {
    return `<div class="app-inner">${backBtn()}${brand()}
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
    return `<div class="app-inner">${backBtn()}${brand()}
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
  return `<div class="app-inner">${isLogin ? '' : backBtn()}${brand()}
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

function changeEmailForm(extraClass = '') {
  return `<form data-form="change-email" class="${extraClass}">
    <label>New email<input name="email" type="email" required autocomplete="email"></label>
    <label>Your 4-digit PIN<input name="pin" inputmode="numeric" maxlength="4" pattern="\\d{4}" required></label>
    <button type="submit">Change email</button>
  </form>`;
}

function verifyEmailView() {
  const email = state.wallet ? state.wallet.email : '';
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Check your email</h2></div>
    <div class="card">
      <p class="sub">We sent a 6-digit code to <strong>${esc(email)}</strong>. It expires in 15 minutes.</p>
      <form data-form="verify-email" style="margin-top:14px">
        <label>6-digit code<input name="code" inputmode="numeric" maxlength="6" pattern="\\d{6}" required autocomplete="one-time-code"></label>
        <button type="submit">Confirm email</button>
        <button type="button" class="link" data-act="resend-verify">Resend code</button>
      </form>
    </div>
    <details class="card">
      <summary style="cursor:pointer;color:var(--brand-2);font-weight:600">Wrong email? Change it</summary>
      <div style="margin-top:14px">${changeEmailForm()}</div>
    </details>
  </div>`;
}

function verifyView() {
  return `<div class="app-inner">
    ${backBtn()}
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
      <button class="small secondary" data-go="profile">Me</button>
    </div>

    ${w.is_admin ? `<div class="banner"><span>You are an admin.</span><button class="small" data-go="admin">Admin panel</button></div>` : ''}
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
      <button class="action" data-go="airtime"><span class="ico">📱</span>Airtime</button>
      <button class="action" data-go="goals"><span class="ico">🎯</span>Goals</button>
      <button class="action" data-go="rewards"><span class="ico">🎁</span>Rewards</button>
    </div>

    <div class="card">
      <div class="row-between"><span class="muted">Bonus balance</span><strong>${naira(w.bonusKobo)}</strong></div>
      <div class="row-between" style="margin-top:10px"><span class="muted">Friends referred</span><strong>${Number(r.friends || 0)}</strong></div>
      <div class="row-between" style="margin-top:10px"><span class="muted">Your referral code</span><strong>${esc(w.referral_code)}</strong></div>
      <p class="note" style="margin-top:12px"><button class="link" data-go="rewards">See my rewards</button></p>
    </div>

    <div class="card">
      <div class="row-between" style="margin-bottom:6px"><h3 style="font-size:17px">Recent activity</h3>
        <button class="link" data-go="history">See all</button></div>
      ${recent.length ? txList(recent) : '<p class="muted">No transactions yet.</p>'}
    </div>
  </div>
  ${nav('home')}`;
}

// Saved people for the current send type (wallet or bank).
function benefList() {
  const type = state.sendType === 'bank' ? 'bank' : 'wallet';
  const mine = (state.beneficiaries || []).filter((b) => b.type === type);
  if (!mine.length) return '';
  return `<div class="card">
    <p class="sub" style="margin-top:0">Saved people</p>
    <ul class="list">${mine.map((b) => `<li>
      <div><div class="t-title">${esc(b.label)}</div><div class="t-meta">${esc(b.accountNumber)}</div></div>
      <div class="row-between" style="gap:6px">
        <button class="small" data-act="use-benef" data-id="${esc(b.id)}">Use</button>
        <button class="small secondary" data-act="del-benef" data-id="${esc(b.id)}" aria-label="Remove">✕</button>
      </div>
    </li>`).join('')}</ul>
  </div>`;
}

function sendView() {
  const isBank = state.sendType === 'bank';
  const banks = state.banks || [];
  const p = state.prefill || {};
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Send money</h2></div>
    <div class="seg">
      <button class="${!isBank ? 'on' : ''}" data-act="send-type" data-type="wallet">To a Legendary wallet</button>
      <button class="${isBank ? 'on' : ''}" data-act="send-type" data-type="bank">To a bank</button>
    </div>
    ${benefList()}
    <div class="card">
      ${isBank ? `
      <form data-form="send-bank" data-lookup-form>
        <label>Bank
          <select name="bankCode" data-lookup required>
            <option value="">Choose a bank</option>
            ${banks.map((b) => `<option value="${esc(b.code)}" ${p.bankCode === b.code ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}
          </select>
        </label>
        <label>Account number<input name="accountNumber" inputmode="numeric" maxlength="10" pattern="\\d{10}" data-lookup required value="${esc(p.accountNumber || '')}"></label>
        <div class="recipient"></div>
        <label>Amount (₦)<input name="amount" inputmode="decimal" placeholder="0.00" required></label>
        <p class="note">Bank transfer fee: ${naira(state.bankFeeKobo)}</p>
        <label>Your 4-digit PIN<input name="pin" inputmode="numeric" maxlength="4" pattern="\\d{4}" required></label>
        <label>Save this person as (optional)<input name="saveAs" maxlength="40" placeholder="e.g. Mum"></label>
        <input type="hidden" name="idemKey" value="${esc(state.idem)}">
        <button type="submit">Send to bank</button>
      </form>` : `
      <form data-form="send-wallet" data-lookup-form>
        <label>Recipient wallet number<input name="toAccount" inputmode="numeric" maxlength="10" pattern="\\d{10}" data-lookup required value="${esc(p.toAccount || '')}"></label>
        <div class="recipient"></div>
        <label>Amount (₦)<input name="amount" inputmode="decimal" placeholder="0.00" required></label>
        <label>Your 4-digit PIN<input name="pin" inputmode="numeric" maxlength="4" pattern="\\d{4}" required></label>
        <label>Save this person as (optional)<input name="saveAs" maxlength="40" placeholder="e.g. Mum"></label>
        <input type="hidden" name="idemKey" value="${esc(state.idem)}">
        <button type="submit">Send</button>
      </form>`}
    </div>
  </div>
  ${nav('send')}`;
}

function goalCard(g) {
  const pct = g.targetKobo ? Math.min(100, Math.round((g.savedKobo / g.targetKobo) * 100)) : 0;
  return `<div class="card">
    <div class="row-between"><strong>${esc(g.name)}</strong><span class="muted">${pct}%</span></div>
    <p class="sub" style="margin:6px 0 10px">${naira(g.savedKobo)} of ${naira(g.targetKobo)}</p>
    <div class="bar"><span style="width:${pct}%"></span></div>
    <form data-form="goal-move" style="margin-top:12px">
      <input type="hidden" name="goalId" value="${esc(g.id)}">
      <input type="hidden" name="idemKey" value="${newId()}">
      <label>Direction<select name="direction">
        <option value="in">Save into this goal (from wallet)</option>
        <option value="out">Take out (back to wallet)</option>
      </select></label>
      <label>Amount (₦)<input name="amount" inputmode="decimal" required></label>
      <label>Your 4-digit PIN<input name="pin" inputmode="numeric" maxlength="4" pattern="\\d{4}" required></label>
      <button type="submit">Confirm</button>
    </form>
  </div>`;
}

function goalsView() {
  const goals = state.goals || [];
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Savings goals</h2></div>
    <p class="sub">Put money aside for a goal. It stays yours, but you cannot spend it until you move it back.</p>
    ${goals.length ? goals.map(goalCard).join('') : '<div class="card"><p class="muted">No goals yet. Create your first one below.</p></div>'}
    <div class="card">
      <h3 style="font-size:17px;margin-bottom:10px">New goal</h3>
      <form data-form="goal-add">
        <label>Goal name<input name="name" maxlength="40" required placeholder="e.g. Rent, Laptop"></label>
        <label>Target (₦)<input name="target" inputmode="decimal" required placeholder="50000"></label>
        <button type="submit">Create goal</button>
      </form>
    </div>
  </div>${nav('home')}`;
}

function airtimeView() {
  const networks = [['MTN', 'MTN'], ['GLO', 'Glo'], ['AIRTEL', 'Airtel'], ['9MOBILE', '9mobile']];
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Buy airtime</h2></div>
    <div class="card">
      <form data-form="airtime">
        <label>Network
          <select name="network">${networks.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
        </label>
        <label>Phone number<input name="phone" inputmode="tel" placeholder="08012345678" maxlength="11" pattern="0\\d{10}" required></label>
        <label>Amount (₦)<input name="amount" inputmode="decimal" placeholder="500" required></label>
        <label>Your 4-digit PIN<input name="pin" inputmode="numeric" maxlength="4" pattern="\\d{4}" required></label>
        <input type="hidden" name="idemKey" value="${esc(state.idem)}">
        <button type="submit">Buy airtime</button>
      </form>
    </div>
    <p class="note">If the airtime fails, the money goes back to your wallet.</p>
  </div>${nav('home')}`;
}

function depositView() {
  const w = state.wallet;
  if (!w) return `<div class="app-inner"><p class="center muted">Loading…</p></div>`;
  if (!w.kyc_verified || !w.virtual_account) {
    return `<div class="app-inner">
      ${backBtn()}
      <div class="topbar"><h2>Deposit</h2></div>
      <div class="card"><p>Verify your identity first to get your personal funding account.</p>
        <button style="margin-top:12px" data-go="verify">Verify now</button></div>
    </div>${nav('deposit')}`;
  }
  return `<div class="app-inner">
    ${backBtn()}
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
    ${backBtn()}
    <div class="topbar"><h2>History</h2>
      <button class="small secondary" data-act="refresh-history">Refresh</button></div>
    <div class="card">${items.length ? txList(items) : '<p class="muted">No transactions yet.</p>'}</div>
    <p class="note center">Tap any transaction to see its receipt.</p>
  </div>${nav('history')}`;
}

function receiptView() {
  const r = state.receipt;
  if (!r) return `<div class="app-inner">${backBtn()}<p class="center muted">We could not load this receipt. Try again.</p></div>${nav('history')}`;
  const amt = Number(r.amountKobo || 0);
  const label = TX_LABELS[r.kind] || esc(r.kind);
  const when = r.at ? new Date(r.at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Receipt</h2></div>
    <div class="card center">
      <p class="muted" style="margin:0">${label}</p>
      <p class="${amt < 0 ? 'amt-out' : 'amt-in'}" style="font-size:30px;margin:8px 0">${amt < 0 ? '-' : '+'}${naira(Math.abs(amt))}</p>
      <p class="sub" style="margin:0">${esc(when)}</p>
    </div>
    <div class="card">
      <div class="row-between"><span class="muted">Status</span><strong>${esc(PAYOUT_STATUS[r.status] || 'Successful')}</strong></div>
      ${r.feeKobo ? `<div class="row-between" style="margin-top:10px"><span class="muted">Fee</span><strong>${naira(r.feeKobo)}</strong></div>` : ''}
      ${r.bankAccount ? `<div class="row-between" style="margin-top:10px"><span class="muted">Bank account</span><strong>${esc(r.bankAccount)}</strong></div>` : ''}
      ${r.reference ? `<div class="row-between" style="margin-top:10px"><span class="muted">Reference</span><strong style="font-size:13px;word-break:break-all">${esc(r.reference)}</strong></div>` : ''}
      <div class="row-between" style="margin-top:10px"><span class="muted">Receipt ID</span><strong style="font-size:12px;word-break:break-all">${esc(r.id)}</strong></div>
    </div>
  </div>${nav('history')}`;
}

function rewardsView() {
  const r = state.rewards || {};
  const list = state.rewardsList || [];
  const code = state.wallet ? state.wallet.referral_code : '';
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Rewards</h2></div>
    <div class="card hero">
      <p class="label">Rewards paid to you</p>
      <div class="amount">${naira(r.paidKobo)}</div>
      <div class="row"><span>Pending: ${naira(r.pendingKobo)}</span><span>Friends: ${Number(r.friends || 0)}</span></div>
    </div>
    <div class="card">
      <div class="row-between"><span class="muted">Your referral code</span><strong>${esc(code)}</strong></div>
      <p class="sub" style="margin-top:12px">Share your code. You earn ₦100 when a friend who signs up with it deposits ₦500 or more. Pending rewards are released once they qualify.</p>
    </div>
    <div class="card">
      <h3 style="font-size:17px;margin-bottom:6px">Reward history</h3>
      ${list.length ? `<ul class="list">${list.map((g) => `<li>
        <div><div class="t-title">${esc(REWARD_NAMES[g.type] || g.type)}</div>
          <div class="t-meta">${esc(REWARD_STATUS[g.status] || g.status)} · ${esc(new Date(g.at).toLocaleDateString('en-NG', { dateStyle: 'medium' }))}</div></div>
        <div class="amt-in">+${naira(g.amountKobo)}</div>
      </li>`).join('')}</ul>` : '<p class="muted">No rewards yet. Share your code to start earning.</p>'}
    </div>
  </div>${nav('rewards')}`;
}

function profileView() {
  const w = state.wallet;
  if (!w) return `<div class="app-inner"><p class="center muted">Loading…</p></div>`;
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>My profile</h2></div>
    <div class="card">
      <div class="row-between"><span class="muted">Name</span><strong>${esc(w.full_name || 'Not verified yet')}</strong></div>
      <div class="row-between" style="margin-top:10px"><span class="muted">Phone</span><strong>${esc(w.phone)}</strong></div>
      <div class="row-between" style="margin-top:10px"><span class="muted">Email</span><strong>${esc(w.email)}</strong></div>
      <div class="row-between" style="margin-top:10px"><span class="muted">Wallet number</span><strong>${esc(w.account_number)}</strong></div>
      <div class="row-between" style="margin-top:10px"><span class="muted">Referral code</span><strong>${esc(w.referral_code)}</strong></div>
    </div>
    <div class="card">
      <h3 style="font-size:17px;margin-bottom:10px">Change PIN</h3>
      <form data-form="change-pin">
        <label>Current PIN<input name="oldPin" inputmode="numeric" maxlength="4" pattern="\\d{4}" required autocomplete="current-password"></label>
        <label>New 4-digit PIN<input name="newPin" inputmode="numeric" maxlength="4" pattern="\\d{4}" required autocomplete="new-password"></label>
        <label>Confirm new PIN<input name="confirm" inputmode="numeric" maxlength="4" pattern="\\d{4}" required autocomplete="new-password"></label>
        <button type="submit">Change PIN</button>
      </form>
    </div>
    <div class="card">
      <h3 style="font-size:17px;margin-bottom:6px">Change email</h3>
      <p class="sub" style="margin-bottom:12px">We will send a new code to the new email. You must verify it again.</p>
      ${changeEmailForm()}
    </div>
    <div class="card">
      <button class="secondary" data-act="logout">Log out</button>
    </div>
  </div>${nav('profile')}`;
}

// ---------- admin panel (admin accounts only; the server checks this on every call) ----------
async function fetchAdmin(query) {
  const [stats, users, payouts, bills, settings] = await Promise.all([
    api('/admin/stats'),
    api(`/admin/users?q=${encodeURIComponent(query)}`),
    api('/admin/payouts'),
    api('/admin/bills'),
    api('/admin/settings'),
  ]);
  return { stats, users, payouts, bills, settings, query };
}

function adminView() {
  const a = state.admin;
  if (!a) return `<div class="app-inner">${backBtn()}<p class="center muted">Could not load the admin panel.</p></div>`;
  const s = a.stats;
  const statCell = (label, value) => `<div style="background:var(--card-2);border-radius:14px;padding:12px"><span class="muted" style="font-size:13px">${esc(label)}</span><strong style="display:block;font-size:20px">${esc(value)}</strong></div>`;
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Admin panel</h2></div>

    <div class="card">
      <h3 style="font-size:17px;margin-bottom:10px">Overview</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${statCell('Users', s.totalUsers)}
        ${statCell('ID verified', s.kycUsers)}
        ${statCell('Email verified', s.emailUsers)}
        ${statCell('Transactions (24h)', s.tx24h)}
        ${statCell('Money held', naira(s.heldKobo))}
        ${statCell('Payouts queued', s.queuedPayouts)}
        ${statCell('Airtime pending', s.pendingBills)}
      </div>
    </div>

    <div class="card">
      <h3 style="font-size:17px;margin-bottom:10px">Users</h3>
      <form data-form="admin-search">
        <input name="q" value="${esc(a.query || '')}" placeholder="Phone, email, name or wallet number">
        <button type="submit">Search</button>
      </form>
      <ul class="list" style="margin-top:12px">${a.users.length ? a.users.map((u) => `<li>
        <div>
          <div class="t-title">${esc(u.name || 'No name yet')}</div>
          <div class="t-meta">${esc(u.phone)} · ${esc(u.email || '')}</div>
          <div class="t-meta">Wallet ${esc(u.accountNumber || '-')} · ${naira(u.mainKobo)}</div>
          <div class="t-meta">${u.kycVerified ? 'ID verified' : 'ID not verified'} · ${u.emailVerified ? 'email ok' : 'email not verified'}</div>
        </div>
        <button class="small secondary" data-act="admin-kyc" data-id="${esc(u.id)}" data-to="${u.kycVerified ? 'false' : 'true'}">${u.kycVerified ? 'Unverify' : 'Verify ID'}</button>
      </li>`).join('') : '<li><span class="muted">No users found.</span></li>'}</ul>
    </div>

    <div class="card">
      <h3 style="font-size:17px;margin-bottom:10px">Bank payouts (latest 50)</h3>
      ${a.payouts.length ? `<ul class="list">${a.payouts.map((p) => `<li>
        <div><div class="t-title">${naira(p.amountKobo)} to ${esc(p.accountNumber)}</div>
        <div class="t-meta">${esc(when(p.at))} · bank ${esc(p.bankCode)}</div></div>
        <div class="t-meta">${esc(p.status)}</div></li>`).join('')}</ul>` : '<p class="muted">No payouts yet.</p>'}
    </div>

    <div class="card">
      <h3 style="font-size:17px;margin-bottom:6px">Airtime needing attention</h3>
      <p class="sub">Pending means the provider did not confirm. Check these on your Flutterwave dashboard.</p>
      ${a.bills.length ? `<ul class="list" style="margin-top:10px">${a.bills.map((b) => `<li>
        <div><div class="t-title">${naira(b.amountKobo)} · ${esc(b.network)} · ${esc(b.phone)}</div>
        <div class="t-meta">${esc(when(b.at))} · ${esc(b.reference)}</div></div>
        <div class="t-meta">${esc(b.status)}</div></li>`).join('')}</ul>` : '<p class="muted">Nothing to check.</p>'}
    </div>

    <div class="card">
      <h3 style="font-size:17px;margin-bottom:6px">Settings</h3>
      <p class="sub">Amounts are in kobo (100 kobo = ₦1).</p>
      ${a.settings.map((s2) => `<form data-form="admin-setting" style="margin-top:10px;flex-direction:row;align-items:flex-end">
        <input type="hidden" name="key" value="${esc(s2.key)}">
        <label style="flex:1">${esc(s2.key)}<input name="value" inputmode="numeric" value="${esc(s2.value)}" required></label>
        <button type="submit" class="small" style="width:auto">Save</button>
      </form>`).join('')}
    </div>

    <button class="secondary" data-go="home">Go to my wallet</button>
  </div>`;
}

function when(t) {
  return t ? new Date(t).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

function txList(items) {
  return `<ul class="list">${items.map((t) => {
    const amt = Number(t.amountKobo || 0);
    const label = TX_LABELS[t.kind] || esc(t.kind);
    const when = t.at ? new Date(t.at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    const tap = t.id ? `data-act="receipt" data-id="${esc(t.id)}" style="cursor:pointer"` : '';
    return `<li ${tap}>
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

  async 'change-email'(d) {
    await api('/me/email', { method: 'POST', body: { email: d.email.trim(), pin: d.pin } });
    state.wallet = null;
    await loadWallet();
    toast('We sent a code to your new email.');
    navigate(nextScreen());
  },

  async 'change-pin'(d) {
    if (d.newPin !== d.confirm) throw new Error('The new PINs do not match');
    await api('/me/pin', { method: 'POST', body: { oldPin: d.oldPin, newPin: d.newPin } });
    toast('PIN changed.');
    navigate('profile');
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

  async 'admin-search'(d) {
    state.admin = await fetchAdmin(d.q.trim());
    render();
  },

  async 'admin-setting'(d) {
    await api('/admin/settings', { method: 'PATCH', body: { key: d.key, value: Number(d.value) } });
    toast('Setting saved.');
    state.admin = await fetchAdmin(state.admin?.query || '');
    render();
  },

  async 'goal-add'(d) {
    await api('/goals', { method: 'POST', body: { name: d.name.trim(), targetKobo: toKobo(d.target) } });
    toast('Goal created.');
    navigate('goals');
  },

  async 'goal-move'(d) {
    await api(`/goals/${encodeURIComponent(d.goalId)}/move`, {
      method: 'POST',
      body: { amount: toKobo(d.amount), direction: d.direction, pin: d.pin, idemKey: d.idemKey },
    });
    state.wallet = null;
    toast(d.direction === 'in' ? 'Saved to your goal.' : 'Moved back to your wallet.');
    navigate('goals');
  },

  async airtime(d) {
    try {
      const r = await api('/bills/airtime', {
        method: 'POST',
        body: { network: d.network, phone: d.phone.trim(), amount: toKobo(d.amount), pin: d.pin, idemKey: d.idemKey },
      });
      state.wallet = null;
      state.idem = newId();
      toast(r.status === 'pending' ? 'Airtime is processing.' : 'Airtime sent.');
      navigate('home');
    } catch (e) {
      // A refunded attempt must not be retried with the same key.
      if (e.message.startsWith('Airtime could not be sent')) state.idem = newId();
      throw e;
    }
  },

  async 'send-wallet'(d) {
    await api('/transfer/internal', {
      method: 'POST',
      body: { toAccount: d.toAccount.trim(), amount: toKobo(d.amount), pin: d.pin, idemKey: state.idem, saveAs: d.saveAs?.trim() || undefined },
    });
    state.idem = newId();
    state.wallet = null;
    toast('Sent.');
    navigate('home');
  },

  async 'send-bank'(d) {
    await api('/transfer/bank', {
      method: 'POST',
      body: { accountNumber: d.accountNumber.trim(), bankCode: d.bankCode, amount: toKobo(d.amount), pin: d.pin, idemKey: state.idem, saveAs: d.saveAs?.trim() || undefined },
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
  back() {
    if (state.screen === 'login') { state.authMode = 'login'; render(); return; }
    if (state.screen === 'verify-email') { logout(); return; }
    if (state.screen === 'receipt') { navigate('history'); return; }
    navigate('home');
  },
  receipt(el) { state.receiptId = el.dataset.id; navigate('receipt'); },
  async 'admin-kyc'(el) {
    try {
      await api(`/admin/kyc/${encodeURIComponent(el.dataset.id)}`, { method: 'POST', body: { verified: el.dataset.to === 'true' } });
      state.admin = await fetchAdmin(state.admin?.query || '');
      render();
      toast(el.dataset.to === 'true' ? 'ID verified.' : 'ID unverified.');
    } catch (e) { toast(e.message); }
  },
  'use-benef'(el) {
    const b = (state.beneficiaries || []).find((x) => String(x.id) === el.dataset.id);
    if (!b) return;
    state.sendType = b.type === 'bank' ? 'bank' : 'wallet';
    state.prefill = b.type === 'bank'
      ? { accountNumber: b.accountNumber, bankCode: b.bankCode }
      : { toAccount: b.accountNumber };
    render();
    const form = $app.querySelector('form[data-lookup-form]');
    if (form) runLookup(form);
  },
  async 'del-benef'(el) {
    try {
      await api(`/beneficiaries/${encodeURIComponent(el.dataset.id)}`, { method: 'DELETE' });
      state.beneficiaries = (state.beneficiaries || []).filter((x) => String(x.id) !== el.dataset.id);
      render();
      toast('Removed.');
    } catch (e) { toast(e.message); }
  },
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
