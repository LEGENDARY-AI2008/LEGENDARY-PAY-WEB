// Bill pages and airtime. Uses the same PIN / fingerprint approval as money transfers.
// Loaded after screens.js, so airtimeView() below replaces the old one in screens.js.
// Loaded before app.js, so it reads app.js globals (state, api, toast, navigate, naira, esc) only when the page runs.

const BILL_TITLES = {
  DATA: 'Data bundle', ELECTRICITY: 'Electricity bill', CABLE: 'Cable TV',
  EXAM: 'Exam PIN', INTERNET: 'Internet plan', BETTING: 'Betting top-up',
  WATER: 'Water bill', INSURANCE: 'Insurance premium', WASTE: 'Waste bill', SCHOOL: 'School fees',
};
// Our fee is 3% of the price, added to the total. Shown inside the price, never as a separate line.
// Keep in step with FEE_RATE_BPS in the backend bills.js.
const FEE_RATE = 0.03;
const withFee = (kobo) => Math.round(Number(kobo) * (1 + FEE_RATE));
// Services where the user types the amount.
const TYPED = ['ELECTRICITY', 'BETTING', 'WATER', 'INSURANCE', 'WASTE', 'SCHOOL'];
// Quick amounts (naira) shown as buttons above the amount box.
const QUICK_AMOUNTS = {
  AIRTIME: [100, 200, 300, 500, 1000, 2000],
  ELECTRICITY: [1000, 2000, 5000, 10000, 20000],
};
// Network colours for the airtime logo circles. Text circles, so no image files are needed.
const NETWORKS = [
  ['MTN', 'MTN', '#FFCC00', '#000000'],
  ['AIRTEL', 'Airtel', '#E40000', '#FFFFFF'],
  ['GLO', 'glo', '#00A651', '#FFFFFF'],
  ['9MOBILE', '9mobile', '#006B3F', '#FFFFFF'],
];

const BILL_CSS = `<style>
.bill-lbl{font-size:13px;font-weight:600;margin:4px 0 8px}
.net-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}
.net-btn{background:none;color:inherit;padding:0;width:auto;font-size:12px;display:flex;flex-direction:column;align-items:center;gap:6px;opacity:.55}
.net-btn.active{opacity:1}
.net-dot{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px}
.quick-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
.quick-btn{background:var(--card-2);color:inherit;border:1px solid var(--line);font-weight:700;width:auto;padding:12px 6px}
.quick-btn.active{border-color:#1a9e6a}
.plan-tabs{display:flex;gap:8px;overflow-x:auto;margin-bottom:10px}
.ptab{background:none;color:inherit;opacity:.6;width:auto;padding:6px 12px;border-radius:999px;font-size:13px}
.ptab.active{background:var(--card-2);opacity:1}
.plan-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px}
.plan-card{background:var(--card-2);color:inherit;border:1px solid var(--line);text-align:left;display:flex;flex-direction:column;gap:4px;width:auto;padding:12px}
.plan-card.active{border-color:#1a9e6a}
.plan-name{font-weight:600;font-size:13px}
.plan-price{font-size:12px;opacity:.8}
.promo-row{display:flex;gap:10px;overflow-x:auto;margin:0 0 14px;padding:2px 0 6px;scroll-snap-type:x mandatory}
.promo{min-width:240px;flex:0 0 auto;scroll-snap-align:start;border:none;border-radius:16px;padding:16px;color:#fff;text-align:left;display:flex;flex-direction:column;gap:6px;width:auto;margin:0}
.promo-logo{width:30px;height:30px;border-radius:50%;background:#fff;margin-bottom:4px}
.promo-title{font-weight:700;font-size:17px}
.promo-sub{font-size:13px;opacity:.9;white-space:normal}
.refer-banner{display:flex;justify-content:space-between;align-items:center;gap:12px;background:linear-gradient(135deg,#4B1FB0,#7C4DFF);color:#fff;border-radius:16px;padding:16px;margin:12px 0;cursor:pointer}
.refer-banner p{margin:4px 0 0;font-size:13px;opacity:.92}
.refer-btn{background:#fff;color:#4B1FB0;border-radius:999px;padding:8px 14px;font-weight:700;white-space:nowrap;font-size:14px}
</style>`;

function billOptions(list, first, withPrice) {
  return `<option value="">${esc(first)}</option>` + list.map((x) =>
    `<option value="${esc(x.code)}">${esc(x.name)}${withPrice && x.amountKobo ? ' · ' + naira(withFee(x.amountKobo)) : ''}</option>`).join('');
}

// Quick amount buttons. Tapping one fills the amount box.
function quickGrid(amounts) {
  return `<div class="quick-grid">${amounts.map((a) =>
    `<button type="button" class="quick-btn" data-quick="${a}">₦${a.toLocaleString('en-NG')}</button>`).join('')}</div>`;
}

// Data plan cards. Tab words are matched against the plan name (day, week, month).
function planCards(list, tab) {
  const test = {
    DAILY: (x) => /day/i.test(x.name),
    WEEKLY: (x) => /week/i.test(x.name),
    MONTHLY: (x) => /month/i.test(x.name),
  }[tab] || (() => true);
  const shown = list.filter(test);
  if (!shown.length) return '<p class="note">No plans in this tab.</p>';
  return shown.map((x) =>
    `<button type="button" class="plan-card" data-plan="${esc(x.code)}"><span class="plan-name">${esc(x.name)}</span>${x.amountKobo ? `<span class="plan-price">${naira(withFee(x.amountKobo))}</span>` : ''}</button>`).join('');
}

// Promo cards at the top of the bill and airtime pages (like OPay's banners). They open our other services.
const PROMOS = [
  { title: 'Light bill?', sub: 'Prepaid or postpaid. Pay with Legendary Pay.', act: 'bill-open', cat: 'ELECTRICITY', bg: 'linear-gradient(135deg,#1B1145,#4B3C9A)' },
  { title: 'TV expired?', sub: 'Renew DStv, GOtv and more.', act: 'bill-open', cat: 'CABLE', bg: 'linear-gradient(135deg,#0F7A52,#1A9E6A)' },
  { title: 'Data plans', sub: 'Daily, weekly and monthly bundles.', act: 'bill-open', cat: 'DATA', bg: 'linear-gradient(135deg,#B3261E,#E0633C)' },
  { title: 'Airtime', sub: 'MTN, Airtel, GLO and 9mobile.', go: 'airtime', bg: 'linear-gradient(135deg,#1F7A3A,#56B870)' },
  { title: 'Exam PIN', sub: 'WAEC, NECO and JAMB.', act: 'bill-open', cat: 'EXAM', bg: 'linear-gradient(135deg,#2B6CB0,#4FA3E3)' },
];
function promoStrip() {
  return `<div class="promo-row">${PROMOS.map((p) => `<button type="button" class="promo" style="background:${p.bg}" ${p.go ? `data-go="${p.go}"` : `data-act="${p.act}" data-cat="${p.cat}"`}>
    <img src="logo-512.jpg" alt="" class="promo-logo"><span class="promo-title">${esc(p.title)}</span><span class="promo-sub">${esc(p.sub)}</span></button>`).join('')}</div>`;
}

// Prepaid / Postpaid buttons for electricity. They filter the meter list.
const METER_BUTTONS = `<div style="display:flex;gap:8px;margin:0 0 10px">
  <button type="button" class="secondary" data-meter="prepaid" style="flex:1">Prepaid</button>
  <button type="button" class="secondary" data-meter="postpaid" style="flex:1">Postpaid</button>
</div>`;

// Pay button shows the total (price plus our 3%). Updates as the user types or picks a plan.
function updatePayLabel(form) {
  if (!form) return;
  const btn = form.querySelector('button[type="submit"]');
  const isAirtime = form.dataset.form === 'airtime';
  if (!btn || (form.dataset.form !== 'bill-pay' && !isAirtime)) return;
  let kobo = 0;
  const amt = form.querySelector('input[name="amount"]');
  if (amt && amt.value) kobo = Math.round(Number(String(amt.value).replace(/,/g, '')) * 100) || 0;
  const itemCode = (form.querySelector('input[name="item"]') || form.querySelector('select[name="item"]') || {}).value || '';
  const plan = (state.billItems || []).find((x) => x.code === itemCode);
  if (plan && plan.amountKobo > 0) kobo = plan.amountKobo;
  const verb = isAirtime ? 'Buy airtime ' : 'Pay ';
  btn.textContent = kobo > 0 ? verb + naira(withFee(kobo)) : (isAirtime ? 'Buy airtime' : 'Pay');
}

function billsView() {
  const cat = state.billCat || 'DATA';
  const billers = state.billers || [];
  const items = state.billItems || [];
  const typed = TYPED.includes(cat);
  const isData = cat === 'DATA';
  const isElectric = cat === 'ELECTRICITY';
  const providerLabel = isData ? 'Network' : (cat === 'BETTING' ? 'Betting site' : (cat === 'EXAM' ? 'Exam body' : 'Provider'));
  const planLabel = { ELECTRICITY: 'Meter type', BETTING: 'Type', EXAM: 'Pin', INTERNET: 'Plan', WATER: 'Bill', WASTE: 'Bill', INSURANCE: 'Policy type', SCHOOL: 'Fee type' }[cat] || 'Package';
  const numberLabel = { DATA: 'Phone number', ELECTRICITY: 'Meter number', CABLE: 'Smartcard or IUC number', EXAM: 'Registration number', INTERNET: 'Account or router ID', BETTING: 'Betting account ID', WATER: 'Account number', WASTE: 'Account number', INSURANCE: 'Policy number', SCHOOL: 'Student ID or registration number' }[cat];

  // Data: plans are shown as cards with tabs. Other services keep the dropdown.
  const planBlock = isData
    ? `<input type="hidden" name="item" value="">
        <div class="bill-lbl">Data plan</div>
        <div class="plan-tabs">${['ALL', 'DAILY', 'WEEKLY', 'MONTHLY'].map((t, i) =>
          `<button type="button" class="ptab${i === 0 ? ' active' : ''}" data-ptab="${t}">${t === 'ALL' ? 'All' : t[0] + t.slice(1).toLowerCase()}</button>`).join('')}</div>
        <div class="plan-grid">${items.length ? planCards(items, 'ALL') : '<p class="note">Pick a network first</p>'}</div>`
    : `<label>${planLabel}
          <select name="item" required>${billOptions(items, items.length ? 'Choose' : 'Pick a provider first', !typed)}</select>
        </label>`;

  // Quick amounts for electricity (typed amount still works below them).
  const quick = QUICK_AMOUNTS[cat] ? quickGrid(QUICK_AMOUNTS[cat]) : '';

  return `${BILL_CSS}<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>${esc(BILL_TITLES[cat])}</h2></div>
    ${promoStrip()}
    <div class="card">
      <form data-form="bill-pay" data-approval>
        <input type="hidden" name="category" value="${esc(cat)}">
        <label>${providerLabel}
          <select name="biller" required>${billOptions(billers, 'Choose', false)}</select>
        </label>
        ${billers.length ? '' : '<p class="note" style="margin:0 0 10px">Providers for this service are not available yet.</p>'}
        ${isElectric ? METER_BUTTONS : ''}
        ${planBlock}
        <label>${numberLabel}<input name="customer" inputmode="numeric" required></label>
        ${typed ? `${quick}<label>Amount (₦)<input name="amount" inputmode="decimal" placeholder="5000" required></label>` : ''}
        ${isData ? '' : '<button type="button" class="secondary" data-act="bill-check">Check number</button><p class="note bill-name" style="margin:6px 0 0"></p>'}
        <input type="hidden" name="idemKey" value="${esc(state.idem)}">
        <button type="submit">Pay</button>
      </form>
    </div>
    <p class="note">If the payment fails, the money goes back to your wallet.</p>
  </div>${nav('home')}`;
}

// Buy airtime: network logos, quick amounts, then a custom amount.
// Replaces airtimeView() in screens.js. Same form fields, so the airtime handler in app.js still works.
function airtimeView() {
  return `${BILL_CSS}<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Buy airtime</h2></div>
    ${promoStrip()}
    <div class="card">
      <form data-form="airtime" data-approval>
        <input type="hidden" name="network" value="MTN">
        <div class="bill-lbl">Network</div>
        <div class="net-row">${NETWORKS.map(([v, l, bg, fg], i) =>
          `<button type="button" class="net-btn${i === 0 ? ' active' : ''}" data-net="${v}"><span class="net-dot" style="background:${bg};color:${fg}">${esc(l)}</span>${esc(l)}</button>`).join('')}</div>
        <label>Phone number<input name="phone" inputmode="tel" placeholder="08012345678" maxlength="11" pattern="0\\d{10}" required></label>
        <div class="bill-lbl">Quick amount</div>
        ${quickGrid(QUICK_AMOUNTS.AIRTIME)}
        <label>Amount (₦)<input name="amount" inputmode="decimal" placeholder="500" required></label>
        <input type="hidden" name="idemKey" value="${esc(state.idem)}">
        <button type="submit">Buy airtime</button>
      </form>
    </div>
    <p class="note">If the airtime fails, the money goes back to your wallet.</p>
  </div>${nav('home')}`;
}

// When a provider is picked, load its plans without redrawing the page (keeps typed text).
document.addEventListener('change', async (e) => {
  const sel = e.target;
  if (!(sel instanceof HTMLSelectElement) || sel.name !== 'biller') return;
  const form = sel.closest('form');
  if (!form) return;
  const cat = state.billCat || 'DATA';
  const itemSel = form.querySelector('select[name="item"]');
  const itemHidden = form.querySelector('input[name="item"]');
  const grid = form.querySelector('.plan-grid');
  if (!sel.value) {
    state.billItems = [];
    if (itemSel) itemSel.innerHTML = billOptions([], 'Pick a provider first');
    if (itemHidden) itemHidden.value = '';
    if (grid) grid.innerHTML = '<p class="note">Pick a network first</p>';
    return;
  }
  if (itemSel) itemSel.innerHTML = billOptions([], 'Loading plans...');
  if (grid) grid.innerHTML = '<p class="note">Loading plans...</p>';
  try {
    const items = await api(`/bills/items?category=${encodeURIComponent(cat)}&biller=${encodeURIComponent(sel.value)}`, { quiet: true });
    state.billItems = items;
    if (itemSel) itemSel.innerHTML = billOptions(items, 'Choose', !TYPED.includes(cat));
    if (grid) {
      form.dataset.ptab = 'ALL';
      if (itemHidden) itemHidden.value = '';
      grid.innerHTML = planCards(items, 'ALL');
      form.querySelectorAll('[data-ptab]').forEach((b) => b.classList.toggle('active', b.dataset.ptab === 'ALL'));
    }
    // Reset the meter button highlight when a new provider is picked.
    form.querySelectorAll('[data-meter]').forEach((b) => b.classList.remove('active'));
  } catch (err) {
    state.billItems = [];
    if (itemSel) itemSel.innerHTML = billOptions([], err.message || 'Could not load plans');
    if (grid) grid.innerHTML = `<p class="note">${esc(err.message || 'Could not load plans')}</p>`;
  }
});

// One click handler for the new buttons: network, quick amount, data plan, plan tab, meter type.
document.addEventListener('click', (e) => {
  const t = e.target.closest && e.target.closest('[data-net],[data-quick],[data-plan],[data-ptab],[data-meter]');
  if (!t) return;
  const form = t.closest('form');
  if (!form) return;

  if (t.dataset.net !== undefined) {
    form.querySelector('input[name="network"]').value = t.dataset.net;
    form.querySelectorAll('[data-net]').forEach((b) => b.classList.toggle('active', b === t));
    return;
  }

  if (t.dataset.quick !== undefined) {
    form.querySelector('input[name="amount"]').value = t.dataset.quick;
    form.querySelectorAll('[data-quick]').forEach((b) => b.classList.toggle('active', b === t));
    updatePayLabel(form);
    return;
  }

  if (t.dataset.plan !== undefined) {
    form.querySelector('input[name="item"]').value = t.dataset.plan;
    form.querySelectorAll('[data-plan]').forEach((b) => b.classList.toggle('active', b === t));
    updatePayLabel(form);
    return;
  }

  if (t.dataset.ptab !== undefined) {
    form.dataset.ptab = t.dataset.ptab;
    form.querySelectorAll('[data-ptab]').forEach((b) => b.classList.toggle('active', b === t));
    form.querySelector('.plan-grid').innerHTML = planCards(state.billItems || [], t.dataset.ptab);
    return;
  }

  if (t.dataset.meter !== undefined) {
    const itemSel = form.querySelector('select[name="item"]');
    if (!itemSel) return;
    const want = t.dataset.meter; // 'prepaid' or 'postpaid'
    const all = state.billItems || [];
    const hit = all.filter((x) => `${x.name} ${x.code}`.toLowerCase().includes(want));
    const list = hit.length ? hit : all;
    itemSel.innerHTML = billOptions(list, 'Choose', false);
    if (hit.length === 1) itemSel.value = hit[0].code;
    form.querySelectorAll('[data-meter]').forEach((b) => b.classList.toggle('active', b === t));
    updatePayLabel(form);
  }
});

// Typing an amount, or picking a plan from a dropdown, updates the Pay button.
document.addEventListener('input', (e) => {
  if (e.target && e.target.name === 'amount') updatePayLabel(e.target.closest('form'));
});
document.addEventListener('change', (e) => {
  if (e.target && e.target.name === 'item') updatePayLabel(e.target.closest('form'));
});

// "Check number" button: asks the provider whose meter or smartcard it is, before paying.
async function billCheck(el) {
  const form = el.closest('form');
  const f = Object.fromEntries(new FormData(form));
  const out = form.querySelector('.bill-name');
  out.textContent = 'Checking...';
  try {
    const r = await api('/bills/check', {
      method: 'POST',
      body: { category: f.category, biller: f.biller, item: f.item, customer: (f.customer || '').trim() },
      quiet: true,
    });
    out.textContent = 'Name on this number: ' + r.name;
  } catch (err) {
    out.textContent = err.message;
  }
}

// ---------- receipt picture (OPay style), view, download and share ----------
// Replaces shareReceipt() in extras.js and receiptView() in screens.js.
function loadReceiptLogo() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = 'logo-512.jpg';
  });
}

// Draws the receipt picture and returns it as a PNG blob.
async function makeReceiptBlob() {
  const r = state.receipt;
  if (!r) return null;
  const logo = await loadReceiptLogo();
  const amt = Number(r.amountKobo || 0);
  const statusText = { queued: 'Processing', success: 'Successful', refunded: 'Refunded' };
  const statusColor = { queued: '#B7791F', success: '#1F7A3A', refunded: '#2B6CB0' };
  const st = r.status || 'success';

  const rows = [];
  if (r.feeKobo) rows.push(['Fee', naira(r.feeKobo)]);
  if (r.bankAccount) rows.push(['Bank account', r.bankAccount]);
  if (r.note) rows.push(['Note', r.note]);
  if (r.reference) rows.push(['Reference', r.reference]);
  rows.push(['Receipt ID', r.id]);

  const W = 640;
  const H = 520 + rows.length * 78 + 100;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Watermark: faint logo behind the middle of the page.
  if (logo) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.drawImage(logo, W / 2 - 220, H / 2 - 220, 440, 440);
    ctx.restore();
  }

  // Heading: round logo, name and title.
  ctx.textAlign = 'center';
  if (logo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, 80, 46, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(logo, W / 2 - 46, 34, 92, 92);
    ctx.restore();
  }
  ctx.fillStyle = '#1B1145';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('Legendary Pay', W / 2, 175);
  ctx.fillStyle = '#6B5FA0';
  ctx.font = '22px sans-serif';
  ctx.fillText('Payment receipt', W / 2, 210);

  // Amount, type and date.
  ctx.fillStyle = amt < 0 ? '#B3261E' : '#1F7A3A';
  ctx.font = 'bold 60px sans-serif';
  ctx.fillText((amt < 0 ? '-' : '+') + naira(Math.abs(amt)), W / 2, 310);
  ctx.fillStyle = '#1B1145';
  ctx.font = '28px sans-serif';
  ctx.fillText(TX_LABELS[r.kind] || r.kind, W / 2, 360);
  ctx.fillStyle = '#6B5FA0';
  ctx.font = '22px sans-serif';
  ctx.fillText(r.at ? new Date(r.at).toLocaleString('en-NG') : '', W / 2, 395);

  // Status line.
  ctx.fillStyle = statusColor[st] || '#1F7A3A';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('● ' + (statusText[st] || 'Successful'), W / 2, 440);

  // Divider.
  ctx.strokeStyle = '#E6E1F5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, 475);
  ctx.lineTo(W - 60, 475);
  ctx.stroke();

  // Detail rows: label on the left, value on the right.
  let y = 525;
  for (const [label, value] of rows) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6B5FA0';
    ctx.font = '22px sans-serif';
    ctx.fillText(label, 60, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#1B1145';
    const mono = label === 'Reference' || label === 'Receipt ID';
    ctx.font = mono ? '20px monospace' : '24px sans-serif';
    ctx.fillText(String(value).slice(0, 40), W - 60, y);
    y += 78;
  }

  // Footer.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#6B5FA0';
  ctx.font = '18px sans-serif';
  ctx.fillText('Keep this receipt for your records', W / 2, H - 50);

  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'));
}

// Saves the picture to the phone or laptop.
function saveReceiptBlob(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'legendary-pay-receipt.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Shows the picture on screen, with a Close button.
function showReceiptPicture(blob) {
  const url = URL.createObjectURL(blob);
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;gap:12px';
  wrap.innerHTML = `<img src="${url}" alt="Receipt" style="max-width:100%;max-height:80vh;border-radius:12px;background:#fff">
    <button type="button" class="secondary" style="width:auto;padding:10px 28px">Close</button>`;
  wrap.querySelector('button').onclick = () => { wrap.remove(); URL.revokeObjectURL(url); };
  document.body.appendChild(wrap);
}

// Share button (app.js calls shareReceipt()).
async function shareReceipt() {
  const blob = await makeReceiptBlob();
  if (!blob) { toast('Could not make the receipt picture.'); return; }
  const file = new File([blob], 'legendary-pay-receipt.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Legendary Pay receipt' }); } catch {}
    return;
  }
  saveReceiptBlob(blob);
}

// Receipt screen: View, Download and Share buttons, then the report form.
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
    <div class="card">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <button type="button" class="secondary" data-rcpt="view">View</button>
        <button type="button" class="secondary" data-rcpt="download">Download</button>
        <button type="button" class="secondary" data-act="share-receipt">Share</button>
      </div>
    </div>
    <div class="card">
      <form data-form="report-tx">
        <input type="hidden" name="id" value="${esc(r.id)}">
        <label>Something wrong with this payment?
          <textarea name="message" rows="3" maxlength="400" required placeholder="Tell us what happened" style="width:100%;background:var(--card-2);border:1px solid var(--line);color:var(--text);border-radius:14px;padding:14px;font:inherit"></textarea>
        </label>
        <button type="submit" class="secondary">Report a problem</button>
      </form>
    </div>
  </div>${nav('history')}`;
}

// View and Download buttons on the receipt screen.
document.addEventListener('click', async (e) => {
  const b = e.target.closest && e.target.closest('[data-rcpt]');
  if (!b || !state.receipt) return;
  const blob = await makeReceiptBlob();
  if (!blob) { toast('Could not make the receipt picture.'); return; }
  if (b.dataset.rcpt === 'view') showReceiptPicture(blob);
  else saveReceiptBlob(blob);
});

// ---------- home screen: promo cards and referral banner ----------
// Adds the promo cards and the refer banner under the balance card. Tapping the banner opens Rewards,
// where the referral code and Share button already are.
function referBanner() {
  const code = state.wallet && state.wallet.referral_code ? state.wallet.referral_code : '';
  return `<div class="refer-banner" data-go="rewards">
    <div><strong>Invite friends, earn ₦100</strong>
    <p>When a friend joins with your code and deposits ₦500 or more.</p>
    ${code ? `<p>Your code: <b>${esc(code)}</b></p>` : ''}</div>
    <span class="refer-btn">Invite</span>
  </div>`;
}


