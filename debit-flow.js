// Same format for every money-out action (bank transfer style):
// 1. The form the person filled in (send, airtime, bills, goals)
// 2. Reminder sheet (details, Recheck / Continue)
// 3. Confirm sheet (amount, details, balance, PIN or fingerprint, Pay)
// 4. Purple success screen (Done)
// Loaded after app.js. It wraps handleSubmit, so the existing submit handlers still do the payment.

const DEBIT_KINDS = {
  'send-wallet': (form, d) => ({
    title: d.requestId ? 'Pay request' : 'Send money', done: 'Money sent', amountKobo: debitKobo(d.amount),
    rows: [['Recipient wallet', d.toAccount], ['Recipient', (form.querySelector('.recipient')?.textContent || '').trim()], ['Note', d.note]],
  }),
  airtime: (form, d) => ({
    title: 'Buy airtime', done: 'Airtime sent', amountKobo: debitKobo(d.amount),
    rows: [['Network', (form.querySelector('[name="network"]')?.selectedOptions?.[0]?.text) || d.network], ['Phone', d.phone]],
  }),
  'bill-pay': (form, d) => {
    const pick = (n) => { const s = form.querySelector(`select[name="${n}"]`); return s && s.selectedIndex >= 0 ? s.options[s.selectedIndex].text : ''; };
    return {
      title: d.every ? 'Schedule bill' : 'Pay bill', done: d.every ? 'Bill scheduled' : 'Bill paid', amountKobo: debitKobo(d.amount),
      rows: [['Provider', pick('biller')], ['Plan', pick('item')], ['Number', d.customer], ['Repeats', d.every ? `Every ${d.every === '7' ? 'week' : 'month'}` : '']],
    };
  },
  'goal-move': (form, d) => ({
    title: d.direction === 'in' ? 'Save to goal' : 'Take out of goal', done: d.direction === 'in' ? 'Saved to goal' : 'Moved to wallet',
    amountKobo: debitKobo(d.amount), fromGoal: d.direction !== 'in',
    rows: [['Direction', d.direction === 'in' ? 'From wallet to goal' : 'From goal to wallet']],
  }),
};

function debitKobo(v) {
  try { return toKobo(String(v || '').replace(/,/g, '')); } catch (e) { return 0; }
}

// Forms that take money out. Other forms (login, settings, admin) keep their old behaviour.
const _handleSubmitBeforeDebit = handleSubmit;
handleSubmit = async function (form) {
  const kind = form.dataset.form;
  if (!DEBIT_KINDS[kind]) return _handleSubmitBeforeDebit(form);
  const d = Object.fromEntries(new FormData(form));
  const j = DEBIT_KINDS[kind](form, d);
  if (j.amountKobo <= 0 && !['bill-pay'].includes(kind)) return toast('Enter an amount between ₦10 and ₦500,000');
  if (j.amountKobo > 0 && !j.fromGoal && j.amountKobo > Number(state.wallet?.mainKobo || 0)) return toast('Not enough money in your wallet for this');
  state.debit = { kind, data: d, ...j, sheet: 'reminder', result: null };
  debitRender();
};

function debitLayer() {
  let layer = document.getElementById('debit-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'debit-layer';
    layer.style.cssText = 'position:fixed;inset:0;z-index:70;overflow:auto;background:var(--bg,#fff)';
    layer.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (act && ACTIONS[act.dataset.act]) ACTIONS[act.dataset.act](act);
    });
    layer.addEventListener('submit', (e) => { e.preventDefault(); handleSubmit(e.target); });
    document.body.appendChild(layer);
  }
  return layer;
}

function debitRender() {
  const layer = debitLayer();
  const j = state.debit;
  if (!j) { layer.hidden = true; layer.innerHTML = ''; return; }
  layer.hidden = false;
  layer.innerHTML = BANK_FLOW_CSS + (j.result ? debitSuccess(j) : debitSheet(j));
}

function debitRows(j) {
  return j.rows.filter(([, v]) => v !== undefined && v !== null && String(v) !== '')
    .map(([k, v]) => `<div class="bf-row"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('');
}

function debitSheet(j) {
  const amountText = j.amountKobo > 0 ? naira(j.amountKobo) : 'As shown on the plan';
  if (j.sheet === 'reminder') {
    return `<div class="bf-sheet-bg"><div class="bf-sheet">
      <div class="row-between"><strong style="font-size:18px">Reminder</strong><button class="small secondary" data-act="debit-close">✕</button></div>
      <p class="sub" style="margin:10px 0 14px">Double check the details before you pay. Successful payments cannot be reversed.</p>
      <div class="bf-card" style="margin:0">${debitRows(j)}${j.amountKobo > 0 ? `<div class="bf-row"><span>Amount</span><span>${naira(j.amountKobo)}</span></div>` : ''}</div>
      <div class="bf-two">
        <button type="button" data-act="debit-close">Recheck</button>
        <button type="button" class="bf-btn" data-act="debit-continue">Continue</button>
      </div>
    </div></div>`;
  }
  return `<div class="bf-sheet-bg"><div class="bf-sheet">
    <div class="row-between"><span></span><button class="small secondary" data-act="debit-close">✕</button></div>
    <div style="text-align:center;font-size:30px;font-weight:800;margin:4px 0 12px">${amountText}</div>
    <div class="bf-card" style="margin:0">
      ${debitRows(j)}
      <div class="bf-row"><span>From</span><span>Available balance ${naira(state.wallet ? state.wallet.mainKobo : 0)}</span></div>
    </div>
    <form data-form="debit-pay" data-approval style="margin-top:12px">
      ${approvalBlock()}
      <button type="submit" class="bf-btn">Pay</button>
    </form>
  </div></div>`;
}

function debitSuccess(j) {
  return `${BANK_FLOW_CSS}<div class="app-inner bf-success">
    <div class="row-between" style="justify-content:flex-end"><button class="small secondary" data-act="debit-done">Done</button></div>
    <div class="bf-tick">✓</div>
    <h3 style="margin:16px 0 4px">${esc(j.done)}</h3>
    <div style="font-size:30px;font-weight:800">${j.amountKobo > 0 ? naira(j.amountKobo) : ''}</div>
    <div class="bf-card" style="text-align:left;margin-top:14px">${debitRows(j)}</div>
    <div class="bf-card" style="text-align:left;margin-top:14px;font-size:14px">Your history shows this payment. If it failed, the money goes back to your wallet.</div>
  </div>`;
}

ACTIONS['debit-close'] = () => { state.debit = null; debitRender(); };
ACTIONS['debit-continue'] = () => { state.debit.sheet = 'confirm'; debitRender(); };
ACTIONS['debit-done'] = () => { state.debit = null; debitRender(); navigate('home'); };

// Runs the real payment handler with the PIN or fingerprint approval from the confirm sheet.
// A failure keeps the sheet open, and the error shows as a toast.
SUBMIT['debit-pay'] = async (d) => {
  const j = state.debit;
  if (!j) return;
  await SUBMIT[j.kind]({ ...j.data, pin: d.pin, approval: d.approval });
  j.result = true;
  j.sheet = null;
  debitRender();
};
