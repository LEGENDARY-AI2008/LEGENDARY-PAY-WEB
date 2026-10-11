// Live chat support screens. Users chat with the team on the support screen. Admins reply
// from the admin panel. Loaded before app.js; uses helpers from screens.js and app.js.

// mine = the sender whose messages sit on the right side of this view.
function chatBubble(m, mine) {
  const right = m.from === mine;
  return `<div style="display:flex;justify-content:${right ? 'flex-end' : 'flex-start'};margin:6px 0">
    <div style="max-width:80%;padding:10px 12px;border-radius:14px;white-space:pre-wrap;word-break:break-word;
      background:${right ? 'var(--brand)' : 'var(--card-2)'};color:${right ? '#fff' : 'var(--text)'}">
      ${esc(m.body)}
      <div style="font-size:11px;opacity:.75;margin-top:4px">${esc(when(m.at))}</div>
    </div></div>`;
}

function chatMessagesHtml(list, mine) {
  if (!list || !list.length) return '<p class="muted center" style="margin:0">No messages yet.</p>';
  return list.map((m) => chatBubble(m, mine)).join('');
}

function supportView() {
  const s = state.support || { online: false, messages: [] };
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Live chat</h2></div>
    <p class="sub">${s.online
      ? '<span class="pill">Support is online</span>'
      : 'Support is offline right now. Leave a message here. We will reply in this chat and send you a notification.'}</p>
    <div id="support-msgs" class="card" style="min-height:240px;max-height:55vh;overflow-y:auto">
      ${chatMessagesHtml(s.messages, 'user')}
    </div>
    <form data-form="support-send" style="margin-top:12px;flex-direction:row;align-items:flex-end">
      <label style="flex:1">Message<input name="body" maxlength="500" autocomplete="off" required placeholder="Type your message"></label>
      <button type="submit" class="small" style="width:auto">Send</button>
    </form>
    <p class="note center">Never share your PIN or verification code in chat.</p>
  </div>${nav('me')}`;
}

// Admin side: the open chats, and the one chosen with "Open" (state.adminThread).
function adminSupportCard() {
  const a = state.admin || {};
  const list = a.support || [];
  const open = state.adminThread;
  return `<div class="card">
    <h3 style="font-size:17px;margin-bottom:6px">Live chat</h3>
    <p class="sub">Open chats from users. Replying sends them a notification.</p>
    ${list.length ? `<ul class="list" style="margin-top:10px">${list.map((t) => `<li>
      <div style="min-width:0">
        <div class="t-title">${esc(t.name || 'User')}</div>
        <div class="t-meta">${esc(t.phone || '')} · ${esc(when(t.at))}</div>
        <div class="t-meta" style="white-space:normal">${t.lastSender === 'admin' ? 'You: ' : ''}${esc(t.lastBody || '')}</div>
      </div>
      <button class="small secondary" data-act="admin-thread" data-id="${esc(t.id)}">Open</button>
    </li>`).join('')}</ul>` : '<p class="muted" style="margin:10px 0 0">No open chats.</p>'}

    ${open ? `<div style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px">
      <div class="row-between">
        <strong>Chat #${esc(open.id)}</strong>
        <button class="small secondary" data-act="admin-close-thread" data-id="${esc(open.id)}">Close chat</button>
      </div>
      <div id="admin-msgs" class="card" style="margin-top:10px;max-height:40vh;overflow-y:auto;background:var(--card-2)">
        ${chatMessagesHtml(open.messages, 'admin')}
      </div>
      <form data-form="support-reply" style="margin-top:10px;flex-direction:row;align-items:flex-end">
        <input type="hidden" name="id" value="${esc(open.id)}">
        <label style="flex:1">Reply<input name="body" maxlength="500" required autocomplete="off"></label>
        <button type="submit" class="small" style="width:auto">Reply</button>
      </form>
    </div>` : ''}
  </div>`;
}
