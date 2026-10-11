// Home screen install banner and QR scanner for sending money. Loaded before app.js.

// ---------- install banner ----------
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  if (state.screen === 'home') render();
});

function isInstalledApp() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// Shows on Home until the user installs or taps "Not now".
function installBannerHtml() {
  if (isInstalledApp() || store.get('lp_install_hidden') === '1') return '';
  const ios = /iPhone|iPad/.test(navigator.userAgent || '');
  if (!deferredInstall && !ios) return '';
  return `<div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:10px">
    <div style="min-width:0">
      <strong>Add Legendary Pay to your phone</strong>
      <p class="sub" style="margin:4px 0 0">${ios
        ? 'Tap the Share button, then Add to Home Screen.'
        : 'Open it in one tap from your home screen.'}</p>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;flex:none">
      ${ios ? '' : '<button class="small" data-act="install-app">Install</button>'}
      <button class="small secondary" data-act="dismiss-install">Not now</button>
    </div>
  </div>`;
}

async function installApp() {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  try { await deferredInstall.userChoice; } catch {}
  deferredInstall = null;
  render();
}

function dismissInstall() {
  store.set('lp_install_hidden', '1');
  render();
}

// ---------- QR scanner (Send to a wallet) ----------
let scanStream = null;
let scanTimer = null;
let scanOverlay = null;

function stopScan() {
  clearTimeout(scanTimer);
  scanTimer = null;
  if (scanStream) scanStream.getTracks().forEach((t) => t.stop());
  scanStream = null;
  if (scanOverlay) scanOverlay.remove();
  scanOverlay = null;
}

function openScanOverlay() {
  scanOverlay = document.createElement('div');
  scanOverlay.className = 'scan-layer';
  scanOverlay.innerHTML = `
    <div class="scan-box">
      <video playsinline muted></video>
      <div class="scan-frame"></div>
    </div>
    <p class="scan-text">Point the camera at a Legendary Pay QR code</p>
    <button class="secondary scan-close" type="button" data-act="scan-close">Cancel</button>`;
  document.body.appendChild(scanOverlay);
  // The overlay sits outside the main page, so it needs its own click handler.
  scanOverlay.querySelector('.scan-close').addEventListener('click', stopScan);
  return scanOverlay.querySelector('video');
}

async function startScan() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast('Camera is not available here. Type the wallet number instead.');
    return;
  }
  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js', 'jsQR');
    const video = openScanOverlay();
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = scanStream;
    await video.play();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const look = () => {
      if (!scanStream) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code && code.data) {
          stopScan();
          useQrText(code.data);
          return;
        }
      }
      scanTimer = setTimeout(look, 150);
    };
    look();
  } catch (e) {
    stopScan();
    toast(e.name === 'NotAllowedError'
      ? 'Allow camera access to scan a code.'
      : 'Could not open the camera. Type the wallet number instead.');
  }
}

// ---------- shared helpers for QR images ----------
// Fills the send form from a decoded QR code (must be a 10-digit wallet number).
function useQrText(raw) {
  const text = String(raw || '').trim();
  if (/^\d{10}$/.test(text)) {
    prefillSend('wallet', { toAccount: text });
    toast('Wallet number found. Enter the amount and PIN.');
  } else {
    toast('That is not a Legendary Pay code.');
  }
}

function loadImageFrom(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = src;
  });
}

// Makes a QR code image (PNG data URL) for the user's wallet number.
async function makeQrDataUrl(text) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js', 'QRCode');
  const holder = document.createElement('div');
  holder.style.display = 'none';
  document.body.appendChild(holder);
  try {
    new QRCode(holder, { text, width: 460, height: 460, colorDark: '#1B1145', colorLight: '#FFFFFF' });
    const canvas = holder.querySelector('canvas');
    if (canvas) return canvas.toDataURL('image/png');
    const img = holder.querySelector('img');
    return img ? img.src : '';
  } finally {
    holder.remove();
  }
}

// Saves a PNG card: the QR, the app name and the wallet number, ready to share.
async function downloadQr() {
  const w = state.wallet;
  if (!w || !w.account_number) return;
  try {
    const qrUrl = await makeQrDataUrl(w.account_number);
    const qr = await loadImageFrom(qrUrl);
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 800;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#1B1145';
    ctx.textAlign = 'center';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText('Legendary Pay', 320, 80);
    ctx.drawImage(qr, 90, 120, 460, 460);
    ctx.font = 'bold 40px monospace';
    ctx.fillText(w.account_number, 320, 660);
    ctx.font = '26px sans-serif';
    ctx.fillStyle = '#6B5FA0';
    ctx.fillText('Scan this code to send me money', 320, 730);
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = 'legendary-pay-qr-' + w.account_number + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('QR saved to your phone.');
  } catch (e) {
    toast(e.message || 'Could not make the QR image. Try again.');
  }
}

// Opens the phone's photo picker, then reads a QR code from the chosen picture.
function uploadQr() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => { if (input.files && input.files[0]) readQrFile(input.files[0]); };
  input.click();
}

async function readQrFile(file) {
  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js', 'jsQR');
    const url = URL.createObjectURL(file);
    const img = await loadImageFrom(url);
    URL.revokeObjectURL(url);
    // Shrink big photos first, so reading is quick.
    const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const px = ctx.getImageData(0, 0, c.width, c.height);
    const code = window.jsQR(px.data, px.width, px.height, { inversionAttempts: 'attemptBoth' });
    if (code && code.data) useQrText(code.data);
    else toast('No Legendary Pay code found in that picture. Try a clearer one.');
  } catch (e) {
    toast(e.message || 'Could not read that picture.');
  }
}

// ---------- statements and receipts ----------
function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Saves a month of transactions as a CSV file, with totals at the bottom.
function downloadStatement(month, rows) {
  const naira2 = (k) => (Math.abs(Number(k)) / 100).toFixed(2);
  let totalIn = 0;
  let totalOut = 0;
  const lines = [['Date', 'Type', 'Money in (NGN)', 'Money out (NGN)', 'Note', 'Reference'].join(',')];
  for (const t of rows) {
    const amt = Number(t.amountKobo || 0);
    if (amt > 0) totalIn += amt; else totalOut += -amt;
    const date = t.at ? new Date(t.at).toLocaleDateString('en-CA') : '';
    lines.push([
      csvCell(date),
      csvCell(TX_LABELS[t.kind] || t.kind),
      csvCell(amt > 0 ? naira2(amt) : ''),
      csvCell(amt < 0 ? naira2(amt) : ''),
      csvCell(t.note || ''),
      csvCell(t.id),
    ].join(','));
  }
  lines.push('');
  lines.push(['Total', '', naira2(totalIn), naira2(totalOut), '', ''].join(','));
  // The BOM helps Excel read the file as UTF-8 (for the ₦ sign and names).
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `legendary-pay-statement-${month}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Makes a picture of the receipt, then opens the phone's share sheet (WhatsApp, etc.).
async function shareReceipt() {
  const r = state.receipt;
  if (!r) return;
  const amt = Number(r.amountKobo || 0);
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 760;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1B1145';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('Legendary Pay', 320, 80);
  ctx.font = '26px sans-serif';
  ctx.fillStyle = '#6B5FA0';
  ctx.fillText('Payment receipt', 320, 125);
  ctx.fillStyle = amt < 0 ? '#B3261E' : '#1F7A3A';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText((amt < 0 ? '-' : '+') + naira(Math.abs(amt)), 320, 260);
  ctx.fillStyle = '#1B1145';
  ctx.font = '30px sans-serif';
  ctx.fillText(TX_LABELS[r.kind] || r.kind, 320, 320);
  ctx.fillStyle = '#6B5FA0';
  ctx.font = '24px sans-serif';
  ctx.fillText(r.at ? new Date(r.at).toLocaleString('en-NG') : '', 320, 360);
  ctx.textAlign = 'left';
  const rows = [['Reference', r.reference || '-'], ['Receipt ID', r.id]];
  if (r.note) rows.unshift(['Note', r.note]);
  let y = 440;
  for (const [label, value] of rows) {
    ctx.fillStyle = '#6B5FA0';
    ctx.font = '22px sans-serif';
    ctx.fillText(label, 60, y);
    ctx.fillStyle = '#1B1145';
    ctx.font = '22px monospace';
    ctx.fillText(String(value).slice(0, 44), 60, y + 32);
    y += 90;
  }
  c.toBlob(async (blob) => {
    if (!blob) { toast('Could not make the receipt picture.'); return; }
    const file = new File([blob], 'legendary-pay-receipt.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Legendary Pay receipt' }); } catch {}
      return;
    }
    // No share sheet here (for example on a laptop): save the picture instead.
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'legendary-pay-receipt.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

// ---------- statement periods: day, week, month or year ----------
const pad2 = (n) => String(n).padStart(2, '0');
const ymdOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Changes the input when the period changes (date, month or year).
function setStatementPeriod(select) {
  const form = select.closest('form');
  const input = form.querySelector('input[name="when"]');
  const label = form.querySelector('input[name="when"]').closest('label');
  const now = new Date();
  const ym = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const cfg = {
    daily: ['date', 'Pick a day', ymdOf(now)],
    weekly: ['date', 'Pick any day in that week', ymdOf(now)],
    monthly: ['month', 'Pick a month', ym],
    yearly: ['number', 'Pick a year', String(now.getFullYear())],
  }[select.value] || ['month', 'Pick a month', ym];
  input.type = cfg[0];
  input.value = cfg[2];
  if (cfg[0] === 'number') { input.min = '2000'; input.max = String(now.getFullYear()); input.step = '1'; }
  else { input.removeAttribute('min'); input.removeAttribute('max'); input.removeAttribute('step'); }
  label.childNodes[0].textContent = cfg[1];
}

// Works out the first and last day for the statement, and a name for the file.
function statementRange(period, when) {
  const w = String(when || '');
  if (period === 'yearly') {
    if (!/^\d{4}$/.test(w)) throw new Error('Pick a year');
    return { from: `${w}-01-01`, to: `${w}-12-31`, label: w };
  }
  if (period === 'monthly') {
    if (!/^\d{4}-\d{2}$/.test(w)) throw new Error('Pick a month');
    const [y, m] = w.split('-').map(Number);
    return { from: `${w}-01`, to: `${w}-${pad2(new Date(y, m, 0).getDate())}`, label: w };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(w)) throw new Error('Pick a date');
  if (period === 'daily') return { from: w, to: w, label: w };
  // Weekly: the Monday to Sunday that contains the chosen day.
  const d = new Date(w + 'T00:00:00');
  const start = new Date(d);
  start.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const from = ymdOf(start);
  const to = ymdOf(end);
  return { from, to, label: `${from}_to_${to}` };
}
