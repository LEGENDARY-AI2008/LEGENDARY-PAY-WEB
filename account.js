// Delete account screen. The PIN or fingerprint approves it, plus a typed DELETE.
function deleteAccountView() {
  return `<div class="app-inner">
    ${backBtn()}
    <div class="topbar"><h2>Delete account</h2></div>
    <div class="card">
      <p><strong>This closes your Legendary Pay wallet.</strong></p>
      <p class="note">You cannot sign in again with this phone number or email. Your name, phone, email, PIN, saved people, bank details and reminders are removed. Your wallet must be at ₦0 before you can delete it.</p>
      <p class="note">We keep your transaction history for our records, as the law requires. You can download a copy of your data first in Settings.</p>
      <form data-form="delete-account" data-approval>
        <label>Type DELETE to confirm<input name="confirm" autocomplete="off" required></label>
        ${approvalBlock()}
        <button type="submit" style="background:var(--danger)">Delete my account</button>
      </form>
    </div>
    <p class="note"><a href="/privacy" target="_blank" rel="noopener">Read our privacy policy</a></p>
  </div>${nav('me')}`;
}
