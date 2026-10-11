// Legendary Pay screens. Each function returns HTML for one page. Data lives in state (app.js).

// ---------- shared pieces ----------
function nav(active) {
  const item = (id, ico, label) =>
    `<button data-go="${id}" class="${active === id ? 'on' : ''}"><span class="ico">${ico}</span>${label}</button>`;
  return `<nav class="nav">
    ${item('home', '🏠', 'Home')}
    ${item('rewards', '🎁', 'Rewards')}
    ${item('history', '🧾', 'History')}
    ${item('goals', '🎯', 'Save')}
    ${item('me', '👤', 'Me')}
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

function loadingView(label = 'Loading…') {
  return `<div class="app-inner"><p class="center muted">${esc(label)}</p></div>`;
}

// A row inside a card, tappable when it has data-go or data-act.
function rowLine(title, right = '›', sub = '', attrs = '') {
  return `<div class="row-line" ${attrs}><div><div class="t-title">${esc(title)}</div>${sub ? `<div class="t-meta">${esc(sub)}</div>` : ''}</div><span class="muted">${esc(right)}</span></div>`;
}

// A big icon button for grids.
function gItem(attrs, ico, label) {
  return `<button ${attrs}><span class="gico">${ico}</span>${esc(label)}</button>`;
}

const firstName = (w) => ((w.full_name || w.email || '').split(' ')[0]) || 'there';
const bankName = (code) => ((state.banks || []).find((b) => b.code === code) || {}).name || code;
const daysUntil = (ymd) => Math.round((new Date(ymd + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000);
const totalKobo = () => {
  const w = state.wallet || {};
  const goals = (state.goals || []).reduce((s, g) => s + g.savedKobo, 0);
  return Number(w.mainKobo || 0) + Number(w.bonusKobo || 0) + goals;
};

// ---------- sign in and verification ----------
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
        <button type="button" class="secondary" data-act="fp-login">Log in with fingerprint</button>
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

function changeEmailForm() {
  return `<form data-form="change-email">
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
      <p class="sub">Your name must match your BVN or NIN exactly. We use it to open your funding account. Your ID number is never stored, only a secure fingerprint.</p>
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

// ---------- home and main tabs ----------
function homeView() {
  const w = state.wallet;
  if (!w) return loadingView('Loading your wallet…');
  const ck = state.checkin || {};
  const recent = (state.history || []).slice(0, 1);
  const unread = (state.notifications || []).filter((n) => !n.read).length;
  const due = (state.reminders || []).filter((x) => daysUntil(x.due) <= 3);
  const hidden = store.get('lp_hide') === '1';
  return `<div class="app-inner">
    <div class="row-between" style="padding:6px 0 12px">
      <div class="row-between" style="gap:10px">
        <div class="avatar" style="width:40px;height:40px;font-size:15px">${esc(initials(w.full_name || w.email))}</div>
        <div><div class="muted" style="font-size:13px">Hi,</div><strong>${esc(firstName(w))}</strong></div>
      </div>
      <div class="row-between" style="gap:6px">
        <button class="small secondary" data-go="notifications" aria-label="Notifications">🔔${unread ? '<span class="dot-unread"></span>' : ''}</button>
        <button class="small secondary" data-go="help" aria-label="Help">🎧</button>
      </div>
    </div>

    ${state.offline ? `<div class="notice">You are offline. Showing your last saved balance.</div>` : ''}
    ${w.is_admin ? `<div class="banner"><span>You are an admin.</span><button class="small" data-go="admin">Admin panel</button></div>` : ''}
    ${w.kyc_verified ? '' : `<div class="banner"><span>Verify your identity to get your funding account and send to banks.</span><button class="small" data-go="verify">Verify</button></div>`}
    ${due.length ? `<div class="notice">Reminder: <strong>${esc(due[0].title)}</strong> is due ${esc(due[0].due)}. <button class="link" data-go="reminders">See reminders</button></div>` : ''}

    <div class="card hero">
      <div class="row-between">
        <span class="label">Available balance</span>
        <button class="small secondary" data-act="toggle-hide">${hidden ? 'Show' : 'Hide'}</button>
      </div>
      <div class="amount">${hidden ? '₦ ••••••' : naira(w.mainKobo)}</div>
      <div class="row">
        <span>Wallet ${esc(w.account_number)}</span>
        <button class="small secondary" data-act="copy" data-copy="${esc(w.account_number)}">Copy</button>
      </div>
      <div style="margin-top:12px"><button class="small" style="background:#fff;color:#4B1FB0" data-go="deposit">+ Add money</button></div>
    </div>

    ${recent.length ? `<div class="card" style="padding:14px 18px;cursor:pointer" data-go="history">
      <div class="row-between"><span>${esc(TX_LABELS[recent[0].kind] || recent[0].kind)} · <span class="muted">${esc(when(recent[0].at))}</span></span>
      <span class="${recent[0].amountKobo < 0 ? 'amt-out' : 'amt-in'}">${recent[0].amountKobo < 0 ? '-' : '+'}${naira(Math.abs(recent[0].amountKobo))}</span></div>
    </div>` : ''}

    <div class="card row-between">
      <div><strong>Daily check-in</strong>
        <p class="sub" style="margin:4px 0 0">${ck.doneToday ? 'Done today. Come back tomorrow.' : `Streak ${ck.streak || 0} day(s). Next bonus ${naira(ck.nextBonusKobo || 1000)}`}</p></div>
      <button class="small" data-act="checkin" ${ck.doneToday ? 'disabled' : ''}>${ck.doneToday ? 'Done' : 'Check in'}</button>
    </div>

    <div class="grid4">
      ${gItem('data-act="go-send" data-type="wallet"', '↗', 'To wallet')}
      ${gItem('data-act="go-send" data-type="bank"', '🏦', 'To bank')}
      ${gItem('data-go="request"', '📥', 'Request')}
      ${gItem('data-go="split"', '➗', 'Split')}
      ${gItem('data-go="goals"', '🎯', 'Save')}
      ${gItem('data-go="airtime"', '📱', 'Airtime')}
      ${gItem('data-go="insights"', '📊', 'Insights')}
      ${gItem('data-go="more"', '⋯', 'More')}
    </div>

    <div class="card" style="background:linear-gradient(135deg,#7B3FF2,#4B1FB0);border:none" data-go="rewards">
      <strong>Invite friends, earn rewards</strong>
      <p class="sub" style="color:#E7DCFF;margin:4px 0 0">You earn when they deposit ₦500 or more.</p>
    </div>

    <div class="section">Recent activity</div>
    <div class="card">${(state.history || []).length ? txList((state.history || []).slice(0, 4)) : '<p class="muted" style="margin:0">No transactions yet.</p>'}</div>
  </div>
  ${nav('home')}`;
}

function moreView() {
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>All services</h2></div>
    <div class="section">Send and request</div>
    <div class="card">
      <div class="grid4" style="margin:0">
        ${gItem('data-act="go-send" data-type="wallet"', '↗', 'To wallet')}
        ${gItem('data-act="go-send" data-type="bank"', '🏦', 'To bank')}
        ${gItem('data-go="request"', '📥', 'Request')}
        ${gItem('data-go="split"', '➗', 'Split bill')}
        ${gItem('data-go="schedules"', '🔁', 'Scheduled')}
        ${gItem('data-go="deposit"', '↙', 'Deposit')}
      </div>
    </div>
    <div class="section">Save and grow</div>
    <div class="card">
      <div class="grid4" style="margin:0">
        ${gItem('data-go="goals"', '🎯', 'Savings goals')}
        ${gItem('data-go="rewards"', '🎁', 'Rewards')}
        ${gItem('data-go="insights"', '📊', 'Insights')}
        ${gItem('data-go="reminders"', '⏰', 'Reminders')}
      </div>
    </div>
    <div class="section">Bills</div>
    <div class="card">
      <div class="grid4" style="margin:0">
        ${gItem('data-go="airtime"', '📱', 'Airtime')}
      </div>
    </div>
    <div class="section">Account</div>
    <div class="card">
      <div class="grid4" style="margin:0">
        ${gItem('data-go="limits"', '🔓', 'Limits')}
        ${gItem('data-go="security"', '🛡️', 'Security')}
        ${gItem('data-go="notifications"', '🔔', 'Alerts')}
        ${gItem('data-go="support"', '💬', 'Live chat')}
        ${gItem('data-go="help"', '🎧', 'Help')}
        ${gItem('data-go="settings"', '⚙️', 'Settings')}
      </div>
    </div>
  </div>${nav('me')}`;
}

function meView() {
  const w = state.wallet;
  if (!w) return loadingView();
  return `<div class="app-inner">
    <div class="row-between" style="padding:6px 0 12px">
      <div class="row-between" style="gap:12px">
        <div class="avatar">${esc(initials(w.full_name || w.email))}</div>
        <div><strong>${esc(w.full_name || 'Add your name')}</strong>
          <div>${w.kyc_verified ? '<span class="pill">Verified</span>' : '<span class="muted" style="font-size:13px">Not verified</span>'}</div></div>
      </div>
      <button class="small secondary" data-go="settings" aria-label="Settings">⚙️</button>
    </div>

    <div class="card" data-go="balance" style="cursor:pointer">
      <span class="muted">Total balance</span>
      <div style="font-size:26px;font-weight:800;margin-top:4px">${naira(totalKobo())}</div>
    </div>

    <div class="tile3">
      <button data-go="history">🧾<br>Transactions</button>
      <button data-go="limits">🔓<br>Limits</button>
      <button data-go="security">🛡️<br>Security</button>
    </div>

    <div class="card">
      ${rowLine('Profile info', '›', `${w.phone} · ${w.email}`, 'data-go="profile"')}
      ${rowLine('Bank account', '›', w.account_number, 'data-go="deposit"')}
      ${rowLine('Savings goals', '›', '', 'data-go="goals"')}
      ${rowLine('Invitation', '›', 'Earn rewards for friends', 'data-go="rewards"')}
      ${rowLine('Help', '›', '', 'data-go="help"')}
      ${rowLine('Settings', '›', '', 'data-go="settings"')}
    </div>
    <div class="card" style="text-align:center"><button class="secondary" data-act="logout" style="color:var(--danger)">Sign out</button></div>
  </div>${nav('me')}`;
}

function balanceView() {
  const w = state.wallet || {};
  const goals = state.goals || [];
  const saved = goals.reduce((s, g) => s + g.savedKobo, 0);
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Total balance</h2></div>
    <div class="card hero">
      <p class="label">Total balance</p>
      <div class="amount">${naira(totalKobo())}</div>
    </div>
    <div class="card">
      <div class="row-between"><span class="muted">Wallet (spend)</span><strong>${naira(w.mainKobo)}</strong></div>
      <div class="row-between" style="margin-top:12px"><span class="muted">Bonus</span><strong>${naira(w.bonusKobo)}</strong></div>
      <div class="row-between" style="margin-top:12px"><span class="muted">Savings goals</span><strong>${naira(saved)}</strong></div>
    </div>
    <p class="note center">Money in a savings goal is locked until you move it back to your wallet.</p>
  </div>${nav('me')}`;
}

// ---------- sending money ----------
function recentList(isBank) {
  const r = state.recents || {};
  const rows = isBank
    ? (r.banks || []).map((b) => rowLine(bankName(b.bankCode), '›', b.accountNumber,
      `data-act="use-recent" data-kind="bank" data-acc="${esc(b.accountNumber)}" data-bank="${esc(b.bankCode)}"`))
    : (r.wallets || []).map((w) => rowLine(w.name, '›', w.accountNumber,
      `data-act="use-recent" data-kind="wallet" data-acc="${esc(w.accountNumber)}"`));
  return `<div class="card">${rows.length ? rows.join('') : '<p class="muted" style="margin:0">No recent people yet.</p>'}</div>`;
}

function favList(isBank) {
  const list = (state.beneficiaries || []).filter((b) => b.type === (isBank ? 'bank' : 'wallet'));
  if (!list.length) return `<div class="card"><p class="muted" style="margin:0">No favourites yet. Type "Save this person as" when you send money.</p></div>`;
  return `<div class="card">${list.map((b) => `<div class="row-line" data-act="use-benef" data-id="${esc(b.id)}">
    <div><div class="t-title">${esc(b.label)}</div><div class="t-meta">${esc(b.accountNumber)}</div></div>
    <button class="small secondary" data-act="del-benef" data-id="${esc(b.id)}" aria-label="Remove">✕</button>
  </div>`).join('')}</div>`;
}

function sendView() {
  const isBank = state.sendType === 'bank';
  const banks = (state.banks || []);
  const p = state.prefill || {};
  const tab = state.sendTab || 'recent';
  const walletForm = `
    <form data-form="send-wallet" data-lookup-form data-approval>
      <label>Recipient wallet number<input name="toAccount" inputmode="numeric" maxlength="10" pattern="\\d{10}" data-lookup required value="${esc(p.toAccount || '')}"></label>
      <div class="recipient"></div>
      <label>Amount (₦)<input name="amount" inputmode="decimal" placeholder="0.00" required value="${esc(p.amount || '')}"></label>
      <label>Note (optional)<input name="note" maxlength="60" placeholder="e.g. Thanks for lunch"></label>
      ${approvalBlock()}
      <label>Save this person as (optional)<input name="saveAs" maxlength="40" placeholder="e.g. Mum"></label>
      <input type="hidden" name="idemKey" value="${esc(state.idem)}">
      <input type="hidden" name="requestId" value="${esc(p.requestId || '')}">
      <button type="submit">${p.requestId ? 'Pay request' : 'Send'}</button>
    </form>`;
  const bankForm = `
    <form data-form="send-bank" data-lookup-form data-approval>
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
      <label>Note (optional)<input name="note" maxlength="60" placeholder="e.g. Rent"></label>
      ${approvalBlock()}
      <label>Save this person as (optional)<input name="saveAs" maxlength="40" placeholder="e.g. Landlord"></label>
      <input type="hidden" name="idemKey" value="${esc(state.idem)}">
      <button type="submit">Send to bank</button>
    </form>`;
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Send money</h2></div>
    <div class="seg">
      <button class="${!isBank ? 'on' : ''}" data-act="send-type" data-type="wallet">To a wallet</button>
      <button class="${isBank ? 'on' : ''}" data-act="send-type" data-type="bank">To a bank</button>
    </div>
    <div class="tabs">
      <button class="${tab === 'recent' ? 'on' : ''}" data-act="send-tab" data-tab="recent">Recent</button>
      <button class="${tab === 'fav' ? 'on' : ''}" data-act="send-tab" data-tab="fav">Favourites</button>
    </div>
    ${tab === 'recent' ? recentList(isBank) : favList(isBank)}
    <div class="card" style="margin-top:14px">${isBank ? bankForm : walletForm}</div>
  </div>`;
}

function requestView() {
  const list = state.requests || [];
  const forMe = list.filter((r) => r.role === 'payer');
  const mine = list.filter((r) => r.role === 'requester');
  const statusText = { pending: 'Waiting', paid: 'Paid', declined: 'Declined' };
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Request money</h2></div>
    <div class="card">
      <form data-form="request" data-lookup-form>
        <label>Their wallet number<input name="toAccount" inputmode="numeric" maxlength="10" pattern="\\d{10}" data-lookup required></label>
        <div class="recipient"></div>
        <label>Amount (₦)<input name="amount" inputmode="decimal" required></label>
        <label>What is it for?<input name="note" maxlength="60" placeholder="e.g. Rent share"></label>
        <button type="submit">Send request</button>
      </form>
    </div>

    <div class="section">Requests for you to pay</div>
    <div class="card">${forMe.length ? forMe.map((r) => `<div class="row-line">
      <div><div class="t-title">${naira(r.amountKobo)} to ${esc(r.otherName)}</div>
        <div class="t-meta">${esc(r.note || 'No note')} · ${esc(when(r.at))}</div>
        <div class="t-meta">${esc(statusText[r.status] || r.status)}</div></div>
      ${r.status === 'pending' ? `<div class="row-between" style="gap:6px">
        <button class="small" data-act="pay-request" data-id="${esc(r.id)}">Pay</button>
        <button class="small secondary" data-act="decline-request" data-id="${esc(r.id)}">No</button></div>` : ''}
    </div>`).join('') : '<p class="muted" style="margin:0">Nothing to pay right now.</p>'}</div>

    <div class="section">Requests you sent</div>
    <div class="card">${mine.length ? mine.map((r) => rowLine(`${naira(r.amountKobo)} from ${r.otherName}`, statusText[r.status] || r.status, `${r.note || 'No note'} · ${when(r.at)}`)).join('') : '<p class="muted" style="margin:0">You have not sent any requests.</p>'}</div>
  </div>${nav('home')}`;
}

function splitView() {
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Split a bill</h2></div>
    <div class="card">
      <form data-form="split">
        <label>Wallet numbers of the people to share with (separate with commas)
          <textarea name="accounts" rows="3" required placeholder="8012345678, 8098765432" style="width:100%;background:var(--card-2);border:1px solid var(--line);color:var(--text);border-radius:14px;padding:14px;font:inherit"></textarea>
        </label>
        <label>Total bill (₦)<input name="total" inputmode="decimal" required></label>
        <label>What is it for?<input name="note" maxlength="60" placeholder="e.g. Dinner"></label>
        <p class="note">Each person, including you, pays an equal share. Each one gets a payment request.</p>
        <button type="submit">Send split requests</button>
      </form>
    </div>
  </div>${nav('home')}`;
}

// ---------- deposit, history, receipts ----------
function depositView() {
  const w = state.wallet;
  if (!w) return loadingView();
  if (!w.kyc_verified || !w.virtual_account) {
    return `<div class="app-inner">
      ${backBtn()}
      <div class="topbar"><h2>Add money</h2></div>
      <div class="card"><p>Verify your identity first to get your personal funding account.</p>
        <button style="margin-top:12px" data-go="verify">Verify now</button></div>
    </div>${nav('home')}`;
  }
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Add money</h2></div>
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
    <div class="card center">
      <p class="sub" style="margin-top:0">Your Legendary wallet QR code. Others can scan it to send you money.</p>
      <button class="secondary" data-act="show-qr">Show QR code</button>
      <div id="qr"></div>
    </div>
  </div>${nav('home')}`;
}

function historyView() {
  const items = state.history || [];
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>History</h2>
      <button class="small secondary" data-act="refresh-history">Refresh</button></div>
    <div class="card">${items.length ? txList(items) : '<p class="muted" style="margin:0">No transactions yet.</p>'}</div>
    <p class="note center">Tap any transaction to see its receipt.</p>
  </div>${nav('history')}`;
}

function txList(items) {
  return `<ul class="list">${items.map((t) => {
    const amt = Number(t.amountKobo || 0);
    const label = TX_LABELS[t.kind] || esc(t.kind);
    const tap = t.id ? `data-act="receipt" data-id="${esc(t.id)}" style="cursor:pointer"` : '';
    return `<li ${tap}>
      <div><div class="t-title">${label}</div><div class="t-meta">${esc(when(t.at))}</div></div>
      <div class="${amt < 0 ? 'amt-out' : 'amt-in'}">${amt < 0 ? '-' : '+'}${naira(Math.abs(amt))}</div>
    </li>`;
  }).join('')}</ul>`;
}

function receiptView() {
  const r = state.receipt;
  if (!r) return `<div class="app-inner">${backBtn()}<p class="center muted">We could not load this receipt. Try again.</p></div>${nav('history')}`;
  const amt = Number(r.amountKobo || 0);
  const statusText = { queued: 'Processing', success: 'Successful', refunded: 'Refunded' };
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Receipt</h2></div>
    <div class="card center">
      <p class="muted" style="margin:0">${esc(TX_LABELS[r.kind] || r.kind)}</p>
      <p class="${amt < 0 ? 'amt-out' : 'amt-in'}" style="font-size:30px;margin:8px 0">${amt < 0 ? '-' : '+'}${naira(Math.abs(amt))}</p>
      <p class="sub" style="margin:0">${esc(when(r.at))}</p>
    </div>
    <div class="card">
      <div class="row-between"><span class="muted">Status</span><strong>${esc(statusText[r.status] || 'Successful')}</strong></div>
      ${r.feeKobo ? `<div class="row-between" style="margin-top:10px"><span class="muted">Fee</span><strong>${naira(r.feeKobo)}</strong></div>` : ''}
      ${r.bankAccount ? `<div class="row-between" style="margin-top:10px"><span class="muted">Bank account</span><strong>${esc(r.bankAccount)}</strong></div>` : ''}
      ${r.note ? `<div class="row-between" style="margin-top:10px"><span class="muted">Note</span><strong>${esc(r.note)}</strong></div>` : ''}
      ${r.reference ? `<div class="row-between" style="margin-top:10px"><span class="muted">Reference</span><strong style="font-size:13px;word-break:break-all">${esc(r.reference)}</strong></div>` : ''}
      <div class="row-between" style="margin-top:10px"><span class="muted">Receipt ID</span><strong style="font-size:12px;word-break:break-all">${esc(r.id)}</strong></div>
    </div>
  </div>${nav('history')}`;
}

// ---------- rewards ----------
function badgeList() {
  const h = state.history || [];
  const r = state.rewards || {};
  const ck = state.checkin || {};
  return [
    ['🚀', 'First transfer', h.some((t) => t.kind === 'internal_transfer' || t.kind === 'bank_transfer')],
    ['🎯', 'Saver', (state.goals || []).some((g) => g.savedKobo > 0)],
    ['🔥', '3-day streak', (ck.streak || 0) >= 3],
    ['🤝', 'Referrer', (r.friends || 0) >= 1],
    ['✅', 'Verified', !!(state.wallet && state.wallet.kyc_verified)],
    ['👑', 'Legend', (ck.streak || 0) >= 7 && !!(state.wallet && state.wallet.kyc_verified)],
  ];
}

function rewardsView() {
  const r = state.rewards || {};
  const ck = state.checkin || {};
  const list = state.rewardsList || [];
  const lb = state.leaderboard || [];
  const code = state.wallet ? state.wallet.referral_code : '';
  const names = { welcome: 'Welcome bonus', referral: 'Referral bonus', cashback: 'Cashback' };
  const st = { paid: 'Paid', pending: 'Pending', void: 'Cancelled' };
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Rewards</h2></div>
    <div class="card hero">
      <p class="label">Rewards paid to you</p>
      <div class="amount">${naira(r.paidKobo)}</div>
      <div class="row"><span>Pending ${naira(r.pendingKobo)}</span><span>Friends ${Number(r.friends || 0)}</span></div>
    </div>

    <div class="card row-between">
      <div><strong>Daily check-in</strong>
        <p class="sub" style="margin:4px 0 0">${ck.doneToday ? 'Done today' : `Streak ${ck.streak || 0} · next bonus ${naira(ck.nextBonusKobo || 1000)}`}</p></div>
      <button class="small" data-act="checkin" ${ck.doneToday ? 'disabled' : ''}>${ck.doneToday ? 'Done' : 'Check in'}</button>
    </div>

    <div class="card">
      <div class="row-between"><span class="muted">Your referral code</span><strong>${esc(code)}</strong></div>
      <div class="row" style="gap:8px;margin-top:12px">
        <button class="small" data-act="copy" data-copy="${esc(code)}">Copy code</button>
        <button class="small secondary" data-act="share-code" data-code="${esc(code)}">Share</button>
      </div>
      <p class="sub" style="margin-top:12px">Earn ₦100 when a friend who signs up with your code deposits ₦500 or more.</p>
    </div>

    <div class="section">Badges</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      ${badgeList().map(([ico, label, got]) => `<div class="badge-card ${got ? '' : 'locked'}"><div class="gico">${ico}</div>${esc(label)}</div>`).join('')}
    </div>

    <div class="section">Leaderboard this month</div>
    <div class="card">${lb.length ? lb.map((x) => `<div class="row-line" style="${x.me ? 'color:var(--brand-2)' : ''}">
      <span>#${x.rank} ${esc(x.name)}${x.me ? ' (you)' : ''}</span><strong>${x.friends} friend(s)</strong></div>`).join('') : '<p class="muted" style="margin:0">No referrals this month yet.</p>'}</div>

    <div class="section">Reward history</div>
    <div class="card">${list.length ? `<ul class="list">${list.map((g) => `<li>
      <div><div class="t-title">${esc(names[g.type] || g.type)}</div>
        <div class="t-meta">${esc(st[g.status] || g.status)} · ${esc(new Date(g.at).toLocaleDateString('en-NG', { dateStyle: 'medium' }))}</div></div>
      <div class="amt-in">+${naira(g.amountKobo)}</div></li>`).join('')}</ul>` : '<p class="muted" style="margin:0">No rewards yet. Share your code to start earning.</p>'}</div>
  </div>${nav('rewards')}`;
}

// ---------- savings, airtime ----------
function goalCard(g) {
  const pct = g.targetKobo ? Math.min(100, Math.round((g.savedKobo / g.targetKobo) * 100)) : 0;
  return `<div class="card">
    <div class="row-between"><strong>${esc(g.name)}</strong><span class="muted">${pct}%</span></div>
    <p class="sub" style="margin:6px 0 10px">${naira(g.savedKobo)} of ${naira(g.targetKobo)}</p>
    <div class="bar"><span style="width:${pct}%"></span></div>
    <form data-form="goal-move" style="margin-top:12px" data-approval>
      <input type="hidden" name="goalId" value="${esc(g.id)}">
      <input type="hidden" name="idemKey" value="${newId()}">
      <label>Direction<select name="direction">
        <option value="in">Save into this goal (from wallet)</option>
        <option value="out">Take out (back to wallet)</option>
      </select></label>
      <label>Amount (₦)<input name="amount" inputmode="decimal" required></label>
      ${approvalBlock()}
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
  </div>${nav('goals')}`;
}

function airtimeView() {
  const networks = [['MTN', 'MTN'], ['GLO', 'Glo'], ['AIRTEL', 'Airtel'], ['9MOBILE', '9mobile']];
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Buy airtime</h2></div>
    <div class="card">
      <form data-form="airtime" data-approval>
        <label>Network
          <select name="network">${networks.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
        </label>
        <label>Phone number<input name="phone" inputmode="tel" placeholder="08012345678" maxlength="11" pattern="0\\d{10}" required></label>
        <label>Amount (₦)<input name="amount" inputmode="decimal" placeholder="500" required></label>
        ${approvalBlock()}
        <input type="hidden" name="idemKey" value="${esc(state.idem)}">
        <button type="submit">Buy airtime</button>
      </form>
    </div>
    <p class="note">If the airtime fails, the money goes back to your wallet.</p>
  </div>${nav('home')}`;
}

// ---------- insights, schedules, reminders ----------
function insightsView() {
  const i = state.insights || { spent: [], incomeKobo: 0, budgets: [] };
  const outTotal = i.spent.reduce((s, x) => s + x.spentKobo, 0);
  const cats = ['internal_transfer', 'bank_transfer', 'bill_airtime', 'goal_deposit'];
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Spending insights</h2></div>
    <div class="card">
      <div class="row-between"><span class="muted">Money in (30 days)</span><strong class="amt-in">${naira(i.incomeKobo)}</strong></div>
      <div class="row-between" style="margin-top:10px"><span class="muted">Money out (30 days)</span><strong>${naira(outTotal)}</strong></div>
    </div>
    <div class="section">Where it went</div>
    <div class="card">${i.spent.length ? i.spent.map((x) => `<div class="bar-row">
      <div class="row-between"><span>${esc(TX_LABELS[x.kind] || x.kind)}</span><strong>${naira(x.spentKobo)}</strong></div>
      <div class="bar"><span style="width:${Math.min(100, Math.round((x.spentKobo / (outTotal || 1)) * 100))}%"></span></div>
    </div>`).join('') : '<p class="muted" style="margin:0">No spending in the last 30 days.</p>'}</div>

    <div class="section">Budgets</div>
    <div class="card">
      ${i.budgets.length ? i.budgets.map((b) => {
        const pct = Math.min(100, Math.round((b.spentKobo / b.limitKobo) * 100));
        const over = b.spentKobo > b.limitKobo;
        return `<div class="bar-row">
          <div class="row-between"><span>${esc(TX_LABELS[b.category] || b.category)}</span><span class="${over ? 'amt-out' : ''}">${naira(b.spentKobo)} / ${naira(b.limitKobo)}</span></div>
          <div class="bar"><span style="width:${pct}%;${over ? 'background:var(--danger)' : ''}"></span></div>
          ${over ? '<p class="note" style="color:var(--danger)">Over budget this month</p>' : ''}
          <button class="link" data-act="del-budget" data-cat="${esc(b.category)}">Remove</button>
        </div>`;
      }).join('') : '<p class="muted" style="margin:0">No budgets yet. Add one below.</p>'}
      <form data-form="budget" style="margin-top:12px">
        <label>Category<select name="category">${cats.map((c) => `<option value="${c}">${esc(TX_LABELS[c])}</option>`).join('')}</select></label>
        <label>Monthly limit (₦)<input name="limit" inputmode="decimal" required></label>
        <button type="submit">Save budget</button>
      </form>
    </div>
  </div>${nav('home')}`;
}

function schedulesView() {
  const list = state.schedules || [];
  const goals = state.goals || [];
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Scheduled payments</h2></div>
    <p class="sub">Repeat a payment or saving automatically. You confirm each new schedule with your PIN.</p>
    <div class="card">${list.length ? list.map((s) => `<div class="row-line">
      <div><div class="t-title">${esc(s.label)}</div>
        <div class="t-meta">${naira(s.amountKobo)} · ${esc(s.frequency)} · next ${esc(s.next)}</div>
        <div class="t-meta">${s.kind === 'save' ? 'Into a goal' : 'To wallet ' + esc(s.toAccount)}</div></div>
      <button class="small secondary" data-act="cancel-schedule" data-id="${esc(s.id)}">Stop</button>
    </div>`).join('') : '<p class="muted" style="margin:0">No schedules yet.</p>'}</div>

    <div class="section">New schedule</div>
    <div class="card">
      <form data-form="schedule" data-approval>
        <label>What is it?<select name="kind"><option value="transfer">Send to a wallet</option><option value="save">Save into a goal</option></select></label>
        <label>Name<input name="label" maxlength="40" placeholder="e.g. Rent to Mum"></label>
        <label>Amount (₦)<input name="amount" inputmode="decimal" required></label>
        <label>How often<select name="frequency"><option value="weekly">Every week</option><option value="monthly">Every month</option></select></label>
        <label>Recipient wallet number (for sending)<input name="toAccount" inputmode="numeric" maxlength="10"></label>
        <label>Goal (for saving)<select name="goalId"><option value="">Choose a goal</option>${goals.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select></label>
        ${approvalBlock()}
        <button type="submit">Create schedule</button>
      </form>
    </div>
  </div>${nav('home')}`;
}

function remindersView() {
  const list = state.reminders || [];
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Bill reminders</h2></div>
    <div class="card">${list.length ? list.map((x) => {
      const d = daysUntil(x.due);
      return `<div class="row-line">
        <div><div class="t-title">${esc(x.title)}</div>
          <div class="t-meta">${x.amountKobo ? naira(x.amountKobo) + ' · ' : ''}due ${esc(x.due)}${d < 0 ? ' (overdue)' : d <= 3 ? ' (soon)' : ''}</div></div>
        <button class="small secondary" data-act="del-reminder" data-id="${esc(x.id)}" aria-label="Remove">✕</button>
      </div>`;
    }).join('') : '<p class="muted" style="margin:0">No reminders yet.</p>'}</div>
    <div class="section">New reminder</div>
    <div class="card">
      <form data-form="reminder">
        <label>What is it for?<input name="title" maxlength="60" required placeholder="e.g. DSTV, Rent"></label>
        <label>Amount (₦, optional)<input name="amount" inputmode="decimal" placeholder="0.00"></label>
        <label>Due date<input name="due" type="date" required></label>
        <button type="submit">Save reminder</button>
      </form>
    </div>
  </div>${nav('home')}`;
}

function notificationsView() {
  const list = state.notifications || [];
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Notifications</h2></div>
    <div class="card">${list.length ? list.map((n) => `<div class="row-line" style="align-items:flex-start">
      <div><div class="t-title">${esc(n.title)}</div><div class="t-meta" style="white-space:normal">${esc(n.body)}</div>
        <div class="t-meta">${esc(when(n.at))}</div></div></div>`).join('') : '<p class="muted" style="margin:0">No notifications yet.</p>'}</div>
  </div>${nav('home')}`;
}

// ---------- account, security, help, settings ----------
function limitsView() {
  const l = state.limits || {};
  const pct = l.limitKobo ? Math.min(100, Math.round(((l.usedKobo || 0) / l.limitKobo) * 100)) : 0;
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Account limits</h2></div>
    <div class="card">
      <div class="row-between"><span class="muted">Account status</span><strong>${l.verified ? 'Verified' : 'Not verified'}</strong></div>
      <div class="row-between" style="margin-top:10px"><span class="muted">Used today</span><strong>${naira(l.usedKobo)}</strong></div>
      <div class="row-between" style="margin-top:10px"><span class="muted">Daily limit</span><strong>${naira(l.limitKobo)}</strong></div>
      <div class="bar" style="margin-top:14px"><span style="width:${pct}%"></span></div>
    </div>
    <div class="section">What each level allows</div>
    <div class="card">
      <div class="row-line"><div><div class="t-title">Not verified</div><div class="t-meta">Wallet to wallet only</div></div><strong>₦5,000 / day</strong></div>
      <div class="row-line"><div><div class="t-title">Verified (BVN or NIN)</div><div class="t-meta">Wallet and bank transfers</div></div><strong>₦500,000 / day</strong></div>
    </div>
    ${l.verified ? '' : '<div class="card"><button data-go="verify">Verify my identity</button></div>'}
  </div>${nav('me')}`;
}

function helpView() {
  const faqs = [
    ['How do I add money?', 'Tap + Add money on Home and send from your bank to your Legendary account number.'],
    ['Why was my transfer not received?', 'Check History. If it shows as sent, tap it for the receipt and reference.'],
    ['I forgot my PIN', 'On the login screen tap Forgot PIN. We email you a code.'],
    ['How do I change my email?', 'Me → Profile info. You will need your PIN and must verify the new email.'],
  ];
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Help</h2></div>
    <div class="card">${faqs.map(([q, a]) => `<div class="row-line" style="display:block"><strong>${esc(q)}</strong><p class="sub" style="margin:6px 0 0">${esc(a)}</p></div>`).join('')}</div>
    <div class="card" style="text-align:center">
      <button data-go="support" style="margin-bottom:12px">Chat with support</button>
      <a href="mailto:legendarylabsupport@gmail.com" style="color:var(--brand-2);font-weight:700;text-decoration:none">Email support</a>
    </div>
  </div>${nav('me')}`;
}

function securityView() {
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Security center</h2></div>
    <div class="card">
      <strong>Fingerprint</strong>
      <p class="sub" style="margin:6px 0 12px">Use this phone's fingerprint or face to log in and to approve every payment. Your fingerprint stays on your phone. Legendary Pay never sees or stores it.</p>
      <button class="secondary" data-act="fp-register">Turn on fingerprint for this phone</button>
    </div>
    <div class="card">
      ${rowLine('Change PIN', '›', 'Needs your current PIN', 'data-go="profile"')}
      ${rowLine('Change email', '›', 'We send a code to the new email', 'data-go="profile"')}
      ${rowLine('Account limits', '›', '', 'data-go="limits"')}
      ${rowLine('Report a problem', '›', 'Tell us about a scam or a failed payment', 'data-go="help"')}
    </div>
    <p class="note">Never share your PIN or your verification code with anyone, including people who say they are from Legendary Pay.</p>
  </div>${nav('me')}`;
}

function settingsView() {
  const s = state.settings || {};
  const goals = state.goals || [];
  const dark = document.documentElement.getAttribute('data-theme') !== 'light';
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Settings</h2></div>
    <div class="card row-between">
      <div><strong>Dark theme</strong><p class="sub" style="margin:4px 0 0">Switch between dark and light purple.</p></div>
      <button class="switch ${dark ? 'on' : ''}" data-act="toggle-theme" aria-pressed="${dark}" aria-label="Dark theme"></button>
    </div>
    <div class="card">
      <form data-form="roundup">
        <label>Round-up savings<select name="goalId">
          <option value="">Off</option>
          ${goals.map((g) => `<option value="${esc(g.id)}" ${s.roundupGoalId === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}
        </select></label>
        <p class="note">Every transfer rounds up to the next ₦100. The difference goes to this goal.</p>
        <button type="submit">Save</button>
      </form>
    </div>
    <div class="card">
      ${rowLine('Profile info', '›', '', 'data-go="profile"')}
      ${rowLine('Notifications', '›', '', 'data-go="notifications"')}
      ${rowLine('Security center', '›', '', 'data-go="security"')}
      ${rowLine('Help', '›', '', 'data-go="help"')}
    </div>
    <div class="card" style="text-align:center"><button class="secondary" data-act="logout" style="color:var(--danger)">Sign out</button></div>
  </div>${nav('me')}`;
}

function profileView() {
  const w = state.wallet;
  if (!w) return loadingView();
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Profile info</h2></div>
    <div class="card">
      ${rowLine('Name', '', w.full_name || 'Not verified yet')}
      ${rowLine('Phone', '', w.phone || '')}
      ${rowLine('Email', '', w.email || '')}
      ${rowLine('Wallet number', '', w.account_number || '')}
      ${rowLine('Referral code', '', w.referral_code || '')}
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
  </div>${nav('me')}`;
}

// ---------- admin panel (admin accounts only; the server checks this on every call) ----------
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

    ${adminSupportCard()}

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

// ---------- the "more" tab for everything else ----------
function when(t) {
  return t ? new Date(t).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}
