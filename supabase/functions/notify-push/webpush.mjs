/* N2 (15 Oct 2026) — Web Push, the standard way, with nothing but WebCrypto.
   RFC 8291 (message encryption, aes128gcm) + RFC 8292 (VAPID). One file, no dependency, runs the same under Deno
   (the edge function) and under Node 22+ (the self-test in deliverables/20261015/n2-news/tools/webpush-selftest.mjs,
   which reproduces RFC 8291's own worked example byte for byte and round-trips against the `web-push` package).
   Keys never touch this file: the function reads them from its environment; the test makes throwaway ones. */
const te = new TextEncoder();
export const b64u = {
  enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: (s) => { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); },
};
const cat = (...parts) => { const n = parts.reduce((t, p) => t + p.length, 0), out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const subtle = globalThis.crypto.subtle;

async function hkdf(salt, ikm, info, len) {
  const k = await subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}
/* a P-256 key pair as WebCrypto objects, from raw bytes (or fresh) */
export async function importP256Pair(rawPublic, rawPrivateScalar) {
  const x = b64u.enc(rawPublic.slice(1, 33)), y = b64u.enc(rawPublic.slice(33, 65));
  const jwk = { kty: "EC", crv: "P-256", x, y, d: b64u.enc(rawPrivateScalar), ext: true };
  const priv = await subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  return { priv, pub: rawPublic };
}
export async function generateP256() {
  const kp = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pub = new Uint8Array(await subtle.exportKey("raw", kp.publicKey));
  const jwk = await subtle.exportKey("jwk", kp.privateKey);
  return { priv: kp.privateKey, pub, privScalar: b64u.dec(jwk.d) };
}

/* RFC 8291 §3: encrypt `plaintext` for one subscription (its p256dh + auth), with the sender's ephemeral pair and salt.
   Returns the whole aes128gcm body: salt(16) | rs(4) | idlen(1) | sender public key(65) | ciphertext(+tag). */
export async function encryptForSubscription(plaintext, { p256dh, auth }, sender, salt, rs = 4096) {
  const uaPub = b64u.dec(p256dh), authSecret = b64u.dec(auth);
  const uaKey = await subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: uaKey }, sender.priv, 256));
  const keyInfo = cat(te.encode("WebPush: info\0"), uaPub, sender.pub);
  const ikm = await hkdf(authSecret, ecdh, keyInfo, 32);
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const padded = cat(te.encode(plaintext), new Uint8Array([2]));         // one record; 0x02 = last record delimiter
  if (padded.length > rs - 16) throw new Error("payload too long for one record");
  const aes = await subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aes, padded));
  const header = cat(salt, new Uint8Array([(rs >>> 24) & 255, (rs >>> 16) & 255, (rs >>> 8) & 255, rs & 255]), new Uint8Array([sender.pub.length]), sender.pub);
  return cat(header, ct);
}
/* the receiver's side (what the browser does), used only by the self-test to round-trip an independent library's output */
export async function decryptAsBrowser(body, ua /* {priv, pub} */, authSecret) {
  const salt = body.slice(0, 16), idlen = body[20], asPub = body.slice(21, 21 + idlen), ct = body.slice(21 + idlen);
  const asKey = await subtle.importKey("raw", asPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: asKey }, ua.priv, 256));
  const ikm = await hkdf(authSecret, ecdh, cat(te.encode("WebPush: info\0"), ua.pub, asPub), 32);
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const aes = await subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const padded = new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aes, ct));
  let end = padded.length - 1; while (end >= 0 && padded[end] === 0) end--;    // strip padding zeros, then the delimiter
  if (padded[end] !== 2 && padded[end] !== 1) throw new Error("bad delimiter");
  return new TextDecoder().decode(padded.slice(0, end));
}

/* RFC 8292: the VAPID Authorization header for one push-service origin. `vapid` = { publicKey (raw base64url, 65 bytes),
   privateKey (raw scalar base64url, 32 bytes), subject ("mailto:…" or an https URL) }. Valid for 12 h. */
export async function vapidHeader(endpoint, vapid, nowSec = Math.floor(Date.now() / 1000)) {
  const aud = new URL(endpoint).origin;
  const claims = { aud, exp: nowSec + 12 * 3600, sub: vapid.subject };
  const seg = (o) => b64u.enc(te.encode(JSON.stringify(o)));
  const signingInput = seg({ typ: "JWT", alg: "ES256" }) + "." + seg(claims);
  const pub = b64u.dec(vapid.publicKey), d = b64u.dec(vapid.privateKey);
  const jwk = { kty: "EC", crv: "P-256", x: b64u.enc(pub.slice(1, 33)), y: b64u.enc(pub.slice(33, 65)), d: b64u.enc(d), ext: true };
  const key = await subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(signingInput)));   // WebCrypto gives r|s (64 bytes), which is what JWS wants
  const jwt = signingInput + "." + b64u.enc(sig);
  return { authorization: "vapid t=" + jwt + ", k=" + vapid.publicKey, jwt, claims };
}

/* one push: encrypt, sign, POST. Returns { status, text }. ttl in seconds; urgency per RFC 8030 §5.3. */
export async function sendPush(sub, payload, vapid, { ttl = 3600, urgency = "normal", topic = null, fetchImpl = globalThis.fetch } = {}) {
  const sender = await generateP256();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const body = await encryptForSubscription(payload, sub, sender, salt);
  const { authorization } = await vapidHeader(sub.endpoint, vapid);
  const headers = { "content-type": "application/octet-stream", "content-encoding": "aes128gcm", "content-length": String(body.length),
    ttl: String(ttl), urgency, authorization };
  if (topic) headers.topic = topic;
  const r = await fetchImpl(sub.endpoint, { method: "POST", headers, body });
  return { status: r.status, text: (await r.text().catch(() => "")).slice(0, 200) };
}
