// AI support assistant screen. Answers app questions only. A person is one tap away (Live chat).
// Loaded after app.js. Uses the app helpers: state, api, render, toast, esc, backBtn, navigate, VIEWS, SUBMIT, ACTIONS.

state.ai = state.ai || { msgs: [], busy: false, handoff: false };

const AI_CSS = `<style>
.ai-bubble{max-width:85%;padding:10px 13px;border-radius:16px;font-size:14px;line-height:1.45;white-space:pre-wrap;margin:6px 0}
.ai-me{margin-left:auto;background:#7B3FF2;color:#fff;border-bottom-right-radius:4px}
.ai-bot{margin-right:auto;background:var(--card-2,#F1ECFF);color:var(--text);border-bottom-left-radius:4px}
.ai-note{font-size:12px;color:var(--muted,#8A8398);margin:0 0 10px}
</style>`;

function aiView() {
  const s = state.ai;
  const bubbles = s.msgs.length
    ? s.msgs.map((m) => `<div class="ai-bubble ${m.role === 'user' ? 'ai-me' : 'ai-bot'}">${esc(m.content)}</div>`).join('')
    : '<p class="sub" style="margin:0">Hi! Ask me anything about Legendary Pay, like how to send money, buy airtime or pay a bill.</p>';
  return `${AI_CSS}<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>AI assistant</h2></div>
    <p class="ai-note">The AI can answer questions about the app. It cannot see your balance or change your money. Never share your PIN with anyone.</p>
    <div id="ai-msgs" class="card" style="min-height:240px;max-height:55vh;overflow-y:auto">${bubbles}
      ${s.busy ? '<div class="ai-bubble ai-bot">Typing…</div>' : ''}
    </div>
    ${s.handoff ? '<p class="note">For this, a person can help you best.</p>' : ''}
    <button type="button" class="secondary" data-act="ai-handoff" style="margin-top:10px">Talk to a person (Live chat)</button>
    <form data-form="ai-send" style="margin-top:12px;flex-direction:row;align-items:flex-end">
      <input name="message" maxlength="1000" placeholder="Type your question" required autocomplete="off" style="flex:1">
      <button type="submit" ${s.busy ? 'disabled' : ''}>Send</button>
    </form>
  </div>`;
}

VIEWS.ai = () => aiView();

// Adds an "Ask the AI assistant first" button at the top of Live chat.
const _supportViewBeforeAI = supportView;
supportView = function () {
  const html = _supportViewBeforeAI();
  return html.replace('<div class="topbar"><h2>Live chat</h2></div>',
    '<div class="topbar"><h2>Live chat</h2></div><button type="button" class="secondary" data-go="ai" style="margin-bottom:10px">Ask the AI assistant first</button>');
};

SUBMIT['ai-send'] = async (d) => {
  const text = String(d.message || '').trim();
  if (!text) return;
  const s = state.ai;
  s.msgs.push({ role: 'user', content: text });
  s.busy = true;
  s.handoff = false;
  render();
  try {
    const r = await api('/ai/chat', { method: 'POST', body: { messages: s.msgs.slice(-12) } });
    s.msgs.push({ role: 'assistant', content: r.reply });
    s.handoff = Boolean(r.handoff);
  } catch (e) {
    s.msgs.push({ role: 'assistant', content: e.message || 'The assistant is busy right now. Please use Live chat.' });
    s.handoff = true;
  } finally {
    s.busy = false;
    render();
  }
};

ACTIONS['ai-handoff'] = async () => {
  const lastUser = [...state.ai.msgs].reverse().find((m) => m.role === 'user');
  const note = lastUser ? `From AI assistant. Customer asked: ${lastUser.content}` : 'From AI assistant. Customer wants to talk to a person.';
  try {
    await api('/support/messages', { method: 'POST', body: { body: note.slice(0, 500) } });
  } catch (e) { /* the customer can still type in Live chat */ }
  navigate('support', { push: true });
};
