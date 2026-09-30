// Public legal pages served by the API so the app stores get stable URLs:
//   /privacy   /terms   /delete-account
// IMPORTANT: these are solid starting templates, NOT legal advice. Have a lawyer review them
// (especially because the app touches health-related data) before store submission.

const APP = process.env.APP_NAME || 'Sugar Detox';
const COMPANY = process.env.COMPANY_NAME || 'the Sugar Detox team';
const EMAIL = process.env.SUPPORT_EMAIL || 'support@example.com';
const UPDATED = process.env.LEGAL_LAST_UPDATED || '30 September 2026';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function layout(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · ${esc(APP)}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:0 auto;padding:24px;line-height:1.6;color:#18151D;background:#FBF7FF}h1{color:#35127F}h2{margin-top:32px;color:#5D2EE8}a{color:#5D2EE8}.note{background:#FFE99A;padding:12px 16px;border-radius:12px}</style></head>
<body><h1>${esc(title)}</h1><p><em>Last updated: ${esc(UPDATED)}</em></p>${body}</body></html>`;
}

const disclaimer = `<div class="note"><strong>Not medical advice.</strong> ${esc(APP)} is a habit-tracking and wellness tool. It does not diagnose, treat or prevent any condition and is not a substitute for professional medical advice. If you have diabetes or any other medical condition, follow your care plan and talk to your doctor or dietitian before changing your diet.</div>`;

const privacy = () => layout('Privacy Policy', `
<p>This policy explains what ${esc(APP)} (“the app”), operated by ${esc(COMPANY)}, collects, why, and the choices you have.</p>
<h2>Information we collect</h2>
<ul>
<li><strong>Account data:</strong> your name, email address and a password (stored only as a salted bcrypt hash, never in plain text).</li>
<li><strong>Health &amp; habit data you enter:</strong> your goals, sugar log entries (food, quantity, estimated grams of sugar), daily check-ins, challenge progress, points and reward requests, and reminder preferences.</li>
<li><strong>Technical data:</strong> standard server logs (IP address, request time) used for security and abuse prevention.</li>
</ul>
<h2>Camera and barcode scanning</h2>
<p>The camera is used only on your device to read a product barcode. Images and video are <strong>not</strong> stored or uploaded. When a barcode is scanned, only the barcode number is sent to the public Open Food Facts database to look up the product’s sugar content.</p>
<h2>Notifications</h2>
<p>Reminders are scheduled locally on your device. You can turn them off in the app or in your phone settings.</p>
<h2>How we use your data</h2>
<p>To provide the app (sync your progress across devices, show statistics and streaks), to secure accounts, and to send password-reset emails you request. We do <strong>not</strong> sell your data, and we do not use it for advertising.</p>
<h2>Sharing</h2>
<p>We use service providers to run the app: cloud hosting and database, and an email delivery provider for password-reset emails. They process data only on our behalf. We may disclose data if required by law.</p>
<h2>Retention and deletion</h2>
<p>We keep your data while your account is active. You can permanently delete your account and all associated data at any time in the app (Settings → Delete account) or see <a href="/delete-account">/delete-account</a>. Deleted data is removed from our database immediately; routine backups expire within a limited period.</p>
<h2>Security</h2>
<p>Data is transmitted over HTTPS. Sign-in tokens are stored in your device’s secure storage. No system is perfectly secure, but we work to protect your information.</p>
<h2>Children</h2>
<p>The app is not directed to children under 13 (or under 16 where local law requires), and we do not knowingly collect their data.</p>
<h2>Your rights</h2>
<p>Depending on where you live, you may have the right to access, correct, export or delete your data, or to object to processing. Contact us at <a href="mailto:${esc(EMAIL)}">${esc(EMAIL)}</a>.</p>
<h2>Changes</h2>
<p>We may update this policy and will change the date above when we do.</p>
<h2>Health disclaimer</h2>${disclaimer}
<h2>Contact</h2><p><a href="mailto:${esc(EMAIL)}">${esc(EMAIL)}</a></p>`);

const terms = () => layout('Terms of Use', `
<p>By creating an account or using ${esc(APP)} you agree to these terms.</p>
<h2>Using the app</h2>
<p>You must provide accurate information and keep your password confidential. You are responsible for activity on your account. Do not misuse the service, attempt to break its security, or use it unlawfully.</p>
<h2>Health disclaimer</h2>${disclaimer}
<p>Sugar amounts are estimates based on typical servings or third-party product data and may be inaccurate.</p>
<h2>Points and rewards</h2>
<p>Points have no cash value. Reward availability and fulfilment may change or be discontinued without notice.</p>
<h2>Availability</h2>
<p>The service is provided “as is” without warranties. To the fullest extent permitted by law, ${esc(COMPANY)} is not liable for indirect or consequential losses arising from use of the app.</p>
<h2>Termination</h2>
<p>You can delete your account at any time in the app. We may suspend accounts that violate these terms.</p>
<h2>Contact</h2><p><a href="mailto:${esc(EMAIL)}">${esc(EMAIL)}</a></p>`);

const deleteAccount = () => layout('Delete your account', `
<p>You can permanently delete your ${esc(APP)} account and all associated data:</p>
<ol><li>Open the app and sign in.</li><li>Go to <strong>Settings → Delete account</strong>.</li><li>Enter your password and confirm.</li></ol>
<p>Your account, sugar logs, check-ins, challenge progress, points and reward records are deleted immediately. This cannot be undone.</p>
<p>Can’t access the app? Email <a href="mailto:${esc(EMAIL)}">${esc(EMAIL)}</a> from your registered address and we will delete your data.</p>`);

module.exports = { privacy, terms, deleteAccount };
