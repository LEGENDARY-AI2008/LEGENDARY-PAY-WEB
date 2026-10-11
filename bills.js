// Data bundles, electricity and cable TV bill pages. Uses the same PIN / fingerprint approval as money transfers.
// Loaded before app.js, so it reads app.js globals (state, api, toast, navigate) only when the page runs.
const BILL_TITLES = {
  DATA: 'Data bundle', ELECTRICITY: 'Electricity bill', CABLE: 'Cable TV',
  EXAM: 'Exam PIN', INTERNET: 'Internet plan', BETTING: 'Betting top-up',
  WATER: 'Water bill', INSURANCE: 'Insurance premium', WASTE: 'Waste bill', SCHOOL: 'School fees',
};
// Our service fee in naira, shown before paying. Keep in step with BILL_FEE_KOBO in the backend.
const BILL_FEE_NAIRA = { DATA: 50, ELECTRICITY: 100, CABLE: 100, EXAM: 100, INTERNET: 100, BETTING: 50, WATER: 50, INSURANCE: 100, WASTE: 50, SCHOOL: 100 };
// Services where the user types the amount.
const TYPED = ['ELECTRICITY', 'BETTING', 'WATER', 'INSURANCE', 'WASTE', 'SCHOOL'];

function billOptions(list, first, withPrice) {
  return `<option value="">${esc(first)}</option>` + list.map((x) =>
    `<option value="${esc(x.code)}">${esc(x.name)}${withPrice && x.amountKobo ? ' · ' + naira(x.amountKobo) : ''}</option>`).join('');
}

function billsView() {
  const cat = state.billCat || 'DATA';
  const billers = state.billers || [];
  const items = state.billItems || [];
  const typed = TYPED.includes(cat);
  const isData = cat === 'DATA';
  const providerLabel = isData ? 'Network' : (cat === 'BETTING' ? 'Betting site' : (cat === 'EXAM' ? 'Exam body' : 'Provider'));
  const planLabel = { ELECTRICITY: 'Meter type', DATA: 'Data plan', BETTING: 'Type', EXAM: 'Pin', INTERNET: 'Plan', WATER: 'Bill', WASTE: 'Bill', INSURANCE: 'Policy type', SCHOOL: 'Fee type' }[cat] || 'Package';
  const numberLabel = { DATA: 'Phone number', ELECTRICITY: 'Meter number', CABLE: 'Smartcard or IUC number', EXAM: 'Registration number', INTERNET: 'Account or router ID', BETTING: 'Betting account ID', WATER: 'Account number', WASTE: 'Account number', INSURANCE: 'Policy number', SCHOOL: 'Student ID or registration number' }[cat];
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>${esc(BILL_TITLES[cat])}</h2></div>
    <div class="card">
      <form data-form="bill-pay" data-approval>
        <input type="hidden" name="category" value="${esc(cat)}">
        <label>${providerLabel}
          <select name="biller" required>${billOptions(billers, 'Choose', false)}</select>
        </label>
        ${billers.length ? '' : '<p class="note" style="margin:0 0 10px">Providers for this service are not available yet.</p>'}
        <label>${planLabel}
          <select name="item" required>${billOptions(items, items.length ? 'Choose' : 'Pick a provider first', !typed)}</select>
        </label>
        <label>${numberLabel}<input name="customer" inputmode="numeric" required></label>
        ${typed ? '<label>Amount (₦)<input name="amount" inputmode="decimal" placeholder="5000" required></label>' : ''}
        ${isData ? '' : '<button type="button" class="secondary" data-act="bill-check">Check number</button><p class="note bill-name" style="margin:6px 0 0"></p>'}
        <p class="note" style="margin:0 0 10px">Service fee: ₦${BILL_FEE_NAIRA[cat]}, added to the amount.</p>
        ${approvalBlock()}
        <input type="hidden" name="idemKey" value="${esc(state.idem)}">
        <button type="submit">Pay</button>
      </form>
    </div>
    <p class="note">If the payment fails, the money goes back to your wallet.</p>
  </div>${nav('home')}`;
}

// When a provider is picked, load its plans into the plan list without redrawing the page (keeps typed text).
document.addEventListener('change', async (e) => {
  const sel = e.target;
  if (!(sel instanceof HTMLSelectElement) || sel.name !== 'biller') return;
  const form = sel.closest('form');
  if (!form) return;
  const itemSel = form.querySelector('select[name="item"]');
  if (!itemSel) return;
  if (!sel.value) { itemSel.innerHTML = billOptions([], 'Pick a provider first'); return; }
  itemSel.innerHTML = billOptions([], 'Loading plans...');
  try {
    const cat = state.billCat || 'DATA';
    const items = await api(`/bills/items?category=${encodeURIComponent(cat)}&biller=${encodeURIComponent(sel.value)}`, { quiet: true });
    itemSel.innerHTML = billOptions(items, 'Choose', !TYPED.includes(cat));
  } catch (err) {
    itemSel.innerHTML = billOptions([], err.message || 'Could not load plans');
  }
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
