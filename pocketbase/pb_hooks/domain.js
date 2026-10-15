/**
 * PerfIA Diagnostic IA : point unique métier côté serveur (module CommonJS, chargé par require()).
 *
 * Ce qui relève du contenu du diagnostic (axes, niveaux, cas, offres) vit dans content/editorial.mjs et arrive ici
 * par referentiel.js (généré). Ce module porte le reste : statuts, durées de conservation, gabarit de l'e-mail de
 * rapport, colonnes de l'export, consignes du serveur MCP. Il n'utilise aucun global PocketBase.
 */

const LEAD_STATUSES = { nouveau: "Nouveau", contacte: "Contacté", qualifie: "Qualifié", converti: "Converti", perdu: "Perdu" };
const SESSION_STATUSES = { brouillon: "Brouillon", ouverte: "Ouverte", fermee: "Fermée" };

const TOKEN_LENGTH = 32;
const TOKEN_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const PRESENTER_KEY_LENGTH = 10;
const PRESENTER_KEY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

// Conservation (voir docs/donnees-personnelles.md) : rapport consultable 12 mois ; sans consentement de recontact,
// identité effacée après 12 mois ; tout diagnostic supprimé 36 mois après la dernière mise à jour.
const REPORT_MONTHS = 12;
const ANONYMIZE_MONTHS = 12;
const DELETE_MONTHS = 36;
const REPORT_MAX_ATTEMPTS = 3;
// Renvois de la feuille de route demandés par le participant (bouton « Renvoyer par e-mail »).
const REPORT_MAX_REQUESTS = 3;
// Version du texte des consentements affiché dans l'interface : à changer quand ce texte change.
const CONSENT_TEXT_VERSION = "2026-10-15";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const labelOf = (list, code) => { const x = (list || []).find((i) => i.code === code); return x ? x.label : code || ""; };

/**
 * E-mail envoyé après un diagnostic : niveaux, cas à tester, lien vers le rapport, puis « Pour aller plus loin »
 * (offres recommandées, rendez-vous de 30 minutes, ressources). Styles en ligne et mise en page en tableau : c'est ce
 * que lisent correctement Outlook, Gmail et les messageries mobiles.
 */
function reportEmail(appName, baseUrl, d, ref) {
  const r = d.result || {};
  const link = `${baseUrl}/rapport.html#${d.token}`;
  const C = { ink: "#1F2D3D", muted: "#5D6C73", green: "#00705F", soft: "#E6F7F4", line: "#DCE1E4", paper: "#FBFDFC" };
  const h2 = (t) => `<h2 style="margin:28px 0 10px;font-size:17px;line-height:1.3;color:${C.ink}">${esc(t)}</h2>`;
  const button = (href, label, primary) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0"><tr><td style="border-radius:8px;background:${primary ? C.green : C.paper};border:2px solid ${C.green}">` +
    `<a href="${esc(href)}" style="display:inline-block;padding:12px 22px;font-weight:bold;font-size:15px;text-decoration:none;color:${primary ? "#FFFFFF" : C.green}">${esc(label)}</a></td></tr></table>`;

  const axes = (r.axes || []).map((a) => `<li style="margin:0 0 6px"><strong>${esc(a.label)}</strong> : ${esc(a.niveau)}, niveau ${a.n}. ${esc(a.titre)}.</li>`).join("");
  const tester = ((r.quadrants || {}).tester || []).slice(0, 3).map((n) => r.cases[n - 1]).filter(Boolean);
  const cases = tester.length ? `${h2("À tester tout de suite")}<ul style="margin:0;padding-left:20px">${tester.map((c) => `<li style="margin:0 0 6px">${esc(c.label)}</li>`).join("")}</ul>` : "";
  const offers = (r.offres || []).map((o) => `<tr><td style="padding:12px 14px;background:${C.soft};border-radius:8px"><strong style="display:block;margin:0 0 4px">${esc(o.titre)}</strong>${esc(o.texte)}</td></tr><tr><td style="height:8px;line-height:8px;font-size:0">&nbsp;</td></tr>`).join("");
  const resources = (r.ressources || []).map((x) => `<li style="margin:0 0 8px"><a href="${esc(x.url)}" style="color:${C.green};font-weight:bold">${esc(x.titre)}</a><br><span style="color:${C.muted}">${esc(x.texte)}</span></li>`).join("");

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"><title>Votre feuille de route IA</title></head><body style="margin:0;padding:0;background:${C.paper}">
<span style="display:none;max-height:0;overflow:hidden">Vos prochaines étapes, vos cas d'usage prioritaires et un échange de 30 minutes si vous le souhaitez.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:${C.ink}">
<tr><td style="padding:0 0 14px;border-bottom:3px solid #00B194;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:${C.green};font-weight:bold">PerfIA · Feuille de route IA</td></tr>
<tr><td style="padding:20px 0 0">
<p style="margin:0 0 12px">Bonjour ${esc(d.firstname)},</p>
<p style="margin:0 0 12px">Merci d'avoir pris quelques minutes pour faire le point. Voici l'essentiel de votre feuille de route.</p>
${h2("Où vous en êtes")}<ul style="margin:0;padding-left:20px">${axes}</ul>
${cases}
${button(link, "Voir ma feuille de route complète", true)}
<p style="margin:0;color:${C.muted};font-size:14px">Le lien reste valable ${REPORT_MONTHS} mois ; depuis la page, vous pouvez l'enregistrer en PDF.</p>
${h2("Pour aller plus loin")}
${offers ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${offers}</table>` : ""}
<p style="margin:12px 0 0">Le plus simple pour démarrer : un échange de 30 minutes sur votre situation et vos cas d'usage.</p>
${button(ref.app.rdv_url, "Réserver 30 minutes", false)}
${resources ? `${h2("Ressources")}<ul style="margin:0;padding-left:20px">${resources}</ul>` : ""}
</td></tr>
<tr><td style="padding:28px 0 0;border-top:1px solid ${C.line};font-size:13px;line-height:1.5;color:${C.muted}">
${esc(ref.app.coedition)}.<br>Vous recevez ce message parce que vous avez demandé votre feuille de route sur ${esc(appName)}. Pour exercer vos droits sur vos données : <a href="mailto:${esc(ref.app.contact)}" style="color:${C.muted}">${esc(ref.app.contact)}</a>.
</td></tr></table></td></tr></table></body></html>`;

  const text = [
    `Bonjour ${d.firstname},`, "",
    "Voici l'essentiel de votre feuille de route IA.", "",
    ...(r.axes || []).map((a) => `- ${a.label} : ${a.niveau}, niveau ${a.n}. ${a.titre}.`),
    ...(tester.length ? ["", "À tester tout de suite :", ...tester.map((c) => `- ${c.label}`)] : []),
    "", `Voir ma feuille de route complète : ${link}`,
    "", "POUR ALLER PLUS LOIN",
    ...(r.offres || []).map((o) => `- ${o.titre} : ${o.texte}`),
    `- Réserver un échange de 30 minutes : ${ref.app.rdv_url}`,
    ...((r.ressources || []).length ? ["", "RESSOURCES", ...r.ressources.map((x) => `- ${x.titre} : ${x.url}`)] : []),
    "", `${ref.app.coedition}.`,
  ].join("\n");
  return { subject: `Votre feuille de route IA, ${d.firstname}`, html, text };
}

/** Colonnes de l'export CSV, dans l'ordre. `get(d, ref)` reçoit un diagnostic déjà décodé. */
const CSV_COLUMNS = [
  ["Date", (d) => String(d.created || "").slice(0, 16)],
  ["Session", (d) => d.session_code || ""],
  ["Prénom", (d) => d.firstname],
  ["Nom", (d) => d.lastname],
  ["Entreprise", (d) => d.company],
  ["Fonction", (d, ref) => labelOf(ref.fonctions, d.role)],
  ["E-mail", (d) => d.email],
  ["Téléphone", (d) => d.phone],
  ["Maillon", (d, ref) => labelOf(ref.maillons, d.maillon)],
  ["Effectif", (d) => d.size],
  ["Niveau IA", (d) => (d.levels || {}).ia || ""],
  ["Niveau Données", (d) => (d.levels || {}).donnees || ""],
  ["Niveau Cadre", (d) => (d.levels || {}).cadre || ""],
  ["Question éclair", (d) => d.pulse || ""],
  ["Cas souhaités (priorité)", (d) => ((d.result || {}).cases || []).map((c) => `${c.label} (${c.priority})`).join(" | ")],
  ["À tester tout de suite", (d) => { const r = d.result || {}; return ((r.quadrants || {}).tester || []).map((n) => r.cases[n - 1].label).join(" | "); }],
  ["Déjà en place", (d) => ((d.result || {}).acquis || []).map((c) => c.label).join(" | ")],
  ["Offres proposées", (d) => ((d.result || {}).offres || []).map((o) => o.titre).join(" | ")],
  ["Tâche libre", (d) => d.free_text],
  ["Recontact accepté", (d) => (d.consent_contact ? "oui" : "non")],
  ["Partage organisateur", (d) => (d.consent_partner ? "oui" : "non")],
  ["Invitations", (d) => (d.consent_news ? "oui" : "non")],
  ["Statut prospect", (d) => LEAD_STATUSES[d.lead_status] || d.lead_status || ""],
  ["Rapport", (d) => d.report_status || ""],
  ["Durée (s)", (d) => d.duration_s || ""],
];

/** Adresse masquée pour l'affichage (« c•••@exemple.fr ») : le rapport ne révèle jamais l'adresse complète. */
const maskEmail = (email) => { const m = String(email || "").match(/^(.)[^@]*(@.+)$/); return m ? `${m[1]}•••${m[2]}` : ""; };

/**
 * Contact Brevo pour la liste des invitations (consentement 4). Les noms d'attributs varient selon les comptes
 * (FIRSTNAME ou PRENOM…) et Brevo refuse un attribut inconnu : on n'envoie que ceux qui existent dans le compte,
 * en prenant pour chaque donnée le premier nom disponible. `existing` : noms d'attributs du compte.
 */
const BREVO_ATTRIBUTES = {
  firstname: ["FIRSTNAME", "PRENOM"],
  lastname: ["LASTNAME", "NOM"],
  company: ["COMPANY", "ENTREPRISE", "SOCIETE"],
  source: ["SOURCE"],
};
function brevoContact(d, listId, existing) {
  const values = { firstname: d.firstname, lastname: d.lastname, company: d.company, source: `diagnostic-ia${d.session_code ? "-" + d.session_code : ""}` };
  const attributes = {};
  Object.keys(BREVO_ATTRIBUTES).forEach((k) => {
    const name = BREVO_ATTRIBUTES[k].find((n) => existing.indexOf(n) >= 0);
    if (name && values[k]) attributes[name] = values[k];
  });
  return { email: d.email, updateEnabled: true, listIds: [listId], attributes };
}

function mcpInstructions(appName, userName) {
  return `Tu es connecté au serveur MCP de ${appName}, le diagnostic de maturité IA PerfIA (filière forêt-bois, Kosmio × Xylofutur), au nom de ${userName}, membre de l'équipe.

Ce que contient l'outil :
- des sessions (une par intervention : atelier, visio, salon), repérées par un code court ;
- des diagnostics : identité du participant, maillon, niveaux de maturité sur 3 axes (IA, Données, Cadre, de 1 à 5),
  cas d'usage choisis avec leur priorité, offres proposées, consentements, statut de suivi du prospect.

Bonnes pratiques :
1. Commence par list_sessions, puis session_stats pour une vue d'ensemble anonyme.
2. list_diagnostics donne les prospects ; ne propose de recontacter que ceux qui ont accepté (consent_contact).
3. Ne transmets jamais de données nominatives à un organisateur sans le consentement de partage (consent_partner).
4. set_lead_status met à jour le suivi ; n'envoie aucun message toi-même, prépare des brouillons.
5. N'avance jamais de gain chiffré qui n'a pas été mesuré chez le prospect.`;
}

module.exports = {
  LEAD_STATUSES, SESSION_STATUSES, TOKEN_LENGTH, TOKEN_ALPHABET, PRESENTER_KEY_LENGTH, PRESENTER_KEY_ALPHABET,
  REPORT_MONTHS, ANONYMIZE_MONTHS, DELETE_MONTHS, REPORT_MAX_ATTEMPTS, REPORT_MAX_REQUESTS, CONSENT_TEXT_VERSION,
  esc, labelOf, reportEmail, CSV_COLUMNS, mcpInstructions, maskEmail, brevoContact,
};
