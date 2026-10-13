// Phone Back button. Goes to the page before (or closes the open sheet first) instead of closing the app.
// The app only closes when there is no earlier page left. Loaded last, after debit-flow.js and ai-chat.js.
(function () {
  // A page is described by its screen, how deep the stack is, and whether the debit sheet is open.
  const keyNow = () => [state.screen, state.stack.length, state.debit ? 'debit' : ''].join('|');
  let entries = [];   // the pages we have shown, oldest first
  let idx = -1;       // where we are now in entries
  let ignorePop = false;  // our own history.back / forward calls must not trigger the app back
  let inBack = false;     // renders caused by the app back are handled by appBack itself

  const move = (delta) => { ignorePop = true; history.go(delta); };
  const keepEntry = (k) => { entries[idx] = k; try { history.replaceState({ lp: 1 }, ''); } catch (e) {} };

  function syncHistory() {
    if (inBack) return;
    const k = keyNow();
    if (idx < 0) { entries = [k]; idx = 0; keepEntry(k); return; }
    if (k === entries[idx]) return;
    // The app went back one page on its own (Back button on the screen): step the browser back too.
    if (idx > 0 && k === entries[idx - 1]) { idx--; move(-1); return; }
    // Replacing instead of adding: after login, after a debit sheet closes, or a tab on its own.
    if (entries[idx].startsWith('login|') || entries[idx].endsWith('|debit')) { keepEntry(k); return; }
    entries.length = idx + 1;
    entries.push(k);
    idx++;
    if (entries.length > 60 && idx >= 20) { entries.splice(0, 20); idx -= 20; }
    try { history.pushState({ lp: 1 }, ''); } catch (e) {}
  }

  function appBack() {
    if (state.debit) { state.debit = null; debitRender(); return; }
    ACTIONS.back();
  }

  window.addEventListener('popstate', () => {
    if (ignorePop) { ignorePop = false; return; }
    if (idx <= 0) return;
    idx--;
    const before = keyNow();
    inBack = true;
    try { appBack(); } finally { inBack = false; }
    if (keyNow() === before) {
      // Nothing on the screen changed (e.g. a sheet closed inside the page): stay here.
      idx++;
      move(1);
    } else if (keyNow() !== entries[idx]) {
      entries[idx] = keyNow();
    }
  });

  // Wrap render and debitRender so every screen change is recorded.
  const _renderBase = render;
  render = function () { _renderBase(); syncHistory(); };
  const _debitRenderBase = debitRender;
  debitRender = function () { _debitRenderBase(); syncHistory(); };
})();
