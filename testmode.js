// Test-mode notice. Shown once after sign-in. The cancel button (top right) closes it.
// Airtime stays visible. This notice tells people that some services are still being tested.
window.showTestNotice = function () {
  if (window.__testNoticeDone || document.getElementById('test-notice')) return;
  const box = document.createElement('div');
  box.id = 'test-notice';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  box.innerHTML = `
    <div style="background:#fff;color:#111;max-width:420px;width:100%;border-radius:14px;padding:22px 20px;position:relative;font-family:inherit;">
      <button id="test-notice-x" aria-label="Cancel" style="position:absolute;top:10px;right:12px;border:0;background:none;font-size:22px;cursor:pointer;color:#333;">&times;</button>
      <h2 style="margin:0 0 10px;font-size:20px;">We are in test mode</h2>
      <p style="margin:0 0 10px;line-height:1.45;">Legendary Pay is still in test mode. We are testing some things, so not all services are fully working yet.</p>
      <p style="margin:0 0 10px;line-height:1.45;">Airtime is still being tested and may not go through. Please do not rely on it for now. Some other services may also be paused while we test.</p>
      <p style="margin:0 0 16px;line-height:1.45;">Thank you for your patience.</p>
      <button id="test-notice-ok" style="width:100%;padding:12px;border:0;border-radius:10px;background:#111;color:#fff;font-size:16px;cursor:pointer;">Continue</button>
    </div>`;
  document.body.appendChild(box);
  const close = () => { window.__testNoticeDone = true; box.remove(); };
  document.getElementById('test-notice-x').onclick = close;
  document.getElementById('test-notice-ok').onclick = close;
};
