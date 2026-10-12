// Customer support screen. It is shown as "Support" only.
// First the customer talks to a helper that answers app questions. If it cannot help, a "Talk to our team"
// button appears and the chat moves to our team. Pictures can be sent in both parts.
// Loaded after app.js and support.js. Uses helpers: state, api, render, toast, esc, backBtn, nav, chatBubble, CHAT_CSS, VIEWS, SUBMIT, ACTIONS.

state.ai = state.ai || { msgs: [], busy: false, handoff: false };
state.supportHuman = state.supportHuman || false;

// True once the chat has moved to our team (or the customer already has messages in it).
function csHuman() {
  return Boolean(state.supportHuman || ((state.support && state.support.messages) || []).length);
}

function csThreadHtml() {
  if (csHuman()) {
    const list = (state.support && state.support.messages) || [];
    return list.length
      ? list.map((m) => chatBubble(m, 'user')).join('')
      : '<p class="muted center" style="margin:0">Send us a message. We reply here.</p>';
  }
  const bubbles = state.ai.msgs.map((m) => chatBubble({ from: m.role === 'user' ? 'user' : 'bot', body: m.content }, 'user')).join('');
  const greet = '<p class="sub" style="margin:0">Hi 👋 How can we help you today? You can ask about sending money, airtime, bills or your account.</p>';
  return (bubbles || greet) + (state.ai.busy ? '<div style="margin:6px 0;color:var(--muted,#8A8398);font-size:13px">Typing…</div>' : '');
}

VIEWS.support = () => {
  const human = csHuman();
  const s = state.support || { online: false };
  return `${CHAT_CSS}<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Support</h2></div>
    <p class="sub" style="margin:0 0 8px">${human
      ? (s.online ? '<span class="pill">Our team is online</span>' : 'We will reply here and send you a notification.')
      : 'Ask us anything about your account or the app.'}</p>
    <div id="support-msgs" class="cs-thread">${csThreadHtml()}</div>
    ${!human && state.ai.handoff ? `<div class="cs-banner">Want to speak with our team?
      <button type="button" class="secondary" data-act="support-connect" style="margin-top:8px">Talk to our team</button></div>` : ''}
    <form data-form="${human ? 'support-send' : 'ai-send'}" class="cs-bar" autocomplete="off">
      <button type="button" class="cs-icon" data-pick="chat-file" title="Send a picture">📎</button>
      <div class="cs-field"><input id="chat-input" name="${human ? 'body' : 'message'}" maxlength="500" placeholder="Type a message"></div>
      <button type="submit" class="cs-send" aria-label="Send">➤</button>
    </form>
    <input type="file" id="chat-file" accept="image/*" hidden data-chat-file>
    <p class="note center" style="margin-top:8px">Never share your PIN or verification code in chat.</p>
  </div>${nav('me')}`;
};

// Customer's text to the helper.
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
    s.msgs.push({ role: 'assistant', content: e.message || 'Please try again later or talk to our team.' });
    s.handoff = true;
  } finally {
    s.busy = false;
    render();
  }
};

// Customer's text to our team.
SUBMIT['support-send'] = async (d) => {
  const body = String(d.body || '').trim();
  if (!body) return;
  await api('/support/messages', { method: 'POST', body: { body } });
  state.support = await api('/support');
  render();
};

// Moves the chat to our team. The customer's last question goes to the team so they know what it is about.
async function csConnect({ quiet = false } = {}) {
  if (csHuman()) return;
  const lastUser = [...state.ai.msgs].reverse().find((m) => m.role === 'user');
  const note = lastUser ? `Customer asked for our team. Last question: ${lastUser.content}` : 'Customer asked for our team.';
  await api('/support/messages', { method: 'POST', body: { body: note.slice(0, 500) } });
  state.supportHuman = true;
  state.support = await api('/support');
  if (!quiet) render();
}
ACTIONS['support-connect'] = async () => {
  try { await csConnect(); } catch (e) { toast(e.message); }
};

// Reads a picture and makes it small enough to send (about 300 KB or less).
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      for (const [side, quality] of [[1024, 0.75], [800, 0.6], [640, 0.5]]) {
        const scale = Math.min(1, side / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const out = c.toDataURL('image/jpeg', quality);
        if (out.length <= 390000) return resolve(out);
      }
      reject(new Error('That picture is too big. Try a smaller one.'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not open that picture.')); };
    img.src = url;
  });
}

// Customer sends a picture. Text typed in the box goes with it as a caption.
async function csSendPicture(file) {
  if (!file.type.startsWith('image/')) return toast('Please choose a picture');
  try {
    const image = await compressImage(file);
    const caption = (document.getElementById('chat-input')?.value || '').trim().slice(0, 500);
    await csConnect({ quiet: true });
    await api('/support/messages', { method: 'POST', body: { body: caption, image } });
    state.support = await api('/support');
    render();
  } catch (e) { toast(e.message); }
}

// Admin sends a picture in the open chat. Text typed in the reply box goes with it.
async function adminSendPicture(id, file) {
  if (!file.type.startsWith('image/')) return toast('Please choose a picture');
  try {
    const image = await compressImage(file);
    const body = (document.getElementById('admin-reply-body')?.value || '').trim().slice(0, 500);
    await api(`/admin/support/${encodeURIComponent(id)}/reply`, { method: 'POST', body: { body, image } });
    state.adminThread = await api(`/admin/support/${encodeURIComponent(id)}`);
    state.admin = { ...state.admin, support: await api('/admin/support') };
    render();
  } catch (e) { toast(e.message); }
}

// Opens the file picker from a button that has data-pick="<input id>".
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-pick]');
  if (!b) return;
  const f = document.getElementById(b.dataset.pick);
  if (f) f.click();
});

// A picture was chosen (customer or admin).
document.addEventListener('change', (e) => {
  const input = e.target;
  if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  if (input.dataset.adminId) adminSendPicture(input.dataset.adminId, file);
  else if (input.hasAttribute('data-chat-file')) csSendPicture(file);
});

// Refreshes the chat every few seconds, but only once it is with our team, and never while typing.
refreshSupport = async function () {
  if (state.screen !== 'support' || !csHuman()) return;
  try { state.support = await api('/support', { quiet: true }); } catch { return; }
  if (state.screen !== 'support') return;
  const input = document.getElementById('chat-input');
  if (input && input.value.trim() !== '') return;
  render();
};
