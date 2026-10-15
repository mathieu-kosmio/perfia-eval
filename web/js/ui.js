/**
 * PerfIA Diagnostic IA : utilitaires d'interface partagés (parcours, rapport, vue salle, équipe).
 * Icônes, illustrations des niveaux, jauge d'effort, matrice de priorisation, accès réseau et stockage local.
 * Aucune dépendance. Expose window.PerfiaUI.
 */
(function () {
  "use strict";

  // Typographie française : espace insécable avant « : ; ! ? » et après « (pas de signe seul en début de ligne).
  const typo = (s) => String(s == null ? "" : s).replace(/ ([:;!?»])/g, "\u00a0$1").replace(/« /g, "«\u00a0");
  const esc = (s) => typo(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------- Réseau ---------- */
  async function api(method, path, body, headers) {
    const h = Object.assign({}, headers || {});
    let payload;
    if (body !== undefined) { h["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
    const res = await fetch(path, { method, headers: h, body: payload, credentials: "same-origin" });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const err = new Error((data && data.message) || `Erreur ${res.status}`);
      err.status = res.status; err.data = (data && data.data) || {};
      throw err;
    }
    return data;
  }
  let refPromise = null;
  const loadRef = () => refPromise || (refPromise = fetch("/content/referentiel.json", { cache: "no-cache" }).then((r) => {
    if (!r.ok) throw new Error("Référentiel indisponible");
    return r.json();
  }));

  /* ---------- Stockage local (confort, jamais indispensable) ---------- */
  const store = {
    get(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (_) { return null; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {} },
    del(key) { try { localStorage.removeItem(key); } catch (_) {} },
  };

  /* ---------- Icônes (trait, 24 x 24, couleur du texte) ---------- */
  const P = {
    ia: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3.2"/>',
    donnees: '<ellipse cx="12" cy="5.5" rx="7" ry="2.5"/><path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13"/><path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>',
    cadre: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    search: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><path d="M14 3v4h4M14 3l4 4v3"/><circle cx="16.5" cy="16.5" r="3"/><path d="M18.7 18.7L21 21"/>',
    pen: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    ruler: '<path d="M4 20L20 4"/><path d="M12 4l8 8M7 9l2-2M10 12l2-2M13 15l2-2"/><path d="M4 12l8 8"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h6"/>',
    gauge: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/><path d="M4 21h16"/>',
    truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
    log: '<circle cx="6" cy="12" r="3.5"/><path d="M6 8.5h12a3.5 3.5 0 0 1 0 7H6"/><circle cx="6" cy="12" r="1"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    left: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    right: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
    starFill: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    expand: '<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><rect x="7" y="14" width="10" height="7"/>',
  };
  function icon(name, label) {
    const a = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true" focusable="false"';
    const fill = name === "starFill" ? "currentColor" : "none";
    return `<svg viewBox="0 0 24 24" ${a} fill="${fill}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[name] || P.grid}</svg>`;
  }

  /* ---------- Illustrations des niveaux : stades d'un peuplement forestier ---------- */
  function tree(x, h, r, ground) {
    const top = ground - h;
    return `<line x1="${x}" y1="${ground}" x2="${x}" y2="${top + r * 0.6}" stroke-width="${Math.max(1.6, r / 6)}"/>` +
      `<circle cx="${x}" cy="${top}" r="${r}" fill="currentColor" fill-opacity=".22"/>`;
  }
  const STAGES = {
    1: () => `<path d="M60 100V80"/><path d="M60 86c-9 0-14-6-14-12 8 0 14 4 14 12z" fill="currentColor" fill-opacity=".25"/><path d="M60 82c8 0 13-6 13-11-7 0-13 4-13 11z" fill="currentColor" fill-opacity=".25"/><path d="M50 100c4-2 16-2 20 0" stroke-opacity=".6"/>`,
    2: () => [[34, 18, 8], [46, 24, 9], [58, 20, 9], [70, 26, 9], [84, 19, 8]].map((t) => tree(t[0], t[1], t[2], 100)).join(""),
    3: () => [[32, 42, 8], [50, 50, 9], [68, 46, 9], [86, 40, 8]].map((t) => tree(t[0], t[1], t[2], 100)).join(""),
    4: () => [[34, 62, 12], [60, 70, 13], [86, 64, 12]].map((t) => tree(t[0], t[1], t[2], 100)).join(""),
    5: () => [[38, 72, 19], [80, 76, 20]].map((t) => tree(t[0], t[1], t[2], 100)).join("") + `<path d="M56 100v-8" /><circle cx="56" cy="90" r="4" fill="currentColor" fill-opacity=".22"/><path d="M59 100v-6"/><circle cx="59" cy="92" r="3"/>`,
  };
  function stage(n, label) {
    const a = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true" focusable="false"';
    return `<svg viewBox="16 2 88 104" ${a} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 100h84" stroke-opacity=".5"/>${(STAGES[n] || STAGES[1])()}</svg>`;
  }

  /* ---------- Jauge d'effort (1 à 5) ---------- */
  function gauge(effort) {
    const segs = [1, 2, 3, 4, 5].map((i) => {
      const a0 = Math.PI * (1 - (i - 1) / 5), a1 = Math.PI * (1 - i / 5);
      const p = (a) => `${(24 + 18 * Math.cos(a)).toFixed(2)} ${(25 - 18 * Math.sin(a)).toFixed(2)}`;
      return `<path d="M${p(a0)} A18 18 0 0 1 ${p(a1)}" stroke="var(--gauge-${i})" stroke-width="6" fill="none"/>`;
    }).join("");
    const a = Math.PI * (1 - (effort - 0.5) / 5);
    const nx = (24 + 14 * Math.cos(a)).toFixed(2), ny = (25 - 14 * Math.sin(a)).toFixed(2);
    return `<span class="gauge" role="img" aria-label="Effort ${effort} sur 5"><svg viewBox="0 0 48 30" aria-hidden="true">${segs}<line x1="24" y1="25" x2="${nx}" y2="${ny}" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="24" cy="25" r="3" fill="var(--bg)" stroke="currentColor" stroke-width="2"/></svg><b>${effort}/5</b></span>`;
  }

  /* ---------- Matrice effort × priorité ---------- */
  /**
   * cells : [{ effort, priority, nums: [..], types: [..] }] (résultat individuel)
   *      ou [{ effort, priority, count, type, label }] (agrégat de la vue salle, opts.aggregate).
   */
  function matrix(cells, opts) {
    opts = opts || {};
    const W = 320, H = 310, L = 44, R = 14, T = 26, B = 44;
    // Axes de 0,5 à 5,5 : les bulles des valeurs 1 et 5 ne touchent pas les bords ni les libellés des quadrants.
    const x = (e) => L + ((e - 0.5) / 5) * (W - L - R), y = (p) => T + ((5.5 - p) / 5) * (H - T - B);
    const mid = { x: x(2.5), y: y(3.5) };
    const grid = `<rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="none" stroke="currentColor" stroke-opacity=".25"/>` + [1, 2, 3, 4, 5].map((v) => `<line x1="${x(v)}" y1="${T}" x2="${x(v)}" y2="${H - B}" stroke="currentColor" stroke-opacity=".1"/><line x1="${L}" y1="${y(v)}" x2="${W - R}" y2="${y(v)}" stroke="currentColor" stroke-opacity=".1"/>` +
      `<text x="${x(v)}" y="${H - B + 18}" text-anchor="middle" font-size="12" fill="currentColor" fill-opacity=".7">${v}</text><text x="${L - 12}" y="${y(v) + 4}" text-anchor="middle" font-size="12" fill="currentColor" fill-opacity=".7">${v}</text>`).join("");
    const quad = `<rect x="${L}" y="${T}" width="${mid.x - L}" height="${mid.y - T}" fill="var(--accent-fill)" fill-opacity=".10"/>` +
      // Libellés du haut au-dessus du cadre : une grosse bulle de priorité 5 ne les masque jamais.
      `<text x="${L}" y="${T - 9}" font-size="10" font-weight="700" fill="currentColor" fill-opacity=".85">À tester tout de suite</text>` +
      `<text x="${W - R}" y="${T - 9}" font-size="10" text-anchor="end" fill="currentColor" fill-opacity=".6">À cadrer</text>` +
      `<text x="${L + 6}" y="${H - B - 8}" font-size="10" fill="currentColor" fill-opacity=".55">Gains d'appoint</text>` +
      `<text x="${W - R - 6}" y="${H - B - 8}" font-size="10" text-anchor="end" fill="currentColor" fill-opacity=".55">Plus tard</text>` +
      `<line x1="${mid.x}" y1="${T}" x2="${mid.x}" y2="${H - B}" stroke="currentColor" stroke-opacity=".3" stroke-dasharray="4 4"/><line x1="${L}" y1="${mid.y}" x2="${W - R}" y2="${mid.y}" stroke="currentColor" stroke-opacity=".3" stroke-dasharray="4 4"/>`;
    const color = (types) => types.length === 1 ? `var(--type-${types[0]})` : "var(--type-mixte)";
    let dots;
    if (opts.aggregate) {
      const max = Math.max.apply(null, cells.map((c) => c.count).concat([1]));
      dots = cells.map((c, i) => {
        const r = 8 + 14 * Math.sqrt(c.count / max);
        const jitter = ((i % 3) - 1) * 4;
        return `<g><title>${esc(c.label)} : ${c.count} réponse(s), priorité moyenne ${c.priority}</title><circle cx="${x(c.effort) + jitter}" cy="${y(c.priority)}" r="${r.toFixed(1)}" fill="var(--type-${c.type})" fill-opacity=".85" stroke="var(--bg)" stroke-width="1.5"/><text x="${x(c.effort) + jitter}" y="${y(c.priority) + 4}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink-950)">${i + 1}</text></g>`;
      }).join("");
    } else {
      dots = cells.map((c) => {
        const r = 11 + 2.5 * Math.min(4, c.nums.length - 1);
        const label = c.nums.join(",");
        const fs = label.length > 4 ? 9 : 12;
        return `<g><title>Effort ${c.effort}, priorité ${c.priority} : cas ${label}</title><circle cx="${x(c.effort)}" cy="${y(c.priority)}" r="${r}" fill="${color(c.types)}" stroke="var(--bg)" stroke-width="1.5"/><text x="${x(c.effort)}" y="${y(c.priority) + fs / 3}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="var(--ink-950)">${esc(label)}</text></g>`;
      }).join("");
    }
    const axes = `<text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle" font-size="11" letter-spacing="1.5" fill="currentColor" fill-opacity=".8">EFFORT →</text>` +
      `<text transform="translate(12 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle" font-size="11" letter-spacing="1.5" fill="currentColor" fill-opacity=".8">PRIORITÉ →</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || "Matrice de priorisation : effort en abscisse, priorité en ordonnée")}">${quad}${grid}${dots}${axes}</svg>`;
  }

  /* ---------- QR code (bibliothèque qrcode-generator, intégrée dans /vendor) ---------- */
  function qr(text, cell) {
    if (typeof window.qrcode !== "function") return "";
    const q = window.qrcode(0, "M");
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: cell || 6, margin: 2, scalable: true, alt: `QR code : ${text}` });
  }

  const fmtDate = (s) => { const t = Date.parse(String(s || "").replace(" ", "T")); return isNaN(t) ? "" : new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); };

  /* ---------- En-tête co-brandé ---------- */
  function brandbar(session) {
    const org = session && session.organizer_logo ? `<img class="org" src="${esc(session.organizer_logo)}" alt="${esc(session.organizer_name || "Organisateur")}">` : "";
    return `<header class="brandbar"><img class="perfia" src="/assets/logos/perfia-sombre.svg" alt="PerfIA" width="36" height="36">` +
      `<div class="partners"><img src="/assets/logos/logo-kosmio.svg" alt="Kosmio" height="22"><span class="x" aria-hidden="true">✕</span><img class="xylo" src="/assets/logos/xylofutur.png" alt="Xylofutur" height="26">${org}</div></header>`;
  }

  window.PerfiaUI = { esc, typo, $, $$, api, loadRef, store, icon, stage, gauge, matrix, qr, fmtDate, brandbar };
})();
