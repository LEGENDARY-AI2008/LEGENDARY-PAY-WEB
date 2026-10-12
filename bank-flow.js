// Bank transfer flow (brand purple):
// 1. Check account (bank + account number, name shown, Next)
// 2. Amount (quick amounts, remark, optional category, Confirm)
// 3. Reminder sheet (Recheck / Continue)
// 4. Confirm sheet (details, fee, balance, PIN or fingerprint, Pay)
// 5. Success screen (receipt, add money, offers)
// Loaded after staff.js and before app.js. Uses app.js helpers at run time: state, api, render, toast,
// naira, esc, newId, toKobo, approvalBlock, backBtn, initials, loadWallet, navigate, bankName, PROMOS.

const BANK_CATEGORIES = ['Food & Dining', 'Groceries', 'Bills & Utilities', 'Family & Friends', 'Business Expenses', 'Gifts & Donations', 'Transfer', 'Other'];
const BANK_MIN_KOBO = 10000;      // ₦100
const BANK_MAX_KOBO = 500000000;  // ₦5,000,000

const BANK_FLOW_CSS = `<style>
.bf-btn{background:linear-gradient(135deg,#7B3FF2 0%,#5B2BD6 100%);color:#fff;border:none;border-radius:999px;padding:15px;width:100%;font-weight:700;font-size:16px;margin-top:12px}
.bf-btn[disabled]{opacity:.45}
.bf-btn.ghost{background:#EDE5FF;color:#4B1FB0;margin-top:10px}
.bf-card{background:var(--card,#fff);border-radius:18px;padding:16px;margin-bottom:12px}
.bf-head{display:flex;gap:12px;align-items:center;padding:4px 0 14px}
.bf-avatar{width:52px;height:52px;border-radius:50%;background:#EDE5FF;color:#4B1FB0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;flex:0 0 auto}
.bf-ok{background:#EDE5FF;color:#4B1FB0;border-radius:14px;padding:12px 14px;margin-top:10px;font-weight:600}
.bf-quick{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:12px}
.bf-quick button{background:#F3EEFF;color:#4B1FB0;border:none;border-radius:12px;padding:10px 0;font-size:12px;font-weight:700;width:auto}
.bf-amount{display:flex;align-items:center;gap:6px;font-size:30px;font-weight:800;border-bottom:1px solid #E7E0F5;padding-bottom:8px}
.bf-amount input{border:none;font-size:30px;font-weight:800;padding:0;background:transparent;box-shadow:none}
.bf-recent{display:flex;width:100%;justify-content:space-between;align-items:center;gap:10px;background:none;color:var(--text);padding:12px 0;border-bottom:1px solid #F0EDF7;border-radius:0;font-weight:500;text-align:left}
.bf-sheet-bg{position:fixed;inset:0;background:rgba(20,10,40,.45);z-index:60;display:flex;align-items:flex-end;justify-content:center}
.bf-sheet{background:var(--card,#fff);width:100%;max-width:520px;border-radius:22px 22px 0 0;padding:20px 18px 24px;max-height:92vh;overflow:auto}
.bf-row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #F0EDF7;font-size:14px}
.bf-row span:first-child{color:#8A8398}
.bf-success{text-align:center;padding-top:24px}
.bf-tick{width:84px;height:84px;border-radius:50%;background:#7B3FF2;color:#fff;display:flex;align-items:center;justify-content:center;font-size:44px;margin:0 auto}
.bf-two{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
.bf-two button{background:var(--card,#fff);border:1px solid #E7E0F5;color:var(--text);border-radius:16px;padding:16px 12px;font-weight:600;width:auto}
.bf-two .bf-btn{margin:0;width:100%}
</style>`;

// ---------- state ----------
function bankFlow() {
  if (!state.bankFlow) {
    state.bankFlow = { step: 1, bankCode: '', accountNumber: '', name: '', amount: '', remark: '', category: '', sheet: null, result: null, idem: newId() };
  }
  return state.bankFlow;
}

// ---------- screens ----------
function bankFlowView() {
  const f = bankFlow();
  if (f.result) return `${BANK_FLOW_CSS}${bankSuccessView(f)}`;
  const body = f.step === 1 ? bankCheckStep(f) : bankAmountStep(f);
  return `${BANK_FLOW_CSS}<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Transfer to bank</h2></div>
    ${body}
  </div>${bankSheet(f)}`;
}

function bankCheckStep(f) {
  const banks = state.banks || [];
  const recents = ((state.recents && state.recents.banks) || []).slice(0, 5);
  return `<div class="bf-card">
    <form data-form="bank-check">
      <label>Bank<input type="search" data-bank-search placeholder="Search bank"></label>
      <select name="bankCode" required>
        <option value="">Choose a bank</option>
        ${banks.map((b) => `<option value="${esc(b.code)}" ${f.bankCode === b.code ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}
      </select>
      <label>Account number<input name="accountNumber" inputmode="numeric" maxlength="10" pattern="\\d{10}" required value="${esc(f.accountNumber)}"></label>
      <button type="submit" class="bf-btn ghost">Check account</button>
    </form>
    ${f.name ? `<div class="bf-ok">✓ ${esc(f.name)}</div>` : ''}
    <button type="button" class="bf-btn" data-act="bank-next" ${f.name ? '' : 'disabled'}>Next</button>
  </div>
  ${recents.length ? `<div class="bf-card"><strong>Recents</strong>
    ${recents.map((r) => `<button type="button" class="bf-recent" data-act="bank-pick" data-acc="${esc(r.accountNumber)}" data-code="${esc(r.bankCode)}">
      <span>${esc(bankName(r.bankCode))}</span><span class="muted" style="font-size:13px">${esc(r.accountNumber)}</span></button>`).join('')}
  </div>` : ''}`;
}

function bankAmountStep(f) {
  const quick = [500, 1000, 2000, 5000, 10000];
  return `<div class="bf-head">
      <div class="bf-avatar">${esc(initials(f.name || '?'))}</div>
      <div style="min-width:0"><strong>${esc(f.name)}</strong>
        <div class="muted" style="font-size:13px">${esc(f.accountNumber)} · ${esc(bankName(f.bankCode))}</div></div>
    </div>
    <form data-form="bank-review">
      <div class="bf-card">
        <span class="muted" style="font-size:13px">Amount</span>
        <div class="bf-amount"><span>₦</span><input name="amount" inputmode="decimal" placeholder="100.00 – 5,000,000.00" value="${esc(f.amount)}" required></div>
        <div class="bf-quick">${quick.map((v) => `<button type="button" data-act="bank-quick" data-v="${v}">₦${v.toLocaleString('en-NG')}</button>`).join('')}</div>
      </div>
      <div class="bf-card">
        <label>Remark (optional)<input name="remark" maxlength="60" placeholder="What's this for?" value="${esc(f.remark)}"></label>
        <label>Category (optional, only visible to you)
          <select name="category">
            <option value="">Choose a category</option>
            ${BANK_CATEGORIES.map((c) => `<option value="${esc(c)}" ${f.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
          </select>
        </label>
      </div>
      <button type="submit" class="bf-btn">Confirm</button>
    </form>`;
}

function bankRows(f) {
  return `<div class="bf-row"><span>Name</span><span>${esc(f.name)}</span></div>
    <div class="bf-row"><span>Account number</span><span>${esc(f.accountNumber)}</span></div>
    <div class="bf-row"><span>Bank</span><span>${esc(bankName(f.bankCode))}</span></div>
    <div class="bf-row"><span>Amount</span><span>${naira(toKobo(f.amount))}</span></div>`;
}

function bankSheet(f) {
  if (f.sheet === 'reminder') {
    return `<div class="bf-sheet-bg"><div class="bf-sheet">
      <div class="row-between"><strong style="font-size:18px">Reminder</strong><button class="small secondary" data-act="bank-sheet-close">✕</button></div>
      <p class="sub" style="margin:10px 0 14px">Double check the transfer details before you proceed. Successful transfers cannot be reversed.</p>
      <div class="bf-card" style="margin:0">${bankRows(f)}</div>
      <div class="bf-two">
        <button type="button" data-act="bank-sheet-close">Recheck</button>
        <button type="button" class="bf-btn" data-act="bank-continue">Continue</button>
      </div>
    </div></div>`;
  }
  if (f.sheet === 'confirm') {
    const kobo = toKobo(f.amount);
    const fee = Number(state.bankFeeKobo || 0);
    return `<div class="bf-sheet-bg"><div class="bf-sheet">
      <div class="row-between"><span></span><button class="small secondary" data-act="bank-sheet-close">✕</button></div>
      <div style="text-align:center;font-size:30px;font-weight:800;margin:4px 0 12px">${naira(kobo)}</div>
      <div class="bf-card" style="margin:0">
        ${bankRows(f)}
        <div class="bf-row"><span>Fee</span><span>${naira(fee)}</span></div>
        <div class="bf-row"><span>Total</span><span>${naira(kobo + fee)}</span></div>
        <div class="bf-row"><span>From</span><span>Available balance ${naira(state.wallet ? state.wallet.mainKobo : 0)}</span></div>
      </div>
      <form data-form="bank-pay" data-approval style="margin-top:12px">
        <input type="hidden" name="idemKey" value="${esc(f.idem)}">
        ${approvalBlock()}
        <button type="submit" class="bf-btn">Pay</button>
      </form>
    </div></div>`;
  }
  return '';
}

function bankSuccessView(f) {
  const r = f.result;
  return `<div class="app-inner bf-success">
    <div class="row-between" style="justify-content:flex-end"><button class="small secondary" data-act="bank-home">Done</button></div>
    <div class="bf-tick">✓</div>
    <h3 style="margin:16px 0 4px">Transfer successful</h3>
    <div style="font-size:30px;font-weight:800">${naira(r.amountKobo)}</div>
    <p class="sub" style="margin:8px 0 0">${esc(r.name)} · ${esc(r.accountNumber)} · ${esc(r.bank)}</p>
    <div class="bf-card" style="text-align:left;margin-top:14px;font-size:14px">The money is on its way. The recipient should be credited shortly. Your history shows the status.</div>
    <div class="bf-two">
      <button type="button" data-act="bank-receipt">View receipt</button>
      <button type="button" data-go="deposit">Add money</button>
    </div>
    <div class="bf-card" style="text-align:left;margin-top:14px"><strong>Special offers for you</strong>
      ${PROMOS.map((p) => `<button type="button" class="bf-recent" ${p.go ? `data-go="${p.go}"` : `data-act="bill-open" data-cat="${p.cat}"`}>
        <span>${esc(p.title)}</span><span class="muted" style="font-size:13px">${esc(p.sub)}</span></button>`).join('')}
    </div>
  </div>`;
}

// ---------- actions ----------
// Looks up the account name and stores it on the flow.
async function bankLookup(f) {
  const r = await api(`/lookup/bank?accountNumber=${encodeURIComponent(f.accountNumber)}&bankCode=${encodeURIComponent(f.bankCode)}`);
  f.name = r.name;
  render();
}

async function bankCheck(d) {
  const f = bankFlow();
  f.bankCode = d.bankCode;
  f.accountNumber = String(d.accountNumber || '').trim();
  f.name = '';
  await bankLookup(f);
}

async function bankPick(el) {
  const f = bankFlow();
  f.bankCode = el.dataset.code;
  f.accountNumber = el.dataset.acc;
  f.name = '';
  f.step = 1;
  render();
  try { await bankLookup(f); } catch (e) { toast(e.message); }
}

function bankQuick(el) {
  const input = el.closest('form').querySelector('input[name="amount"]');
  if (input) input.value = el.dataset.v;
}

// Checks the amount and opens the reminder sheet.
function bankReview(d) {
  const f = bankFlow();
  const kobo = toKobo(String(d.amount || '').replace(/,/g, ''));
  if (!Number.isSafeInteger(kobo) || kobo < BANK_MIN_KOBO) return toast('The smallest transfer is ₦100');
  if (kobo > BANK_MAX_KOBO) return toast('The largest transfer is ₦5,000,000');
  if (kobo + Number(state.bankFeeKobo || 0) > Number(state.wallet?.mainKobo || 0)) return toast('Not enough money in your wallet for this transfer');
  f.amount = String(d.amount).replace(/,/g, '');
  f.remark = String(d.remark || '').trim();
  f.category = d.category || '';
  f.sheet = 'reminder';
  render();
}

async function bankPay(d) {
  const f = bankFlow();
  const kobo = toKobo(f.amount);
  const note = [f.category, f.remark].filter(Boolean).join(' · ').slice(0, 60);
  const r = await api('/transfer/bank', {
    method: 'POST',
    body: {
      accountNumber: f.accountNumber, bankCode: f.bankCode, amount: kobo,
      pin: d.pin, approval: d.approval, idemKey: f.idem, note: note || undefined,
    },
  });
  f.result = {
    amountKobo: kobo, journalId: r.journalId || null, name: f.name,
    accountNumber: f.accountNumber, bank: bankName(f.bankCode),
  };
  f.sheet = null;
  state.idem = newId();
  await loadWallet().catch(() => {});
  render();
}

function bankReceipt() {
  const f = bankFlow();
  if (!f.result || !f.result.journalId) { toast('Your receipt will be ready shortly. Check History.'); return; }
  state.receiptId = f.result.journalId;
  state.bankFlow = null;
  navigate('receipt', { push: true });
}

// The bank transfer screen replaces the old bank form.
const _sendViewBankBase = sendView;
sendView = function () {
  if (state.sendType === 'bank') return bankFlowView();
  return _sendViewBankBase();
};
