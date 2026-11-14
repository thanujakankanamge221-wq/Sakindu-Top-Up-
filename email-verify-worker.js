/* Cloudflare Worker — e-mails a 6-digit sign-up verification code (via Brevo) and checks it.
   Stateless: nothing is stored. The code is tied to the e-mail + expiry with an HMAC signature only this Worker can make.
   Setup: see EMAIL-VERIFY-README.md.

   Worker -> Settings -> Variables and Secrets:
     BREVO_API_KEY  (Secret)   your Brevo API key (starts with xkeysib-)
     SECRET         (Secret)   any long random text (e.g. 40 random characters) — never share it
     SENDER_EMAIL   (Text)     the sender address you verified in Brevo, e.g. yourname@gmail.com
     SENDER_NAME    (Text)     optional, e.g. SakinduStore                                                    */

const ALLOWED_ORIGINS = ['*'];            // after testing put your real site here, e.g. ['https://sakindustore.com']
const CODE_TTL_MS = 10 * 60 * 1000;       // code is valid for 10 minutes
const RESEND_GAP_MS = 45 * 1000;          // same e-mail can ask for a new code only every 45 s
const MAX_PER_IP_HOUR = 10;               // send-code requests per IP per hour
const MAX_TRIES = 5;                      // wrong guesses allowed per code

/* best-effort memory of this Worker instance (spam brake; resets when the instance restarts) */
const lastSent = new Map(), ipHits = new Map(), tries = new Map();

const enc = new TextEncoder();
function cors(req){
  const o = req.headers.get('Origin') || '';
  const ok = ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(o);
  return { 'Access-Control-Allow-Origin': ok ? (ALLOWED_ORIGINS.includes('*') ? '*' : o) : 'null',
           'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' };
}
const json = (req, body, status = 200) => new Response(JSON.stringify(body), { status, headers: Object.assign({ 'Content-Type': 'application/json' }, cors(req)) });

async function hmacHex(secret, text){
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a, b){ if(a.length !== b.length) return false; let r = 0; for(let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
function randomCode(){ const n = new Uint32Array(1); crypto.getRandomValues(n); return String(n[0] % 1000000).padStart(6, '0'); }
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 120;

function mailHtml(code){
  return `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:14px">
  <h2 style="margin:0 0 6px">Sakindu<span style="color:#7c5cff">Store</span></h2>
  <p style="color:#444">ඔබේ Sign Up verification code එක / Your verification code:</p>
  <div style="font-size:34px;letter-spacing:8px;font-weight:800;text-align:center;background:#f3f4f8;border-radius:12px;padding:16px;margin:14px 0">${code}</div>
  <p style="color:#666;font-size:13px">මේ code එක විනාඩි 10ක් වලංගුයි. ඔබ මේක ඉල්ලුවේ නැත්නම් ignore කරන්න. This code expires in 10 minutes.</p></div>`;
}

export default {
  async fetch(req, env){
    if(req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
    if(req.method !== 'POST') return json(req, { ok: false, error: 'method' }, 405);
    if(!env.SECRET || !env.BREVO_API_KEY || !env.SENDER_EMAIL) return json(req, { ok: false, error: 'not_configured' }, 500);
    const path = new URL(req.url).pathname;
    let body; try{ body = await req.json(); }catch(e){ return json(req, { ok: false, error: 'bad_json' }, 400); }
    const email = String(body.email || '').trim().toLowerCase();
    if(!validEmail(email)) return json(req, { ok: false, error: 'bad_email' }, 400);
    const now = Date.now();

    if(path.endsWith('/send-code')){
      const ip = req.headers.get('CF-Connecting-IP') || 'x';
      const hits = (ipHits.get(ip) || []).filter(t => now - t < 3600e3);
      if(hits.length >= MAX_PER_IP_HOUR) return json(req, { ok: false, error: 'rate_limited' }, 429);
      if(now - (lastSent.get(email) || 0) < RESEND_GAP_MS) return json(req, { ok: false, error: 'wait', retryIn: Math.ceil((RESEND_GAP_MS - (now - lastSent.get(email))) / 1000) }, 429);
      const code = randomCode(), exp = now + CODE_TTL_MS;
      const sig = await hmacHex(env.SECRET, `${email}|${code}|${exp}`);
      const r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify({ sender: { name: env.SENDER_NAME || 'SakinduStore', email: env.SENDER_EMAIL }, to: [{ email }],
          subject: `SakinduStore verification code: ${code}`, htmlContent: mailHtml(code) })
      });
      if(!r.ok){ const d = await r.text().catch(() => ''); return json(req, { ok: false, error: 'mail_failed', detail: env.DEBUG ? d.slice(0, 300) : undefined }, 502); }
      lastSent.set(email, now); hits.push(now); ipHits.set(ip, hits);
      return json(req, { ok: true, exp, sig });                         // the code itself is NEVER returned
    }

    if(path.endsWith('/verify-code')){
      const code = String(body.code || '').replace(/\D/g, ''), exp = Number(body.exp), sig = String(body.sig || '');
      if(code.length !== 6 || !exp || !sig) return json(req, { ok: false, error: 'bad_request' }, 400);
      if(now > exp) return json(req, { ok: false, error: 'expired' });
      const n = (tries.get(sig) || 0) + 1; tries.set(sig, n);
      if(n > MAX_TRIES) return json(req, { ok: false, error: 'too_many' }, 429);
      const good = await hmacHex(env.SECRET, `${email}|${code}|${exp}`);
      return json(req, safeEqual(good, sig) ? { ok: true } : { ok: false, error: 'wrong_code' });
    }
    return json(req, { ok: false, error: 'not_found' }, 404);
  }
};
