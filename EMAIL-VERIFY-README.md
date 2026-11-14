# Sign-up e-mail verification code (Brevo + Cloudflare Worker) — 10 minutes, free

The customer gets a 6-digit code by e-mail, types it in, and only then the account is created.

## 1. Brevo (sends the e-mail) — free: 300 e-mails / day
1. Sign up at https://www.brevo.com (free).
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: use your own e-mail (e.g. your Gmail), name "SakinduStore".
   Brevo e-mails you a link/code — open it to **verify the sender**. (No domain needed.)
3. **SMTP & API → API Keys → Generate a new API key** → copy it (starts with `xkeysib-`).

## 2. Cloudflare Worker
1. https://dash.cloudflare.com → **Workers & Pages → Create → Create Worker** → name it `sakindu-email` → Deploy.
2. **Edit code** → delete everything → paste `email-verify-worker.js` → **Deploy**.
3. Worker → **Settings → Variables and Secrets → Add**:
   | Name | Type | Value |
   |---|---|---|
   | `BREVO_API_KEY` | Secret | the xkeysib-... key |
   | `SECRET` | Secret | any long random text (40+ characters). Never share it. |
   | `SENDER_EMAIL` | Text | the sender e-mail you verified in Brevo |
   | `SENDER_NAME` | Text | SakinduStore |
4. Copy the Worker URL, e.g. `https://sakindu-email.yourname.workers.dev`.
5. (After testing) in the Worker code set `ALLOWED_ORIGINS = ['https://your-site.com']`.

## 3. Connect the store
Open `app.js`, find `const EMAIL_VERIFY_URL = '';` (near the top) and paste the Worker URL between the quotes. Upload the site. Done.
Leave it `''` to switch verification off.

## Test
Sign Up with a real e-mail → "Verify your email" screen → code arrives (check Spam the first time) → enter it → account created.
If the mail does not arrive: add a Worker variable `DEBUG` = `1`; a failed send then shows Brevo's reason in the Network tab.

## Good to know
- Nothing is stored: the Worker signs (e-mail + code + expiry) with `SECRET`. Codes last 10 min, 5 wrong tries per code,
  one new code per e-mail every 45 s, 10 sends per IP per hour (best-effort limits kept in the Worker's memory).
- The store saves accounts straight into Firestore from the browser, so this check keeps fake/mistyped e-mails out for
  normal users, but a technical person could still skip it by writing to Firestore directly. A hard guarantee needs account
  creation moved into a Worker too (plus Firestore security rules).
- Google sign-ups skip this step (Google already verified the e-mail).
