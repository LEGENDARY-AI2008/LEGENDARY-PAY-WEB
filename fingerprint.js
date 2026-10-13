// Fingerprint (or face) on this phone: log in, approve payments, and turn it on.
// The phone checks the fingerprint. This app only receives a signed answer and never sees the fingerprint.
// Loaded before app.js.

const FP_SUPPORTED = !!(window.PublicKeyCredential && navigator.credentials);

function b64uToBuf(s) {
  let b = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (b.length % 4) b += '=';
  const bin = atob(b);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function bufToB64u(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Asks the phone to confirm with its fingerprint. Returns the signed answer as plain JSON.
async function fpGet(opts) {
  const pk = { challenge: b64uToBuf(opts.challenge), timeout: opts.timeout, userVerification: 'required' };
  if (opts.rpId) pk.rpId = opts.rpId;
  if (opts.allowCredentials) pk.allowCredentials = opts.allowCredentials.map((c) => ({ type: 'public-key', id: b64uToBuf(c.id) }));
  const c = await navigator.credentials.get({ publicKey: pk });
  return {
    id: c.id,
    rawId: bufToB64u(c.rawId),
    type: c.type,
    response: {
      clientDataJSON: bufToB64u(c.response.clientDataJSON),
      authenticatorData: bufToB64u(c.response.authenticatorData),
      signature: bufToB64u(c.response.signature),
      userHandle: c.response.userHandle ? bufToB64u(c.response.userHandle) : null,
    },
    clientExtensionResults: {},
    authenticatorAttachment: c.authenticatorAttachment || undefined,
  };
}

// Shown inside every form that moves money out. Either the PIN or the fingerprint is enough.
function approvalBlock() {
  return `<div class="pin-label">Your 4-digit PIN (or use fingerprint)</div>
    <div class="pin4" data-pin4>
      <input type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-d="1" aria-label="PIN digit 1">
      <input type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-d="2" aria-label="PIN digit 2">
      <input type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-d="3" aria-label="PIN digit 3">
      <input type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-d="4" aria-label="PIN digit 4">
      <input type="hidden" name="pin" value="">
    </div>
    <button type="button" class="secondary" data-act="approve-fp">Use fingerprint</button>
    <input type="hidden" name="approval" value="">
    <p class="note fp-status" style="margin:0"></p>`;
}

// Taps "Use fingerprint": asks the phone, then keeps the signed answer in the form until Send.
async function fpApprove(el) {
  const form = el.closest('form');
  const status = form.querySelector('.fp-status');
  const hidden = form.querySelector('input[name="approval"]');
  if (!FP_SUPPORTED) { status.textContent = 'This phone does not support fingerprint. Use your PIN.'; return; }
  try {
    status.textContent = 'Waiting for your fingerprint…';
    const opts = await api('/approve/options', { method: 'POST' });
    hidden.value = JSON.stringify(await fpGet(opts));
    status.textContent = 'Fingerprint confirmed. Now tap the button to send.';
  } catch (e) {
    hidden.value = '';
    status.textContent = e.name === 'NotAllowedError'
      ? 'Fingerprint cancelled. Use your PIN or try again.'
      : (e.message || 'Fingerprint failed. Use your PIN.');
  }
}

// Login screen: log in with a fingerprint already turned on for this phone.
async function fpLogin() {
  if (!FP_SUPPORTED) { toast('This phone does not support fingerprint. Use your PIN.'); return; }
  try {
    const opts = await api('/auth/webauthn/login/options', { method: 'POST', auth: false });
    const answer = await fpGet(opts);
    const r = await api('/auth/webauthn/login/verify', { method: 'POST', auth: false, body: { response: answer } });
    store.set('lp_token', r.token);
    state.wallet = null;
    await loadWallet();
    state.stack = [];
    navigate(nextScreen());
  } catch (e) {
    toast(e.name === 'NotAllowedError' ? 'Fingerprint cancelled.' : (e.message || 'Fingerprint login failed.'));
  }
}

// Security page: turn fingerprint on for this phone (must be logged in).
async function fpRegister() {
  if (!FP_SUPPORTED) { toast('This phone does not support fingerprint.'); return; }
  try {
    const opts = await api('/webauthn/register/options', { method: 'POST' });
    const c = await navigator.credentials.create({
      publicKey: {
        challenge: b64uToBuf(opts.challenge),
        rp: opts.rp,
        user: { id: b64uToBuf(opts.user.id), name: opts.user.name, displayName: opts.user.displayName },
        pubKeyCredParams: opts.pubKeyCredParams,
        timeout: opts.timeout,
        attestation: opts.attestation,
        authenticatorSelection: opts.authenticatorSelection,
        excludeCredentials: (opts.excludeCredentials || []).map((x) => ({ type: 'public-key', id: b64uToBuf(x.id) })),
      },
    });
    const response = {
      id: c.id,
      rawId: bufToB64u(c.rawId),
      type: c.type,
      response: {
        clientDataJSON: bufToB64u(c.response.clientDataJSON),
        attestationObject: bufToB64u(c.response.attestationObject),
        transports: c.response.getTransports ? c.response.getTransports() : [],
      },
      clientExtensionResults: {},
      authenticatorAttachment: c.authenticatorAttachment || undefined,
    };
    const ua = navigator.userAgent || '';
    const name = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android phone' : 'This device';
    await api('/webauthn/register/verify', { method: 'POST', body: { response, name } });
    toast('Fingerprint is on for this phone.');
    render();
  } catch (e) {
    toast(e.name === 'NotAllowedError' ? 'Fingerprint cancelled.' : (e.message || 'Could not turn on fingerprint.'));
  }
}
