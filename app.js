// Legendary Pay web app: state, navigation, API calls, actions and wiring.
// Screens (the HTML for each page) live in screens.js. Plain JavaScript, no build step.
const API = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || '';
const $app = document.getElementById('app');
const $toast = document.getElementById('toast');

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

// Tabs in the bottom bar. Moving to a tab clears the Back history.
const TABS = ['home', 'rewards', 'history', 'goals', 'me'];
const WALLET_CACHE = 'lp_wallet_cache';

const state = {
  screen: 'login',
  stack: [],             // screens to go back to
  authMode: 'login',     // login | signup | forgot | reset
  resetEmail: '',
  offline: false,        // true when showing the last saved balance
  wallet: null,
  history: null,
  rewards: null,
  rewardsList: null,
  leaderboard: null,
  checkin: null,
  notifications: null,
  reminders: null,
  requests: null,
  insights: null,
  schedules: null,
  limits: null,
  settings: null,
  recents: null,
  goals: null,
  beneficiaries: null,
  admin: null,           // { stats, users, payouts, bills, settings, query } for admin accounts
  prefill: null,         // values for the send form (set by Use, Pay or a recent person)
  sendType: 'wallet',    // wallet | bank
  sendTab: 'recent',     // recent | fav
  receiptId: null,
  receipt: null,
  support: null,         // { online, messages } for the user's live chat
  adminThread: null,     // { id, messages } for the chat an admin has open
  banks: null,
  bankFeeKobo: 0,
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

// Amounts are typed in naira and sent in kobo.
function toKobo(v) {
  const n = Number(String(v).replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n < 10 || n > 500000) throw new Error('Enter an amount between ₦10 and ₦500,000');
  return Math.round(n * 100);
}

function applyTheme(name) {
  if (name === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
}

function loadScript(src, globalName) {
  return new Promise((resolve, reject) => {
    if (window[globalName]) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load script'));
    document.head.appendChild(s);
  });
}

// The logo loader shows over the page while a request is running. Quick requests never show it.
const $loader = document.getElementById('loader');
let loaderCount = 0;
let loaderTimer = null;
function showLoader() {
  loaderCount++;
  if (loaderCount === 1 && $loader) loaderTimer = setTimeout(() => { $loader.hidden = false; }, 200);
}
function hideLoader() {
  loaderCount = Math.max(0, loaderCount - 1);
  if (loaderCount === 0) {
    clearTimeout(loaderTimer);
    if ($loader) $loader.hidden = true;
  }
}

async function api(path, { method = 'GET', body, auth = true, quiet = false } = {}) {
  const headers = { 'content-type': 'application/json' };
  const token = store.get('lp_token');
  if (auth && token) headers.authorization = 'Bearer ' + token;
  if (!quiet) showLoader();
  try {
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
  } finally {
    if (!quiet) hideLoader();
  }
}

// Loads one list or object into state. A failure leaves the old value in place.
const grab = (path, key) => api(path).then((v) => { state[key] = v; }).catch(() => {});

async function loadBanks() {
  try {
    const b = await api('/banks', { auth: false });
    state.banks = b.banks;
    state.bankFeeKobo = b.bankFeeKobo;
  } catch { state.banks = state.banks || []; }
}

function readCache() {
  try { return JSON.parse(store.get(WALLET_CACHE) || 'null'); } catch { return null; }
}

// Loads the wallet. If the server cannot be reached, shows the last saved wallet.
async function loadWallet() {
  try {
    state.wallet = await api('/wallet');
    state.offline = false;
    store.set(WALLET_CACHE, JSON.stringify(state.wallet));
    return state.wallet;
  } catch (e) {
    const cached = readCache();
    if (cached && /Cannot reach/.test(e.message)) {
      state.wallet = cached;
      state.offline = true;
      return cached;
    }
    throw e;
  }
}

function logout() {
  store.del('lp_token');
  store.del(WALLET_CACHE);
  state.wallet = null;
  state.offline = false;
  state.history = null;
  state.rewards = null;
  state.rewardsList = null;
  state.receipt = null;
  state.support = null;
  state.adminThread = null;
  stopSupportPolling();
  state.stack = [];
  state.authMode = 'login';
  navigate('login');
}

function nextScreen() {
  const w = state.wallet;
  if (!w.email_verified) return 'verify-email';
  if (w.is_admin) return 'admin';
  return w.kyc_verified ? 'home' : 'verify';
}

// ---------- navigation ----------
// opts.push: remember the current screen so Back can return to it.
async function navigate(screen, opts = {}) {
  if (screen !== 'login' && !store.get('lp_token')) screen = 'login';
  if (opts.push && state.screen && state.screen !== screen) state.stack.push(state.screen);
  if (state.stack.length > 20) state.stack.splice(0, state.stack.length - 20);
  if (TABS.includes(screen) || screen === 'login') state.stack = [];
  state.screen = screen;
  stopSupportPolling();
  if (screen === 'support') supportTimer = setInterval(refreshSupport, 8000);

  if (screen !== 'login' && !state.wallet) {
    try { await loadWallet(); } catch (e) { toast(e.message); }
  }
  await loadFor(screen, opts);
  render();
}

// Fetches what one screen needs. Everything else is already in state.
async function loadFor(screen, opts) {
  const tasks = [];
  const g = (path, key) => tasks.push(grab(path, key));
  switch (screen) {
    case 'home':
      g('/rewards', 'rewards'); g('/wallet/history', 'history'); g('/checkin', 'checkin');
      g('/notifications', 'notifications'); g('/reminders', 'reminders');
      break;
    case 'history': g('/wallet/history', 'history'); break;
    case 'rewards':
      g('/rewards', 'rewards'); g('/rewards/list', 'rewardsList'); g('/checkin', 'checkin'); g('/leaderboard', 'leaderboard');
      break;
    case 'goals': case 'me': case 'balance': g('/goals', 'goals'); break;
    case 'send':
      if (!opts.keepPrefill) state.prefill = null;
      state.idem = newId();
      g('/beneficiaries', 'beneficiaries'); g('/recents', 'recents');
      if (!state.banks) tasks.push(loadBanks());
      break;
    case 'request': g('/requests', 'requests'); break;
    case 'insights': g('/insights', 'insights'); break;
    case 'schedules': g('/schedules', 'schedules'); g('/goals', 'goals'); break;
    case 'reminders': g('/reminders', 'reminders'); break;
    case 'limits': g('/limits', 'limits'); break;
    case 'settings': g('/me/settings', 'settings'); g('/goals', 'goals'); break;
    case 'airtime': state.idem = newId(); break;
    case 'support': g('/support', 'support'); break;
    case 'receipt':
      state.receipt = null;
      tasks.push(api(`/wallet/receipt/${encodeURIComponent(state.receiptId)}`)
        .then((r) => { state.receipt = r; })
        .catch((e) => toast(e.message)));
      break;
    case 'admin':
      tasks.push(fetchAdmin('')
        .then((a) => { state.admin = a; })
        .catch((e) => { toast(e.message); state.admin = null; }));
      break;
    default: break;
  }
  await Promise.all(tasks);

  if (screen === 'notifications') {
    // Mark as read once the list is in. Failure does not matter here.
    api('/notifications/read', { method: 'POST' }).catch(() => {});
  }
}

function render() {
  $app.innerHTML = view();
  window.scrollTo(0, 0);
  // Keep the newest chat message in view.
  for (const id of ['support-msgs', 'admin-msgs']) {
    const box = document.getElementById(id);
    if (box) box.scrollTop = box.scrollHeight;
  }
}

const VIEWS = {
  login: () => authView(),
  verify: () => verifyView(),
  'verify-email': () => verifyEmailView(),
  home: () => homeView(),
  more: () => moreView(),
  me: () => meView(),
  balance: () => balanceView(),
  send: () => sendView(),
  request: () => requestView(),
  split: () => splitView(),
  deposit: () => depositView(),
  history: () => historyView(),
  receipt: () => receiptView(),
  rewards: () => rewardsView(),
  goals: () => goalsView(),
  airtime: () => airtimeView(),
  insights: () => insightsView(),
  schedules: () => schedulesView(),
  reminders: () => remindersView(),
  notifications: () => notificationsView(),
  limits: () => limitsView(),
  help: () => helpView(),
  support: () => supportView(),
  security: () => securityView(),
  settings: () => settingsView(),
  profile: () => profileView(),
  admin: () => adminView(),
};

function view() {
  const fn = VIEWS[state.screen] || VIEWS.login;
  return fn();
}

// ---------- admin panel data (admin accounts only; the server checks this on every call) ----------
async function fetchAdmin(query) {
  const [stats, users, payouts, bills, settings, support] = await Promise.all([
    api('/admin/stats'),
    api(`/admin/users?q=${encodeURIComponent(query)}`),
    api('/admin/payouts'),
    api('/admin/bills'),
    api('/admin/settings'),
    api('/admin/support'),
  ]);
  return { stats, users, payouts, bills, settings, support, query };
}

// ---------- live chat polling (only while the support screen is open) ----------
let supportTimer = null;
function stopSupportPolling() {
  if (supportTimer) clearInterval(supportTimer);
  supportTimer = null;
}

// Fetches new messages. Re-draws the whole screen only when the user is not typing.
async function refreshSupport() {
  if (state.screen !== 'support') return;
  try {
    state.support = await api('/support', { quiet: true });
  } catch { return; }
  if (state.screen !== 'support') return;
  const input = document.querySelector('form[data-form="support-send"] input[name="body"]');
  if (input && input.value === '') { render(); return; }
  const box = document.getElementById('support-msgs');
  if (box) {
    box.innerHTML = chatMessagesHtml(state.support.messages, 'user');
    box.scrollTop = box.scrollHeight;
  }
}

// ---------- form actions (data-form="...") ----------
const SUBMIT = {
  async login(d) {
    const r = await api('/auth/login', { method: 'POST', body: { identifier: d.identifier.trim(), pin: d.pin }, auth: false });
    store.set('lp_token', r.token);
    state.wallet = null;
    await loadWallet();
    state.stack = [];
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
      body: {
        toAccount: d.toAccount.trim(),
        amount: toKobo(d.amount),
        pin: d.pin,
        idemKey: state.idem,
        saveAs: d.saveAs?.trim() || undefined,
        note: d.note?.trim() || undefined,
        requestId: d.requestId ? Number(d.requestId) : undefined,
      },
    });
    state.idem = newId();
    state.prefill = null;
    state.wallet = null;
    toast(d.requestId ? 'Request paid.' : 'Sent.');
    navigate('home');
  },

  async 'send-bank'(d) {
    await api('/transfer/bank', {
      method: 'POST',
      body: {
        accountNumber: d.accountNumber.trim(),
        bankCode: d.bankCode,
        amount: toKobo(d.amount),
        pin: d.pin,
        idemKey: state.idem,
        saveAs: d.saveAs?.trim() || undefined,
        note: d.note?.trim() || undefined,
      },
    });
    state.idem = newId();
    state.prefill = null;
    state.wallet = null;
    toast('Transfer is processing. You will see it in your history.');
    navigate('home');
  },

  async request(d) {
    await api('/requests', {
      method: 'POST',
      body: { toAccount: d.toAccount.trim(), amount: toKobo(d.amount), note: d.note?.trim() || '' },
    });
    toast('Request sent.');
    navigate('request');
  },

  async split(d) {
    const accounts = String(d.accounts || '').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    await api('/requests/split', {
      method: 'POST',
      body: { accounts, totalKobo: toKobo(d.total), note: d.note?.trim() || '' },
    });
    toast('Split requests sent.');
    navigate('home');
  },

  async reminder(d) {
    await api('/reminders', {
      method: 'POST',
      body: { title: d.title.trim(), amountKobo: d.amount ? toKobo(d.amount) : 0, due: d.due },
    });
    toast('Reminder saved.');
    navigate('reminders');
  },

  async schedule(d) {
    await api('/schedules', {
      method: 'POST',
      body: {
        kind: d.kind,
        label: d.label?.trim() || '',
        amount: toKobo(d.amount),
        frequency: d.frequency,
        toAccount: d.toAccount?.trim() || '',
        goalId: d.goalId ? Number(d.goalId) : undefined,
        pin: d.pin,
      },
    });
    toast('Schedule created.');
    navigate('schedules');
  },

  async budget(d) {
    await api('/budgets', { method: 'POST', body: { category: d.category, limitKobo: toKobo(d.limit) } });
    toast('Budget saved.');
    navigate('insights');
  },

  async 'support-send'(d) {
    await api('/support/messages', { method: 'POST', body: { body: d.body.trim() } });
    state.support = await api('/support');
    render();
  },

  async 'support-reply'(d) {
    await api(`/admin/support/${encodeURIComponent(d.id)}/reply`, { method: 'POST', body: { body: d.body.trim() } });
    state.adminThread = await api(`/admin/support/${encodeURIComponent(d.id)}`);
    state.admin = await fetchAdmin(state.admin?.query || '');
    render();
  },

  async roundup(d) {
    await api('/me/roundup', { method: 'PATCH', body: { goalId: d.goalId ? Number(d.goalId) : null } });
    toast('Saved.');
    navigate('settings');
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
  // Money out needs the PIN or a fingerprint approval.
  if (form.hasAttribute('data-approval') && !d.approval && !/^\d{4}$/.test(d.pin || '')) {
    toast('Enter your 4-digit PIN, or use fingerprint.');
    return;
  }
  const btn = form.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;
  try {
    await SUBMIT[kind](d);
  } catch (err) {
    toast(err.message);
    // A fingerprint approval works once. Clear it so the next try asks again.
    const a = form.querySelector('input[name="approval"]');
    if (a) {
      a.value = '';
      const s = form.querySelector('.fp-status');
      if (s) s.textContent = '';
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Shows the name behind a wallet number or bank account before money is sent.
async function runLookup(form) {
  const out = form.querySelector('.recipient');
  if (!out) return;
  out.className = 'recipient';
  out.textContent = '';
  const f = new FormData(form);
  try {
    if (form.dataset.form === 'send-wallet' || form.dataset.form === 'request') {
      const acc = String(f.get('toAccount') || '');
      if (!/^\d{10}$/.test(acc)) return;
      const r = await api(`/lookup/wallet?account=${encodeURIComponent(acc)}`);
      out.textContent = (form.dataset.form === 'request' ? 'Requesting from: ' : 'Sending to: ') + r.name;
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

// Fills the send form from a saved person or recent contact, then checks the name.
function prefillSend(type, prefill) {
  state.sendType = type;
  state.prefill = prefill;
  render();
  const form = $app.querySelector('form[data-lookup-form]');
  if (form) runLookup(form);
}

// ---------- button actions (data-act="...") ----------
const ACTIONS = {
  'auth-mode'(el) { state.authMode = el.dataset.mode; render(); },
  'approve-fp'(el) { fpApprove(el); },
  'fp-login'() { fpLogin(); },
  'fp-register'() { fpRegister(); },

  back() {
    if (state.screen === 'login') { state.authMode = 'login'; render(); return; }
    if (state.screen === 'verify-email') { logout(); return; }
    const prev = state.stack.pop();
    navigate(prev || 'home');
  },

  logout() { logout(); },

  'go-send'(el) {
    state.sendType = el.dataset.type === 'bank' ? 'bank' : 'wallet';
    navigate('send', { push: true });
  },
  'send-type'(el) { state.sendType = el.dataset.type; state.prefill = null; render(); },
  'send-tab'(el) { state.sendTab = el.dataset.tab; render(); },

  'use-recent'(el) {
    if (el.dataset.kind === 'bank') {
      prefillSend('bank', { accountNumber: el.dataset.acc, bankCode: el.dataset.bank });
    } else {
      prefillSend('wallet', { toAccount: el.dataset.acc });
    }
  },

  'use-benef'(el) {
    const b = (state.beneficiaries || []).find((x) => String(x.id) === el.dataset.id);
    if (!b) return;
    prefillSend(b.type === 'bank' ? 'bank' : 'wallet', b.type === 'bank'
      ? { accountNumber: b.accountNumber, bankCode: b.bankCode }
      : { toAccount: b.accountNumber });
  },

  async 'del-benef'(el) {
    try {
      await api(`/beneficiaries/${encodeURIComponent(el.dataset.id)}`, { method: 'DELETE' });
      state.beneficiaries = (state.beneficiaries || []).filter((x) => String(x.id) !== el.dataset.id);
      render();
      toast('Removed.');
    } catch (e) { toast(e.message); }
  },

  'pay-request'(el) {
    const r = (state.requests || []).find((x) => String(x.id) === el.dataset.id);
    if (!r) return;
    state.sendType = 'wallet';
    state.prefill = { toAccount: r.otherAccount, amount: (r.amountKobo / 100).toFixed(2), requestId: r.id };
    navigate('send', { push: true, keepPrefill: true }).then(() => {
      const form = $app.querySelector('form[data-lookup-form]');
      if (form) runLookup(form);
    });
  },

  async 'decline-request'(el) {
    try {
      await api(`/requests/${encodeURIComponent(el.dataset.id)}/decline`, { method: 'POST' });
      toast('Request declined.');
      navigate('request');
    } catch (e) { toast(e.message); }
  },

  async 'del-reminder'(el) {
    try {
      await api(`/reminders/${encodeURIComponent(el.dataset.id)}`, { method: 'DELETE' });
      toast('Reminder removed.');
      navigate('reminders');
    } catch (e) { toast(e.message); }
  },

  async 'cancel-schedule'(el) {
    try {
      await api(`/schedules/${encodeURIComponent(el.dataset.id)}`, { method: 'DELETE' });
      toast('Schedule stopped.');
      navigate('schedules');
    } catch (e) { toast(e.message); }
  },

  async 'del-budget'(el) {
    try {
      await api(`/budgets/${encodeURIComponent(el.dataset.cat)}`, { method: 'DELETE' });
      toast('Budget removed.');
      navigate('insights');
    } catch (e) { toast(e.message); }
  },

  receipt(el) { state.receiptId = el.dataset.id; navigate('receipt', { push: true }); },

  async 'refresh-history'() {
    try { state.history = await api('/wallet/history'); render(); toast('Updated'); } catch (e) { toast(e.message); }
  },

  async checkin() {
    try {
      const r = await api('/checkin', { method: 'POST' });
      toast(`Checked in. You got ${naira(r.bonusKobo)}.`);
      await Promise.all([grab('/checkin', 'checkin'), loadWallet()]);
      render();
    } catch (e) { toast(e.message); }
  },

  'toggle-hide'() {
    store.set('lp_hide', store.get('lp_hide') === '1' ? '0' : '1');
    render();
  },

  'toggle-theme'() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const next = isDark ? 'light' : 'dark';
    applyTheme(next);
    store.set('lp_theme', next);
    render();
  },

  async 'show-qr'() {
    const el = document.getElementById('qr');
    if (!el || !state.wallet) return;
    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js', 'QRCode');
      el.className = 'qr-box';
      el.innerHTML = '';
      new QRCode(el, { text: state.wallet.account_number, width: 180, height: 180, colorDark: '#1B1145', colorLight: '#FFFFFF' });
    } catch {
      toast('Could not load the QR code. Check your internet.');
    }
  },

  'share-code'(el) {
    const code = el.dataset.code;
    const text = `Join Legendary Pay with my code ${code}`;
    if (navigator.share) {
      navigator.share({ title: 'Legendary Pay', text }).catch(() => {});
    } else {
      ACTIONS.copy({ dataset: { copy: text } });
    }
  },

  copy(el) {
    const text = el.dataset.copy;
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Copied'), () => toast(text));
    else toast(text);
  },

  async 'resend-verify'() {
    try { await api('/auth/resend-verify', { method: 'POST' }); toast('A new code is on its way.'); } catch (e) { toast(e.message); }
  },

  async 'admin-thread'(el) {
    try {
      state.adminThread = await api(`/admin/support/${encodeURIComponent(el.dataset.id)}`);
      render();
    } catch (e) { toast(e.message); }
  },

  async 'admin-close-thread'(el) {
    try {
      await api(`/admin/support/${encodeURIComponent(el.dataset.id)}/close`, { method: 'POST' });
      state.adminThread = null;
      state.admin = await fetchAdmin(state.admin?.query || '');
      render();
      toast('Chat closed.');
    } catch (e) { toast(e.message); }
  },

  async 'admin-kyc'(el) {
    try {
      await api(`/admin/kyc/${encodeURIComponent(el.dataset.id)}`, { method: 'POST', body: { verified: el.dataset.to === 'true' } });
      state.admin = await fetchAdmin(state.admin?.query || '');
      render();
      toast(el.dataset.to === 'true' ? 'ID verified.' : 'ID unverified.');
    } catch (e) { toast(e.message); }
  },
};

// ---------- wiring ----------
// A click goes to the closest button action or navigation link, whichever is more specific.
$app.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]');
  const go = e.target.closest('[data-go]');
  if (act && (!go || go.contains(act))) {
    const fn = ACTIONS[act.dataset.act];
    if (fn) fn(act);
    return;
  }
  if (go) navigate(go.dataset.go, { push: true });
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
  applyTheme(store.get('lp_theme'));
  if (!API) {
    $app.innerHTML = `<div class="card center"><p>The app is not connected yet. Set API_BASE in config.js.</p></div>`;
    return;
  }
  if (store.get('lp_token')) {
    try {
      await loadWallet();
      await navigate(nextScreen());
      return;
    } catch {
      // token invalid or server unreachable: fall through to login
    }
  }
  navigate('login');
})();
