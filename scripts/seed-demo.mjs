#!/usr/bin/env node
/**
 * PerfIA Diagnostic IA : prépare une instance pour une démonstration ou une intervention.
 *
 * - crée (ou garde) un compte d'équipe si STAFF_EMAIL et STAFF_PASSWORD sont définis ;
 * - crée (ou garde) une session ouverte de code SESSION_CODE (défaut « demo »), maillon bureau d'études,
 *   avec la mesure de référence de l'atelier IBC du 25/09 ;
 * - affiche le lien participants et le lien de la vue salle.
 *
 * Variables : PB_URL (défaut http://127.0.0.1:$PB_PORT), PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD (superutilisateur),
 * STAFF_EMAIL, STAFF_PASSWORD, SESSION_CODE, SESSION_TITLE. En local, `make demo` charge .local/env.sh.
 */
const BASE = (process.env.PB_URL || `http://127.0.0.1:${process.env.PB_PORT || 8090}`).replace(/\/+$/, "");
const code = (process.env.SESSION_CODE || "demo").toLowerCase();

async function api(method, path, token, body) {
  const res = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} : ${res.status} ${JSON.stringify(data)}`);
  return data;
}

const su = await api("POST", "/api/collections/_superusers/auth-with-password", null, { identity: process.env.PB_ADMIN_EMAIL, password: process.env.PB_ADMIN_PASSWORD });
const admin = su.token;

if (process.env.STAFF_EMAIL && process.env.STAFF_PASSWORD) {
  const found = await api("GET", `/api/collections/users/records?filter=${encodeURIComponent(`email = "${process.env.STAFF_EMAIL}"`)}`, admin);
  if (!found.items.length) {
    await api("POST", "/api/collections/users/records", admin, { email: process.env.STAFF_EMAIL, password: process.env.STAFF_PASSWORD, passwordConfirm: process.env.STAFF_PASSWORD, name: "Équipe PerfIA", verified: true });
    console.log(`Compte d'équipe créé : ${process.env.STAFF_EMAIL}`);
  } else console.log(`Compte d'équipe existant : ${process.env.STAFF_EMAIL}`);
}

let s = (await api("GET", `/api/collections/sessions/records?filter=${encodeURIComponent(`code = "${code}"`)}`, admin)).items[0];
if (!s) {
  s = await api("POST", "/api/collections/sessions/records", admin, {
    code, title: process.env.SESSION_TITLE || "Démonstration : bureaux d'études bois", status: "ouverte", flow: "complet", identity_position: "debut",
    default_maillon: "bureau_etudes", organizer_name: "", baseline: { label: "Atelier IBC 25/09", usage_ia: 2.1, clarte: 2.3 },
  });
  console.log(`Session créée : ${code}`);
} else console.log(`Session existante : ${code}`);

console.log(`\nParticipants : ${BASE}/s/${code}`);
console.log(`Vue salle    : ${BASE}/salle.html#${code}:${s.presenter_key}`);
console.log(`Équipe       : ${BASE}/equipe.html`);
