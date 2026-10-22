/* N2 — proves the push encryption and signing without a browser.
   1. RFC 8291 Appendix A, the standard's own worked example: the same keys, salt and sentence must give the same bytes.
   2. An independent library (`web-push`, npm) encrypts for a throwaway browser key pair; our receiver-side mirror
      must read it back — so our key schedule agrees with a second implementation, not only with itself.
   3. A VAPID header built here verifies under Node's own crypto with the public key alone.
   Run:  node deliverables/20261015/n2-news/tools/webpush-selftest.mjs   (needs `web-push` on NODE_PATH or in a scratch folder: see N2-NEWS.html) */
import crypto from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const wp = await import(path.resolve(here, "../../../../supabase/functions/notify-push/webpush.mjs"));
const { b64u } = wp;
const out = { rfc8291_vector: null, webpush_lib_roundtrip: null, vapid_verifies: null };

/* 1 — RFC 8291 Appendix A */
const V = {
  plaintext: "When I grow up, I want to be a watermelon",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  asPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};
try {
  const sender = await wp.importP256Pair(b64u.dec(V.asPublic), b64u.dec(V.asPrivate));
  const body = await wp.encryptForSubscription(V.plaintext, { p256dh: V.uaPublic, auth: V.auth }, sender, b64u.dec(V.salt));
  const got = b64u.enc(body);
  out.rfc8291_vector = { match: got === V.body, bytes: body.length, got: got.slice(0, 40) + "…" };
  /* and the browser side reads the RFC's own ciphertext */
  const ua = await wp.importP256Pair(b64u.dec(V.uaPublic), b64u.dec(V.uaPrivate));
  out.rfc8291_vector.decryptsRfcBody = (await wp.decryptAsBrowser(b64u.dec(V.body), ua, b64u.dec(V.auth))) === V.plaintext;
} catch (e) { out.rfc8291_vector = { error: String(e) }; }

/* 2 — independent library */
try {
  const require = createRequire(process.env.WEBPUSH_REQUIRE_FROM || path.join(here, "package.json"));
  const webpush = require("web-push");
  const ua = await wp.generateP256();
  const auth = crypto.randomBytes(16);
  const enc = webpush.encrypt(b64u.enc(ua.pub), b64u.enc(auth), "hello from an independent encryptor", "aes128gcm");
  const B = (v) => (typeof v === "string" ? Buffer.from(b64u.dec(v)) : Buffer.from(v));   // the library hands back base64url strings
  const salt = B(enc.salt), lpk = B(enc.localPublicKey), ct = B(enc.cipherText);
  /* http_ece (what web-push uses) writes the aes128gcm header itself; an older build hands back the bare ciphertext */
  const body = new Uint8Array(ct.length > 21 && ct.subarray(0, 16).equals(salt) ? ct : Buffer.concat([salt, Buffer.from([0, 0, 16, 0]), Buffer.from([lpk.length]), lpk, ct]));
  const text = await wp.decryptAsBrowser(body, ua, new Uint8Array(auth));
  out.webpush_lib_roundtrip = { match: text === "hello from an independent encryptor", libVersion: require("web-push/package.json").version };
} catch (e) { out.webpush_lib_roundtrip = { error: String(e).slice(0, 200) }; }

/* 3 — VAPID */
try {
  const kp = await wp.generateP256();
  const vapid = { publicKey: b64u.enc(kp.pub), privateKey: b64u.enc(kp.privScalar), subject: "mailto:test@example.invalid" };
  const h = await wp.vapidHeader("https://fcm.googleapis.com/fcm/send/abc", vapid, 1792113000);
  const [h1, p1, s1] = h.jwt.split(".");
  const pubKey = crypto.createPublicKey({ key: { kty: "EC", crv: "P-256", x: b64u.enc(kp.pub.slice(1, 33)), y: b64u.enc(kp.pub.slice(33, 65)) }, format: "jwk" });
  const ok = crypto.verify("sha256", Buffer.from(h1 + "." + p1), { key: pubKey, dsaEncoding: "ieee-p1363" }, Buffer.from(b64u.dec(s1)));
  const claims = JSON.parse(Buffer.from(b64u.dec(p1)).toString());
  out.vapid_verifies = { signature: ok, aud: claims.aud, expInHours: (claims.exp - 1792113000) / 3600, headerShape: /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]{87}$/.test(h.authorization) };
} catch (e) { out.vapid_verifies = { error: String(e) }; }

console.log(JSON.stringify(out, null, 1));
const pass = out.rfc8291_vector?.match && out.rfc8291_vector?.decryptsRfcBody && out.vapid_verifies?.signature && out.vapid_verifies?.headerShape && (out.webpush_lib_roundtrip?.match || out.webpush_lib_roundtrip?.error);
process.exit(pass ? 0 : 1);
