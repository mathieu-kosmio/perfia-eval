/**
 * PerfIA Diagnostic IA : point unique métier côté serveur (module CommonJS, chargé par require()).
 *
 * Ce qui relève du contenu du diagnostic (axes, niveaux, cas, offres) vit dans content/editorial.mjs et arrive ici
 * par referentiel.js (généré). Ce module porte le reste : statuts, durées de conservation, gabarits des e-mails
 * (rapport, relance après session), colonnes de l'export, consignes du serveur MCP. Il n'utilise aucun global
 * PocketBase.
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
// Relance après une session : par défaut le lendemain, à la même heure ; 3 essais d'envoi par participant.
const FOLLOWUP_DELAY_HOURS = 24;
const FOLLOWUP_MAX_ATTEMPTS = 3;
// Version du texte des consentements affiché dans l'interface : à changer quand ce texte change.
const CONSENT_TEXT_VERSION = "2026-10-15";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const labelOf = (list, code) => { const x = (list || []).find((i) => i.code === code); return x ? x.label : code || ""; };

/* ---------- E-mails ---------- */
// Styles en ligne et mise en page en tableau : c'est ce que lisent correctement Outlook, Gmail et les messageries mobiles.
const C = { ink: "#1F2D3D", muted: "#5D6C73", green: "#00705F", soft: "#E6F7F4", line: "#DCE1E4", paper: "#FBFDFC" };
const h2 = (t) => `<h2 style="margin:28px 0 10px;font-size:17px;line-height:1.3;color:${C.ink}">${esc(t)}</h2>`;
const p = (html, style) => `<p style="margin:0 0 12px${style ? ";" + style : ""}">${html}</p>`;
const ul = (items, ordered) => items.length ? `<${ordered ? "ol" : "ul"} style="margin:0;padding-left:20px">${items.map((i) => `<li style="margin:0 0 6px">${i}</li>`).join("")}</${ordered ? "ol" : "ul"}>` : "";
const button = (href, label, primary) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0"><tr><td style="border-radius:8px;background:${primary ? C.green : C.paper};border:2px solid ${C.green}">` +
  `<a href="${esc(href)}" style="display:inline-block;padding:12px 22px;font-weight:bold;font-size:15px;text-decoration:none;color:${primary ? "#FFFFFF" : C.green}">${esc(label)}</a></td></tr></table>`;
const offerCards = (offres) => (offres || []).length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${offres.map((o) => `<tr><td style="padding:12px 14px;background:${C.soft};border-radius:8px"><strong style="display:block;margin:0 0 4px">${esc(o.titre)}</strong>${esc(o.texte)}</td></tr><tr><td style="height:8px;line-height:8px;font-size:0">&nbsp;</td></tr>`).join("")}</table>` : "";
const resourceList = (list) => (list || []).length ? `<ul style="margin:0;padding-left:20px">${list.map((x) => `<li style="margin:0 0 8px"><a href="${esc(x.url)}" style="color:${C.green};font-weight:bold">${esc(x.titre)}</a><br><span style="color:${C.muted}">${esc(x.texte)}</span></li>`).join("")}</ul>` : "";

/** Enveloppe commune : bandeau, corps, pied de page. `body` et `footer` sont du HTML déjà échappé. */
function emailShell(title, preheader, band, body, footer) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(title)}</title></head><body style="margin:0;padding:0;background:${C.paper}">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:${C.ink}">
<tr><td style="padding:0 0 14px;border-bottom:3px solid #00B194;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:${C.green};font-weight:bold">${esc(band)}</td></tr>
<tr><td style="padding:20px 0 0">
${body}
</td></tr>
<tr><td style="padding:28px 0 0;border-top:1px solid ${C.line};font-size:13px;line-height:1.5;color:${C.muted}">
${footer}
</td></tr></table></td></tr></table></body></html>`;
}

/**
 * E-mail envoyé après un diagnostic : niveaux, cas à tester, lien vers le rapport, puis « Pour aller plus loin »
 * (offres recommandées, rendez-vous de 30 minutes, ressources).
 */
function reportEmail(appName, baseUrl, d, ref) {
  const r = d.result || {};
  const link = `${baseUrl}/rapport.html#${d.token}`;
  const axes = (r.axes || []).map((a) => `<strong>${esc(a.label)}</strong> : ${esc(a.niveau)}, niveau ${a.n}. ${esc(a.titre)}.`);
  const tester = ((r.quadrants || {}).tester || []).slice(0, 3).map((n) => r.cases[n - 1]).filter(Boolean);

  const body = `${p(`Bonjour ${esc(d.firstname)},`)}
${p("Merci d'avoir pris quelques minutes pour faire le point. Voici l'essentiel de votre feuille de route.")}
${h2("Où vous en êtes")}${ul(axes)}
${tester.length ? `${h2("À tester tout de suite")}${ul(tester.map((c) => esc(c.label)))}` : ""}
${button(link, "Voir ma feuille de route complète", true)}
${p(`Le lien reste valable ${REPORT_MONTHS} mois ; depuis la page, vous pouvez l'enregistrer en PDF.`, `margin:0;color:${C.muted};font-size:14px`)}
${h2("Pour aller plus loin")}
${offerCards(r.offres)}
${p("Le plus simple pour démarrer : un échange de 30 minutes sur votre situation et vos cas d'usage.", "margin:12px 0 0")}
${button(ref.app.rdv_url, "Réserver 30 minutes", false)}
${(r.ressources || []).length ? `${h2("Ressources")}${resourceList(r.ressources)}` : ""}`;
  const footer = `${esc(ref.app.coedition)}.<br>Vous recevez ce message parce que vous avez demandé votre feuille de route sur ${esc(appName)}. Pour exercer vos droits sur vos données : <a href="mailto:${esc(ref.app.contact)}" style="color:${C.muted}">${esc(ref.app.contact)}</a>.`;
  const html = emailShell("Votre feuille de route IA", "Vos prochaines étapes, vos cas d'usage prioritaires et un échange de 30 minutes si vous le souhaitez.", "PerfIA · Feuille de route IA", body, footer);

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

/* ---------- Relance après une session ---------- */

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** « 16 octobre » à partir d'une date PocketBase (les sessions ont lieu en journée : le jour UTC suffit). */
function dayFr(v) {
  const t = Date.parse(String(v || "").replace(" ", "T"));
  if (isNaN(t)) return "";
  const d = new Date(t);
  return `${d.getUTCDate() === 1 ? "1er" : d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
const num = (v) => String(v).replace(".", ",");
/** Pourcentages entiers qui totalisent 100 (méthode du plus fort reste). */
function percents(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return counts.map(() => 0);
  const raw = counts.map((c) => (c * 100) / total);
  const out = raw.map(Math.floor);
  let rest = 100 - out.reduce((a, b) => a + b, 0);
  raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).forEach((x) => { if (rest > 0) { out[x[1]]++; rest--; } });
  return out;
}
const TYPE_PHRASES = { ia: "de l'IA", automatisation: "de l'automatisation", donnees: "des données" };

/**
 * Relance envoyée le lendemain d'une session aux participants qui ont accepté d'être recontactés : remerciement,
 * rappel de la feuille de route et des cas à tester, résultats anonymes de la salle (à partir du seuil d'agrégats),
 * puis « Et pour la suite ? » (réponse directe, rendez-vous de 30 minutes, offre, diagnostic à transmettre).
 * `s` : session (title, date, flow, followup_message, baseline) ; `d` : diagnostic décodé ; `st` : agrégats de la
 * session (scoring.aggregate). Les réponses au message partent vers `ref.app.contact` (en-tête Reply-To).
 */
function followupEmail(appName, baseUrl, s, d, st, ref) {
  const r = d.result || {}, app = ref.app, sign = app.signature || {};
  const link = `${baseUrl}/rapport.html#${d.token}`, home = `${baseUrl}/`;
  const quand = dayFr(s.date);
  const custom = String(s.followup_message || "").split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const tester = ((r.quadrants || {}).tester || []).slice(0, 3).map((n) => (r.cases || [])[n - 1]).filter(Boolean);
  const niv = (n) => (ref.niveaux.find((x) => x.n === n) || {}).nom || n;

  // Résultats de la salle, en phrases simples : rien sous le seuil d'agrégats.
  const facts = [], maturity = [], top = [];
  if (st && st.ready) {
    const ch = st.choix || { total: 0, par_type: [], familles: [] };
    facts.push(`${st.n} participants ont fait le diagnostic.`);
    if (ch.total) {
      facts.push(`${ch.total} cas d'usage retenus, soit ${num(ch.moyenne)} en moyenne par participant.`);
      // « 54 % relèvent de l'IA, 31 % de l'automatisation et 15 % des données. »
      const types = ch.par_type.filter((t) => t.count > 0), pc = percents(types.map((t) => t.count));
      const parts = types.map((t, i) => `${pc[i]} % ${TYPE_PHRASES[t.code] || `de « ${t.label} »`}`);
      if (parts.length > 1) {
        parts[0] = parts[0].replace(" % ", " % relèvent ");
        facts.push(`${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}.`);
      } else if (parts.length === 1) facts.push(`Tous relèvent ${TYPE_PHRASES[types[0].code] || `de « ${types[0].label} »`}.`);
      if (ch.familles.length) facts.push(`Les besoins les plus cités : ${ch.familles.map((f) => `${f.label} (${f.count} choix)`).join(", ")}.`);
    }
    const ia = st.axes && st.axes.ia;
    if (ia) {
      const low = ia.dist[0] + ia.dist[1], mid = ia.dist[2], high = ia.dist[3] + ia.dist[4];
      maturity.push(`${ia.label} : ${low} sur ${st.n} au niveau ${niv(1)} ou ${niv(2)}, ${mid} au niveau ${niv(3)}, ${high} au-delà (${niv(4)} ou ${niv(5)}).`);
    }
    const means = ref.axes.filter((a) => st.axes && st.axes[a.code] && st.axes[a.code].mean != null).map((a) => `${a.court} ${num(st.axes[a.code].mean)}`);
    // Points-virgules : la virgule décimale (2,3) se confondrait avec une virgule de liste.
    if (means.length) maturity.push(`Moyennes de la salle, sur 5 : ${means.join(" ; ")}.`);
    const mine = ref.axes.filter((a) => d.levels && d.levels[a.code]).map((a) => `${a.court} ${d.levels[a.code]}`);
    if (mine.length) maturity.push(`Vos niveaux : ${mine.join(" ; ")}.`);
    const b = s.baseline;
    if (b && typeof b === "object" && b.usage_ia) maturity.push(`Mesure de référence${b.label ? ` (${b.label})` : ""} : usage de l'IA à ${num(b.usage_ia)} sur 5.`);
    (st.top || []).slice(0, 5).forEach((t) => top.push(`${t.label} : ${t.count} participant${t.count > 1 ? "s" : ""}`));
  }

  const offres = (r.offres || []).slice(0, 2);
  const suiteDiag = s.flow === "court"
    ? `Vous avez fait la version courte. La version complète (${app.duree.complet}) passe en revue davantage de cas d'usage ; vous pouvez aussi la transmettre à un collègue.`
    : "Un collègue à embarquer ? Le diagnostic reste ouvert, transmettez-lui le lien.";
  const closing = "Merci encore pour votre temps et vos réponses. Au plaisir de vous retrouver, sur un projet ou lors d'une prochaine rencontre de la filière.";
  const subject = `${s.title} : merci, et maintenant ?`;
  const preheader = facts.length ? "Les résultats de la salle, vos prochaines étapes et un échange de 30 minutes si vous le souhaitez." : "Vos prochaines étapes et un échange de 30 minutes si vous le souhaitez.";

  const body = `${p(`Bonjour ${esc(d.firstname)},`)}
${p(`Merci d'avoir fait le diagnostic IA PerfIA lors de « ${esc(s.title)} »${quand ? `, le ${esc(quand)}` : ""}.`)}
${custom.map((x) => p(esc(x).replace(/\n/g, "<br>"))).join("\n")}
${p("Votre feuille de route reste disponible. Le bon point de départ : vos cas à tester tout de suite, à priorité forte et effort faible. Un premier résultat obtenu en quelques jours convainc mieux une équipe qu'un grand projet.")}
${tester.length ? `${p("<strong>Vos cas à tester tout de suite</strong>", "margin:0 0 6px")}${ul(tester.map((c) => esc(c.label)))}` : ""}
${button(link, "Revoir ma feuille de route", true)}
${facts.length ? `${h2("La session en quelques chiffres")}${ul(facts.map(esc))}` : ""}
${maturity.length ? `${h2("Les niveaux de maturité déclarés")}${ul(maturity.map(esc))}` : ""}
${top.length ? `${h2(`Les ${top.length} cas d'usage les plus choisis`)}${ul(top.map(esc), true)}` : ""}
${h2("Et pour la suite ?")}
${p("<strong>Une question sur vos résultats ou sur un cas d'usage ?</strong> Répondez simplement à ce message, ou prenez 30 minutes dans l'agenda.")}
${button(app.rdv_url, "Réserver 30 minutes", false)}
${offres.length ? `${p("<strong>Besoin d'être accompagné ?</strong> Ce que propose PerfIA pour votre situation :")}${offerCards(offres)}` : ""}
${p(`<strong>Le diagnostic, pour aller plus loin.</strong> ${esc(suiteDiag)} <a href="${esc(home)}" style="color:${C.green};font-weight:bold">${esc(home.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a>`)}
${(r.ressources || []).length ? `${p("<strong>Pour se former</strong>", "margin:0 0 6px")}${resourceList(r.ressources)}` : ""}
${p(esc(closing), "margin:24px 0 12px")}
${p(`${esc(sign.nom || "")}${sign.role ? `<br><span style="color:${C.muted}">${esc(sign.role)}</span>` : ""}`)}`;
  const footer = `${esc(app.coedition)}.<br>Vous recevez ce message parce que vous avez accepté, lors de votre diagnostic sur ${esc(appName)}, d'être recontacté au sujet de l'accompagnement PerfIA. Pour ne plus rien recevoir ou exercer vos droits sur vos données, répondez à ce message ou écrivez à <a href="mailto:${esc(app.contact)}" style="color:${C.muted}">${esc(app.contact)}</a>.`;
  const html = emailShell(subject, preheader, "PerfIA · Après la session", body, footer);

  const text = [
    `Bonjour ${d.firstname},`, "",
    `Merci d'avoir fait le diagnostic IA PerfIA lors de « ${s.title} »${quand ? `, le ${quand}` : ""}.`,
    ...custom.flatMap((x) => ["", x]),
    "", "Votre feuille de route reste disponible. Le bon point de départ : vos cas à tester tout de suite, à priorité forte et effort faible.",
    ...(tester.length ? ["", "Vos cas à tester tout de suite :", ...tester.map((c) => `- ${c.label}`)] : []),
    "", `Revoir ma feuille de route : ${link}`,
    ...(facts.length ? ["", "LA SESSION EN QUELQUES CHIFFRES", ...facts.map((x) => `- ${x}`)] : []),
    ...(maturity.length ? ["", "LES NIVEAUX DE MATURITÉ DÉCLARÉS", ...maturity.map((x) => `- ${x}`)] : []),
    ...(top.length ? ["", `LES ${top.length} CAS D'USAGE LES PLUS CHOISIS`, ...top.map((x, i) => `${i + 1}. ${x}`)] : []),
    "", "ET POUR LA SUITE ?",
    `- Une question sur vos résultats ou sur un cas d'usage ? Répondez à ce message, ou réservez 30 minutes : ${app.rdv_url}`,
    ...offres.map((o) => `- ${o.titre} : ${o.texte}`),
    `- ${suiteDiag} ${home}`,
    ...(r.ressources || []).map((x) => `- ${x.titre} : ${x.url}`),
    "", closing, "", sign.nom || "", sign.role || "",
    "", `${app.coedition}.`,
  ].join("\n");
  return { subject, html, text, replyTo: app.contact };
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
  FOLLOWUP_DELAY_HOURS, FOLLOWUP_MAX_ATTEMPTS,
  esc, labelOf, reportEmail, followupEmail, percents, CSV_COLUMNS, mcpInstructions, maskEmail, brevoContact,
};
