// Four-box PIN entry. Shows a number keypad, one digit per box, and moves to the next box by itself.
// The digits are collected into the hidden field named "pin", so every form keeps working as before.
(function () {
  const style = document.createElement('style');
  style.textContent = `
    .pin-label{font-size:14px;color:var(--muted,#8A8398);margin:8px 0 2px}
    .pin4{display:flex;gap:10px;justify-content:center;margin:8px 0 14px}
    .pin4 input{width:58px;height:62px;text-align:center;font-size:26px;font-weight:700;border-radius:14px;border:1.5px solid var(--line,#E2D9FA);background:var(--card,#fff);color:var(--text,#1B1145);padding:0;margin:0;box-shadow:none}
    .pin4 input:focus{border-color:var(--brand,#7B3FF2);outline:none}`;
  document.head.appendChild(style);

  const boxesOf = (box) => [...box.querySelectorAll('input[data-d]')];
  const sync = (box) => {
    const digits = boxesOf(box).map((i) => i.value).join('');
    box.querySelector('input[type="hidden"][name="pin"]').value = /^\d{4}$/.test(digits) ? digits : '';
  };

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.matches || !el.matches('.pin4 input[data-d]')) return;
    const box = el.closest('.pin4');
    const i = Number(el.dataset.d);
    const clean = el.value.replace(/\D/g, '');
    if (e.inputType === 'insertFromPaste' && clean.length > 1) {
      const all = clean.slice(0, 4).split('');
      boxesOf(box).forEach((inp, k) => { inp.value = all[k] || ''; });
      const next = boxesOf(box)[Math.min(all.length, 4) - 1];
      if (next) next.focus();
    } else {
      el.value = clean.slice(-1);
      if (el.value && i < 4) {
        const next = box.querySelector(`input[data-d="${i + 1}"]`);
        if (next) next.focus();
      }
    }
    sync(box);
  });

  document.addEventListener('keydown', (e) => {
    const el = e.target;
    if (!el.matches || !el.matches('.pin4 input[data-d]')) return;
    if (e.key !== 'Backspace' || el.value) return;
    const box = el.closest('.pin4');
    const prev = box.querySelector(`input[data-d="${Number(el.dataset.d) - 1}"]`);
    if (prev) { e.preventDefault(); prev.value = ''; prev.focus(); sync(box); }
  });
})();
