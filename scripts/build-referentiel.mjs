#!/usr/bin/env node
/**
 * PerfIA Diagnostic IA : construit le référentiel à partir de deux sources.
 *
 *   content/processotheque.snapshot.json   textes des cas (Processothèque, instantané daté)
 *   content/editorial.mjs                  axes, niveaux, catalogues, libellés courts, types, règles, offres
 *
 * Produit (fichiers générés, à ne pas modifier à la main) :
 *   web/content/referentiel.json           lu par l'interface
 *   pocketbase/pb_hooks/referentiel.js     lu par les hooks (même contenu)
 *   web/js/scoring.js                      copie de pocketbase/pb_hooks/scoring.js (règles de calcul)
 *
 * Usage : node scripts/build-referentiel.mjs [--check] [--strict]
 *   --check   n'écrit rien ; échoue si les fichiers générés ne sont pas à jour (utilisé par les tests)
 *   --strict  échoue si un cas proposé n'est pas validé dans la Processothèque (avant une mise en ligne publique)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const STRICT = process.argv.includes("--strict");

const ed = await import(pathToFileURL(join(ROOT, "content/editorial.mjs")).href);
const snap = JSON.parse(readFileSync(join(ROOT, "content/processotheque.snapshot.json"), "utf8"));
const skills = Object.fromEntries(snap.skills.map((s) => [s.code, s]));

const errors = [];
const fail = (msg) => errors.push(msg);

/* ---------- Cas ---------- */
const used = new Set();
for (const [key, cat] of Object.entries(ed.CATALOGUES)) {
  if (!cat.familles.length) fail(`catalogue ${key} : aucune famille`);
  for (const f of cat.familles) {
    if (!ed.FAMILLES[f.famille]) fail(`catalogue ${key} : famille inconnue ${f.famille}`);
    if (!f.cases.length) fail(`catalogue ${key} : famille ${f.famille} vide`);
    f.cases.forEach((c) => used.add(c));
  }
  const all = new Set(cat.familles.flatMap((f) => f.cases));
  if (cat.court.length < 1 || cat.court.length > 10) fail(`catalogue ${key} : la version courte doit compter 1 à 10 cas`);
  cat.court.forEach((c) => { if (!all.has(c)) fail(`catalogue ${key} : ${c} est dans la version courte mais dans aucune famille`); });
}

const cases = {};
const drafts = [];
for (const code of [...used].sort()) {
  const o = ed.CASES[code];
  if (!o) { fail(`cas ${code} : absent de content/editorial.mjs (CASES)`); continue; }
  const s = skills[code];
  if (!s && !code.startsWith("NEW_")) { fail(`cas ${code} : absent de l'instantané Processothèque`); continue; }
  const c = {
    code,
    label: o.label,
    type: o.type,
    effort: o.effort || (s && s.technical_complexity_score) || 3,
    description: o.description || (s && s.description) || "",
    donnees: o.donnees || (s && s.implementation_requirements) || "",
    vigilance: o.vigilance || "",
    statut: o.statut || (s && s.status) || "",
  };
  if (o.corpus) c.corpus = true;
  if (o.note_tpe) c.note_tpe = o.note_tpe;
  if (!c.label || c.label.length > 80) fail(`cas ${code} : libellé vide ou de plus de 80 caractères`);
  if (!ed.TYPES[c.type]) fail(`cas ${code} : type inconnu ${c.type}`);
  if (!(c.effort >= 1 && c.effort <= 5)) fail(`cas ${code} : effort hors de 1 à 5`);
  if (c.statut !== "validated") drafts.push(`${code} (${c.statut || "?"})`);
  cases[code] = c;
}
for (const code of Object.keys(ed.CASES)) if (!used.has(code)) fail(`cas ${code} : décrit dans CASES mais proposé dans aucun catalogue`);

/* ---------- Axes et listes ---------- */
for (const a of ed.AXES) {
  if (a.levels.length !== 5) fail(`axe ${a.code} : 5 niveaux attendus`);
  a.levels.forEach((l, i) => {
    if (l.n !== i + 1) fail(`axe ${a.code} : niveaux mal numérotés`);
    if (l.steps.length !== 3) fail(`axe ${a.code}, niveau ${l.n} : 3 étapes attendues`);
  });
}
for (const m of ed.MAILLONS) if (!ed.CATALOGUES[m.catalogue]) fail(`maillon ${m.code} : catalogue inconnu ${m.catalogue}`);

if (errors.length) {
  console.error("Référentiel invalide :\n- " + errors.join("\n- "));
  process.exit(1);
}
if (drafts.length) {
  const msg = `${drafts.length} cas proposés ne sont pas validés dans la Processothèque : ${drafts.join(", ")}`;
  if (STRICT) { console.error(msg); process.exit(1); }
  if (!CHECK) console.warn("Attention : " + msg);
}

/* ---------- Assemblage ---------- */
const content = {
  app: ed.APP,
  source: { processotheque: snap.source, generated_at: snap.generated_at },
  maillons: ed.MAILLONS,
  fonctions: ed.FONCTIONS,
  effectifs: ed.EFFECTIFS,
  niveaux: ed.NIVEAUX,
  axes: ed.AXES,
  pulse_default: ed.PULSE_DEFAULT,
  types: ed.TYPES,
  familles: ed.FAMILLES,
  catalogues: ed.CATALOGUES,
  cases,
  quadrants: ed.QUADRANTS,
  regles: ed.REGLES,
  offres: ed.OFFRES,
  offre_defaut: ed.OFFRE_DEFAUT,
  ressources: ed.RESSOURCES,
  vigilances: ed.VIGILANCES,
};
const hash = createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(0, 8);
const ref = { version: `${snap.generated_at}.${hash}`, ...content };
const json = JSON.stringify(ref);

const outputs = {
  "web/content/referentiel.json": json + "\n",
  "pocketbase/pb_hooks/referentiel.js": "/* Fichier généré par scripts/build-referentiel.mjs : ne pas modifier. Source : content/. */\nmodule.exports = " + json + ";\n",
  "web/js/scoring.js": readFileSync(join(ROOT, "pocketbase/pb_hooks/scoring.js"), "utf8"),
};

let stale = [];
for (const [rel, data] of Object.entries(outputs)) {
  const path = join(ROOT, rel);
  const current = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (current === data) continue;
  if (CHECK) { stale.push(rel); continue; }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  console.log(`écrit : ${rel}`);
}
if (CHECK && stale.length) {
  console.error(`Référentiel à reconstruire (make referentiel) : ${stale.join(", ")}`);
  process.exit(1);
}
if (!CHECK) console.log(`Référentiel ${ref.version} : ${Object.keys(cases).length} cas, ${Object.keys(ed.CATALOGUES).length} catalogues.`);
