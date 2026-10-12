// Support tools (support staff and admins), admin broadcast email, and the bank search on the send screen.
// Loaded after screens.js and bills.js, before app.js. Runs app.js helpers only when the page is used:
// state, api, render, toast, naira, esc, newId, approvalBlock, backBtn, nav, when.
// app.js hooks this file: VIEWS.staff, loadFor('staff'), SUBMIT['staff-*'] / SUBMIT['admin-broadcast'], ACTIONS['staff-pick'].

function isStaff() {
  const w = state.wallet || {};
  return !!(w.is_admin || w.staff_role === 'support');
}

// Compact promo strip for the home screen (same offers as the bill pages, smaller cards).
function homePromo() {
  return `<div class="promo-row" style="margin:0 0 12px;gap:8px">${PROMOS.map((p) => `<button type="button" class="promo" style="background:${p.bg};min-width:200px;padding:12px;gap:2px" ${p.go ? `data-go="${p.go}"` : `data-act="${p.act}" data-cat="${p.cat}"`}>
    <span class="promo-title" style="font-size:14px">${esc(p.title)}</span><span class="promo-sub" style="font-size:12px">${esc(p.sub)}</span></button>`).join('')}</div>`;
}

// ---------- home: slim Support tools and notifications rows (placed at <!--home-extra-->) ----------
const _homeViewStaffBase = homeView;
homeView = function () {
  const html = _homeViewStaffBase();
  if (!state.wallet) return html;
  let extra = BILL_CSS + homePromo();
  if (isStaff()) {
    extra += `<div class="card" style="padding:12px 16px;margin-bottom:10px" data-go="staff">
      <div class="row-between"><strong>Support tools</strong><span class="muted">Open ›</span></div></div>`;
  }
  if (pushSupported() && Notification.permission !== 'granted') {
    extra += `<div class="card" style="padding:12px 16px;margin-bottom:10px">
      <div class="row-between"><strong>Turn on notifications</strong><button class="small" data-act="push-on">Turn on</button></div></div>`;
  }
  return html.replace('<!--home-extra-->', extra);
};

// ---------- push notifications ----------
function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function urlBase64ToUint8Array(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function pushOn() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { toast('Notifications were not allowed on this device.'); render(); return; }
    const reg = await navigator.serviceWorker.ready;
    const { publicKey } = await api('/push/key', { auth: false });
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    await api('/push/subscribe', { method: 'POST', body: sub.toJSON() });
    toast('Notifications are on.');
    render();
  } catch (e) {
    toast(e.message || 'Could not turn on notifications');
  }
}

// ---------- send screen: search the bank list (no automatic bank scanning) ----------
const _sendViewStaffBase = sendView;
sendView = function () {
  return _sendViewStaffBase().replace(
    '<form data-form="send-bank" data-lookup-form data-approval>',
    '<form data-form="send-bank" data-lookup-form data-approval>\n      <label>Search bank<input type="search" data-bank-search placeholder="Type a bank name"></label>');
};

document.addEventListener('input', (e) => {
  const box = e.target;
  if (!(box instanceof HTMLInputElement) || !box.hasAttribute('data-bank-search')) return;
  const form = box.closest('form');
  const sel = form && form.querySelector('select[name="bankCode"]');
  if (!sel) return;
  const term = box.value.trim().toLowerCase();
  const keep = (state.banks || []).filter((b) => !term || b.name.toLowerCase().includes(term));
  const current = sel.value;
  sel.innerHTML = `<option value="">${keep.length ? 'Choose a bank' : 'No bank matches'}</option>` +
    keep.map((b) => `<option value="${esc(b.code)}">${esc(b.name)}</option>`).join('');
  if (keep.some((b) => b.code === current)) sel.value = current;
});

// ---------- admin panel: broadcast email card ----------
function broadcastCard() {
  return `<div class="card">
    <h3 style="font-size:17px;margin-bottom:6px">Email all users</h3>
    <p class="sub">Sends to every verified user who has not unsubscribed. Each email has an unsubscribe link.</p>
    <form data-form="admin-broadcast" data-approval style="margin-top:10px">
      <label>Subject<input name="subject" maxlength="150" required></label>
      <label>Message<textarea name="text" rows="5" required style="width:100%"></textarea></label>
      ${approvalBlock()}
      <button type="submit">Send to all users</button>
    </form>
  </div>`;
}

const _adminViewStaffBase = adminView;
adminView = function () {
  const html = _adminViewStaffBase().replace('Airtime needing attention', 'Bills needing attention');
  return html.replace('<div class="topbar"><h2>Admin panel</h2></div>',
    '<div class="topbar"><h2>Admin panel</h2></div>\n    ' + interestCard() + '\n    ' + broadcastCard());
};

// ---------- support tools screen ----------
function staffView() {
  const s = state.staff || { users: [], pick: null, audit: [], query: '' };
  const admin = !!(state.wallet && state.wallet.is_admin);
  const idem = state.staffIdem || (state.staffIdem = newId());

  const userList = s.users && s.users.length
    ? `<ul class="list" style="margin-top:10px">${s.users.map((u) => `<li>
        <div><div class="t-title">${esc(u.name || 'No name yet')}</div>
        <div class="t-meta">${esc(u.phone)} · wallet ${esc(u.virtualAccount || '-')} · ${naira(u.mainKobo)}</div></div>
        <button class="small secondary" data-act="staff-pick" data-id="${esc(u.id)}">Pick</button>
      </li>`).join('')}</ul>`
    : '<p class="muted" style="margin:10px 0 0">Search to find a user.</p>';

  const pick = s.pick ? `<div class="card">
      <h3 style="font-size:17px;margin-bottom:4px">Adjust wallet: ${esc(s.pick.name || 'No name')}</h3>
      <p class="sub">Main wallet ${naira(s.pick.mainKobo)} · ${esc(s.pick.phone)}</p>
      <form data-form="staff-adjust" data-approval style="margin-top:10px">
        <input type="hidden" name="userId" value="${esc(s.pick.id)}">
        <input type="hidden" name="idemKey" value="${esc(idem)}">
        <label>Amount (₦). Use a minus sign to take money out<input name="amount" inputmode="decimal" placeholder="e.g. 500 or -500" required></label>
        <label>Reason (the customer and audit log see this)<input name="reason" maxlength="120" required></label>
        ${approvalBlock()}
        <button type="submit">Apply adjustment</button>
      </form>
      <p class="note">Support limit: ₦20,000 per action. Admins have no limit.</p>
    </div>` : '';

  const reverse = `<div class="card">
      <h3 style="font-size:17px;margin-bottom:4px">Reverse a transaction</h3>
      <p class="sub">Works for wallet-to-wallet transfers, cashback, bonuses and referrals.</p>
      <form data-form="staff-reverse" data-approval style="margin-top:10px">
        <input type="hidden" name="idemKey" value="${esc(idem)}">
        <label>Transaction reference or ID<input name="reference" required></label>
        <label>Reason<input name="reason" maxlength="120" required></label>
        ${approvalBlock()}
        <button type="submit">Reverse</button>
      </form>
    </div>`;

  const roleCard = admin ? `<div class="card">
      <h3 style="font-size:17px;margin-bottom:4px">Support staff</h3>
      <p class="sub">Give or remove support access by email.</p>
      <form data-form="staff-role" style="margin-top:10px">
        <label>Email<input name="email" type="email" required></label>
        <label>Role<select name="role"><option value="support">Support</option><option value="none">Remove support</option></select></label>
        <button type="submit">Save</button>
      </form>
    </div>` : '';

  const audit = `<div class="card">
      <h3 style="font-size:17px;margin-bottom:6px">Recent actions</h3>
      ${s.audit && s.audit.length ? `<ul class="list">${s.audit.map((a) => `<li>
        <div><div class="t-title">${esc(a.action)}${a.amountKobo ? ' · ' + naira(Math.abs(a.amountKobo)) : ''}</div>
        <div class="t-meta">${esc(when(a.at))} · ${esc(a.staff || '')}</div>
        <div class="t-meta">${esc(a.reason || '')}</div></div></li>`).join('')}</ul>` : '<p class="muted" style="margin:0">Nothing yet.</p>'}
    </div>`;

  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Support tools</h2></div>
    <div class="row-between" style="margin-bottom:10px"><span class="sub">Live chat, users and actions</span><button class="small secondary" data-act="staff-refresh">Refresh</button></div>
    ${adminSupportCard()}
    <div class="card">
      <form data-form="staff-search">
        <label>Name, phone or wallet number (at least 4 characters)<input name="q" minlength="4" value="${esc(s.query || '')}" required></label>
        <button type="submit">Search</button>
      </form>
      ${userList}
    </div>
    ${pick}
    ${reverse}
    ${roleCard}
    ${audit}
  </div>${nav('home')}`;
}

// Loads the audit list and the live chat list before the screen is drawn.
async function loadStaff() {
  const [audit, support] = await Promise.all([
    api('/staff/audit').catch(() => ({ entries: [] })),
    api('/admin/support').catch(() => []),
  ]);
  state.staff = { users: [], pick: null, query: '', ...(state.staff || {}), audit: audit.entries || [] };
  state.admin = { ...(state.admin || {}), support: support || [] };
}

async function staffSearch(term) {
  const t = String(term || '').trim();
  const r = await api(`/staff/users?q=${encodeURIComponent(t)}`);
  state.staff = { ...(state.staff || {}), users: r.users, query: t, pick: null };
  render();
}

function staffPick(id) {
  const u = ((state.staff && state.staff.users) || []).find((x) => x.id === id);
  if (!u) return;
  state.staff = { ...state.staff, pick: u };
  render();
}

async function staffAdjust(d) {
  const r = await api('/staff/adjust', {
    method: 'POST',
    body: { userId: d.userId, amount: d.amount, reason: d.reason, idemKey: d.idemKey, pin: d.pin, approval: d.approval },
  });
  toast(`Done. ${r.kobo > 0 ? 'Added' : 'Taken'} to the wallet.`);
  state.staffIdem = null;
  await loadStaff();
  state.staff.pick = null;
  render();
}

async function staffReverse(d) {
  const r = await api('/staff/reverse', {
    method: 'POST',
    body: { reference: d.reference, reason: d.reason, idemKey: d.idemKey, pin: d.pin, approval: d.approval },
  });
  toast(`Reversed ${naira(r.reversedKobo)}.`);
  state.staffIdem = null;
  await loadStaff();
  render();
}

async function staffRole(d) {
  await api('/admin/staff', { method: 'POST', body: { email: d.email, role: d.role } });
  toast(d.role === 'support' ? 'Support access given.' : 'Support access removed.');
  await loadStaff();
  render();
}

async function adminBroadcast(d) {
  if (!confirm('Send this email to all users now?')) return;
  const r = await api('/admin/broadcast', {
    method: 'POST',
    body: { subject: d.subject, text: d.text, pin: d.pin, approval: d.approval },
  });
  toast(`Sending to ${r.queued} users. This can take a few minutes.`);
  render();
}

// ---------- repeating bills: a Repeat option on the bill form, and the list of repeating bills ----------
const _billsViewStaffBase = billsView;
billsView = function () {
  let html = _billsViewStaffBase();
  const repeat = `<label>Repeat
          <select name="every"><option value="">Pay once</option><option value="7">Every week</option><option value="30">Every month</option></select>
        </label>
        `;
  html = html.replace('<input type="hidden" name="idemKey"', repeat + '<input type="hidden" name="idemKey"');
  const list = state.billSchedules || [];
  const card = `<div class="card">
      <h3 style="font-size:17px;margin-bottom:6px">Repeating bills</h3>
      ${list.length ? `<ul class="list">${list.map((s) => `<li>
        <div><div class="t-title">${esc(s.plan || 'Bill')}</div>
        <div class="t-meta">${esc(s.customer)} · every ${s.everyDays === 7 ? 'week' : 'month'} · next ${esc(when(s.nextRun))}</div></div>
        <button class="small secondary" data-act="bill-cancel" data-id="${esc(s.id)}">Cancel</button>
      </li>`).join('')}</ul>` : '<p class="muted" style="margin:0">None yet. Pick "Repeat" above to set one up.</p>'}
    </div>`;
  return html.replace('<p class="note">If the payment fails', card + '\n    <p class="note">If the payment fails');
};

async function billCancel(id) {
  try {
    await api(`/bills/schedules/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
    toast('Repeating bill cancelled.');
    await grab('/bills/schedules', 'billSchedules');
    render();
  } catch (e) { toast(e.message); }
}

// ---------- PDF statement (same data as the CSV, built in the browser with no outside library) ----------
function pdfEscape(s) {
  return String(s).replace(/[^\x20-\x7E]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// Writes a plain PDF with one or more pages of text lines (Helvetica, A4).
function makePdfBlob(lines) {
  const perPage = 48;
  const pages = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  if (!pages.length) pages.push(['']);
  const body = [];
  const kids = [];
  body[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  body[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pages.forEach((pl, i) => {
    const pageNo = 4 + i * 2;
    const contentNo = pageNo + 1;
    kids.push(`${pageNo} 0 R`);
    let y = 800;
    let stream = '';
    pl.forEach((ln, j) => {
      const big = i === 0 && j === 0;
      stream += `BT /F1 ${big ? 14 : 10} Tf 40 ${y} Td (${pdfEscape(ln)}) Tj ET\n`;
      y -= big ? 24 : 15;
    });
    body[pageNo] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNo} 0 R >>`;
    body[contentNo] = `<< /Length ${stream.length} >>\nstream\n${stream}endstream`;
  });
  body[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  const max = 4 + pages.length * 2 - 1;
  let out = '%PDF-1.4\n';
  const offs = [];
  for (let n = 1; n <= max; n++) {
    offs[n] = out.length;
    out += `${n} 0 obj\n${body[n]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${max + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= max; n++) out += String(offs[n]).padStart(10, '0') + ' 00000 n \n';
  out += `trailer\n<< /Size ${max + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([out], { type: 'application/pdf' });
}

// Saves the statement as a PDF file with totals at the bottom.
function downloadStatementPdf(label, rows) {
  const k = (v) => (Math.abs(Number(v)) / 100).toFixed(2);
  let totalIn = 0;
  let totalOut = 0;
  const lines = [`Legendary Pay statement: ${label}`, ' '];
  lines.push('Date         Type                      Money in (NGN)   Money out (NGN)   Note');
  for (const t of rows) {
    const amt = Number(t.amountKobo || 0);
    if (amt > 0) totalIn += amt; else totalOut += -amt;
    const date = t.at ? new Date(t.at).toLocaleDateString('en-CA') : '';
    const type = String(TX_LABELS[t.kind] || t.kind).slice(0, 22).padEnd(24);
    const inn = amt > 0 ? k(amt) : '-';
    const out = amt < 0 ? k(amt) : '-';
    lines.push(`${date}   ${type}${inn.padStart(14)}   ${out.padStart(15)}   ${String(t.note || '').slice(0, 30)}`);
  }
  lines.push(' ');
  lines.push(`Total money in: NGN ${k(totalIn)}     Total money out: NGN ${k(totalOut)}`);
  const blob = makePdfBlob(lines);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `legendary-pay-statement-${label}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// The history screen gets a PDF button next to the CSV one.
const _historyViewStaffBase = historyView;
historyView = function () {
  return _historyViewStaffBase().replace(
    '<button type="submit" class="secondary">Download statement (CSV)</button>',
    '<button type="submit" class="secondary">Download statement (CSV)</button>\n        <button type="button" class="secondary" data-act="statement-pdf">Download statement (PDF)</button>');
};

// ---------- admin: monthly interest from the money-holding partner ----------
function interestCard() {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `<div class="card">
    <h3 style="font-size:17px;margin-bottom:6px">Interest earned</h3>
    <p class="sub">Enter the interest our partner paid us for the month. It is added to profit. Each month can only be entered once.</p>
    <form data-form="admin-interest" data-approval style="margin-top:10px">
      <label>Month<input name="month" type="month" value="${thisMonth}" required></label>
      <label>Interest received (₦)<input name="amount" inputmode="decimal" placeholder="e.g. 250000" required></label>
      <label>Where it came from<input name="note" maxlength="120" placeholder="e.g. Flutterwave statement, July" required></label>
      ${approvalBlock()}
      <button type="submit">Save interest</button>
    </form>
  </div>`;
}

async function adminInterest(d) {
  const r = await api('/admin/interest', {
    method: 'POST',
    body: { month: d.month, amount: d.amount, note: d.note, pin: d.pin, approval: d.approval },
  });
  toast(`Saved ${naira(r.kobo)} interest.`);
  state.admin = await fetchAdmin(state.admin?.query || '');
  render();
}
