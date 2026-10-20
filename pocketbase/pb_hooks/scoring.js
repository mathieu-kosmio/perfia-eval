/**
 * PerfIA Diagnostic IA : règles de calcul, partagées par le navigateur et le serveur.
 *
 * SOURCE UNIQUE : ce fichier. `make referentiel` le recopie dans web/js/scoring.js ; les tests vérifient que les deux
 * copies sont identiques. Le serveur recalcule toujours le résultat (POST /api/app/diagnostics) : le calcul du
 * navigateur ne sert qu'à l'affichage immédiat.
 *
 * Écrit en JavaScript simple (pas de `?.`, pas de décomposition d'objet) : il doit tourner dans la machine
 * virtuelle des hooks PocketBase comme dans Safari iOS 16.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  else root.PerfiaScoring = api;
})(typeof self !== "undefined" ? self : this, function () {
  var AXES_CODES = ["ia", "donnees", "cadre"];
  var STATES = ["veut", "deja"];
  var LIMITS = { firstname: 60, lastname: 80, company: 120, email: 160, phone: 30, free_text: 280, source: 120 };
  var EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[A-Za-z]{2,}$/;

  function byCode(list) { var m = {}; (list || []).forEach(function (x) { m[x.code] = x; }); return m; }
  function int(v) { var n = Number(v); return Math.round(n) === n ? n : NaN; }
  function str(v, max) { return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max); }
  function fill(tpl, vars) { return String(tpl).replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ""; }); }

  /** Catalogue appliqué à un maillon (transversal pour un maillon sans catalogue propre). */
  function catalogueOf(ref, maillon) {
    var m = byCode(ref.maillons)[maillon];
    return m && ref.catalogues[m.catalogue] ? m.catalogue : "transversal";
  }

  /**
   * Familles affichées à l'étape « Cas d'usage », dans l'ordre. Les familles liées à la fonction du répondant
   * passent en tête et la première s'ouvre ; on réordonne, on ne masque rien. En version courte : une seule liste.
   */
  function familiesFor(ref, maillon, fonction, flow) {
    var cat = ref.catalogues[catalogueOf(ref, maillon)];
    if (flow === "court") return [{ code: "court", label: "Cas d'usage", icon: "grid", cases: cat.court.slice(), open: true }];
    var fams = cat.familles.map(function (f, i) {
      var def = ref.familles[f.famille] || { label: f.famille, icon: "grid", fonctions: [] };
      return { code: f.famille, label: def.label, icon: def.icon, cases: f.cases.slice(), match: (def.fonctions || []).indexOf(fonction) >= 0, i: i };
    });
    fams.sort(function (a, b) { return (b.match - a.match) || (a.i - b.i); });
    return fams.map(function (f, i) { return { code: f.code, label: f.label, icon: f.icon, cases: f.cases, open: i === 0 }; });
  }

  /** Codes proposés à un maillon dans une version donnée (sert à la validation). */
  function allowedCodes(ref, maillon, flow) {
    var out = {};
    familiesFor(ref, maillon, "", flow).forEach(function (f) { f.cases.forEach(function (c) { out[c] = true; }); });
    return out;
  }

  /** Effort d'un cas (1 à 5) : complexité Processothèque, relevée de 1 quand les données sont à structurer. */
  function effortOf(ref, code, levels) {
    var c = ref.cases[code];
    var base = c ? c.effort : 3;
    var adjust = !!(c && (c.type === "donnees" || c.corpus) && levels && levels.donnees <= ref.regles.ajustement_donnees);
    return { base: base, value: Math.min(5, base + (adjust ? 1 : 0)), ajuste: adjust };
  }

  function quadrantOf(ref, effort, priority) {
    var high = priority >= ref.regles.priorite_forte, easy = effort <= ref.regles.effort_faible;
    if (high) return easy ? "tester" : "cadrer";
    return easy ? "appoint" : "plus_tard";
  }

  function levelsOk(cond, levels) {
    var k;
    if (cond.min) for (k in cond.min) if (!(levels[k] >= cond.min[k])) return false;
    if (cond.max) for (k in cond.max) if (!(levels[k] <= cond.max[k])) return false;
    return true;
  }

  /**
   * Résultat complet d'un diagnostic. `input` : { maillon, size, levels: { ia, donnees, cadre },
   * cases: [{ code, state: "veut" | "deja", priority }] } déjà validé.
   */
  function compute(ref, input) {
    var levels = input.levels || {};
    var catalogue = catalogueOf(ref, input.maillon);
    var tpe = input.size === "1-5";

    var axes = ref.axes.map(function (a) {
      var n = levels[a.code];
      var lv = a.levels[n - 1] || a.levels[0];
      var niv = ref.niveaux[n - 1] || ref.niveaux[0];
      return { code: a.code, label: a.label, court: a.court, n: n, niveau: niv.nom, titre: lv.titre, tags: lv.tags, steps: lv.steps };
    });

    var wanted = [], acquis = [];
    (input.cases || []).forEach(function (sel) {
      var c = ref.cases[sel.code];
      if (!c) return;
      if (sel.state === "deja") { acquis.push({ code: sel.code, label: c.label, type: c.type }); return; }
      var prio = sel.priority >= 1 && sel.priority <= 5 ? sel.priority : ref.regles.priorite_defaut;
      var eff = effortOf(ref, sel.code, levels);
      wanted.push({
        code: sel.code, label: c.label, type: c.type, priority: prio, noted: sel.priority >= 1 && sel.priority <= 5,
        effort: eff.value, effort_base: eff.base, ajuste: eff.ajuste, quadrant: quadrantOf(ref, eff.value, prio),
        vigilance: c.vigilance || "", note_tpe: tpe && c.note_tpe ? c.note_tpe : "", statut: c.statut || "",
      });
    });
    wanted.forEach(function (w, i) { w.num = i + 1; });

    var parType = {};
    Object.keys(ref.types).forEach(function (t) {
      parType[t] = wanted.filter(function (w) { return w.type === t; })
        .sort(function (a, b) { return (a.effort - b.effort) || (b.priority - a.priority) || (a.num - b.num); })
        .map(function (w) { return w.num; });
    });

    var cells = {};
    wanted.forEach(function (w) {
      var k = w.effort + ":" + w.priority;
      if (!cells[k]) cells[k] = { effort: w.effort, priority: w.priority, nums: [], types: [] };
      cells[k].nums.push(w.num);
      if (cells[k].types.indexOf(w.type) < 0) cells[k].types.push(w.type);
    });
    var matrix = Object.keys(cells).map(function (k) { return cells[k]; })
      .sort(function (a, b) { return (a.effort - b.effort) || (b.priority - a.priority); });

    var quadrants = {};
    ref.quadrants.forEach(function (q) {
      quadrants[q.code] = wanted.filter(function (w) { return w.quadrant === q.code; })
        .sort(function (a, b) { return (b.priority - a.priority) || (a.effort - b.effort); })
        .map(function (w) { return w.num; });
    });

    // Suites : au plus 2 offres, dans l'ordre du référentiel.
    var first = function (q) { var n = quadrants[q][0]; return n ? wanted[n - 1].label : ""; };
    var vars = { tester: first("tester"), cadrer: first("cadrer") };
    var offres = [];
    ref.offres.forEach(function (o) {
      if (offres.length >= 2) return;
      if (o.si.quadrant && !quadrants[o.si.quadrant].length) return;
      if (!levelsOk(o.si, levels)) return;
      offres.push({ code: o.code, titre: o.titre, texte: fill(o.texte, vars) });
    });
    if (!offres.length) offres.push({ code: ref.offre_defaut.code, titre: ref.offre_defaut.titre, texte: ref.offre_defaut.texte });
    var ressources = ref.ressources.filter(function (r) { return levelsOk(r.si, levels); })
      .map(function (r) { return { code: r.code, titre: r.titre, texte: r.texte, url: r.url }; });

    var all = wanted.concat(acquis);
    var vigilances = ref.vigilances.filter(function (v) {
      var s = v.si;
      if (s.type) return wanted.some(function (w) { return w.type === s.type; });
      if (s.catalogue) return s.catalogue.indexOf(catalogue) >= 0;
      if (s.cas) return all.length > 0;
      if (s.corpus) return wanted.some(function (w) { return ref.cases[w.code].corpus; });
      return levelsOk(s, levels);
    }).map(function (v) { return v.texte; });

    return {
      version: ref.version, catalogue: catalogue, axes: axes, cases: wanted, acquis: acquis, par_type: parType,
      matrix: matrix, quadrants: quadrants, offres: offres, ressources: ressources, vigilances: vigilances,
    };
  }

  /**
   * Valide et nettoie une réponse reçue (serveur) ou prête à partir (navigateur).
   * Retourne { ok, errors: { champ: message }, clean }.
   */
  function validate(ref, body, opts) {
    opts = opts || {};
    var b = body || {}, errors = {}, clean = {};
    var flow = opts.flow === "court" ? "court" : "complet";

    clean.firstname = str(b.firstname, LIMITS.firstname);
    clean.lastname = str(b.lastname, LIMITS.lastname);
    clean.company = str(b.company, LIMITS.company);
    clean.email = str(b.email, LIMITS.email).toLowerCase();
    clean.phone = str(b.phone, LIMITS.phone);
    clean.role = str(b.role, 30);
    clean.maillon = str(b.maillon, 40);
    clean.size = str(b.size, 10);
    clean.free_text = str(b.free_text, LIMITS.free_text);
    clean.source = str(b.source, LIMITS.source);

    if (!clean.firstname) errors.firstname = "Indiquez votre prénom.";
    if (!clean.company) errors.company = "Indiquez votre entreprise.";
    if (!EMAIL_RE.test(clean.email)) errors.email = "Indiquez une adresse e-mail valide.";
    if (!byCode(ref.maillons)[clean.maillon]) errors.maillon = "Choisissez votre maillon.";
    if (flow === "complet") {
      if (!clean.lastname) errors.lastname = "Indiquez votre nom.";
      if (!byCode(ref.fonctions)[clean.role]) errors.role = "Choisissez votre fonction.";
      if (!byCode(ref.effectifs)[clean.size]) errors.size = "Choisissez votre effectif.";
    } else {
      if (clean.role && !byCode(ref.fonctions)[clean.role]) clean.role = "";
      if (clean.size && !byCode(ref.effectifs)[clean.size]) clean.size = "";
    }
    if (clean.phone && !/^[0-9 +().-]{6,30}$/.test(clean.phone)) errors.phone = "Ce numéro de téléphone n'est pas valide.";

    clean.levels = {};
    var lv = b.levels || {};
    AXES_CODES.forEach(function (k) {
      var n = int(lv[k]);
      if (!(n >= 1 && n <= 5)) errors["levels." + k] = "Choisissez un niveau pour chaque axe.";
      else clean.levels[k] = n;
    });

    clean.pulse = null;
    if (b.pulse !== undefined && b.pulse !== null && b.pulse !== "") {
      var p = int(b.pulse);
      if (p >= 1 && p <= 5) clean.pulse = p; else errors.pulse = "La note va de 1 à 5.";
    }

    clean.cases = [];
    var allowed = clean.maillon ? allowedCodes(ref, clean.maillon, flow) : {};
    var seen = {};
    var list = Array.isArray(b.cases) ? b.cases : [];
    if (list.length > 40) errors.cases = "Trop de cas d'usage.";
    list.slice(0, 40).forEach(function (s) {
      var code = str(s && s.code, 60);
      if (!allowed[code]) { errors.cases = "Un cas d'usage ne fait pas partie de votre liste."; return; }
      if (seen[code]) return;
      seen[code] = true;
      var state = STATES.indexOf(s.state) >= 0 ? s.state : "veut";
      var pr = int(s.priority);
      clean.cases.push({ code: code, state: state, priority: state === "veut" && pr >= 1 && pr <= 5 ? pr : null });
    });

    clean.consent_processing = b.consent_processing === true;
    clean.consent_contact = b.consent_contact === true;
    clean.consent_partner = b.consent_partner === true && !!opts.partner;
    clean.consent_news = b.consent_news === true;
    if (!clean.consent_processing) errors.consent_processing = "Ce consentement est nécessaire pour établir votre feuille de route.";

    var d = int(b.duration_s);
    clean.duration_s = d >= 0 && d < 86400 ? d : 0;

    return { ok: Object.keys(errors).length === 0, errors: errors, clean: clean };
  }

  /**
   * Agrégats anonymes d'une session pour la vue salle. `rows` : [{ levels, pulse, cases }].
   * Rien n'est renvoyé sous le seuil (3 réponses par défaut).
   */
  function aggregate(ref, rows, opts) {
    opts = opts || {};
    var n = rows.length, seuil = ref.regles.seuil_agregats;
    var out = { n: n, seuil: seuil, ready: n >= seuil };
    if (!out.ready) return out;

    out.axes = {};
    ref.axes.forEach(function (a) {
      var dist = [0, 0, 0, 0, 0], sum = 0, k = 0;
      rows.forEach(function (r) { var v = r.levels && r.levels[a.code]; if (v >= 1 && v <= 5) { dist[v - 1]++; sum += v; k++; } });
      out.axes[a.code] = { label: a.label, court: a.court, dist: dist, mean: k ? Math.round((sum / k) * 10) / 10 : null };
    });

    var ps = rows.map(function (r) { return r.pulse; }).filter(function (v) { return v >= 1 && v <= 5; });
    out.pulse = { n: ps.length, mean: ps.length ? Math.round((ps.reduce(function (a, b) { return a + b; }, 0) / ps.length) * 10) / 10 : null };

    var counts = {};
    rows.forEach(function (r) {
      (r.cases || []).forEach(function (s) {
        if (s.state !== "veut" || !ref.cases[s.code]) return;
        var c = counts[s.code] || (counts[s.code] = { code: s.code, count: 0, prio: 0 });
        c.count++;
        c.prio += s.priority >= 1 && s.priority <= 5 ? s.priority : ref.regles.priorite_defaut;
      });
    });
    var top = Object.keys(counts).map(function (k) {
      var c = counts[k], def = ref.cases[k];
      return { code: k, label: def.label, type: def.type, count: c.count, prio_mean: Math.round((c.prio / c.count) * 10) / 10, effort: def.effort };
    }).sort(function (a, b) { return (b.count - a.count) || (b.prio_mean - a.prio_mean); });
    out.top = top.slice(0, opts.top || 8);
    out.choix = choices(ref, rows);
    return out;
  }

  /** Famille d'un cas dans le catalogue du maillon, sinon la première famille qui le contient. */
  function familyOf(ref, maillon, code) {
    var cats = [catalogueOf(ref, maillon)].concat(Object.keys(ref.catalogues));
    for (var i = 0; i < cats.length; i++) {
      var fams = (ref.catalogues[cats[i]] || {}).familles || [];
      for (var j = 0; j < fams.length; j++) if ((fams[j].cases || []).indexOf(code) >= 0) return fams[j].famille;
    }
    return "";
  }

  /**
   * Cas souhaités par la salle : total, moyenne par participant, répartition par type de cas et familles les plus
   * citées (la famille « tous » ne dit rien d'un métier : elle n'est pas comptée). Sert à la relance après session.
   */
  function choices(ref, rows) {
    var total = 0, types = {}, fams = {};
    rows.forEach(function (r) {
      (r.cases || []).forEach(function (s) {
        var def = ref.cases[s.code];
        if (s.state !== "veut" || !def) return;
        total++;
        types[def.type] = (types[def.type] || 0) + 1;
        var f = familyOf(ref, r.maillon, s.code);
        if (f && f !== "tous") fams[f] = (fams[f] || 0) + 1;
      });
    });
    var familles = Object.keys(fams).map(function (k) {
      return { code: k, label: (ref.familles[k] || {}).label || k, count: fams[k] };
    }).sort(function (a, b) { return b.count - a.count; });
    return {
      total: total,
      moyenne: rows.length ? Math.round((total / rows.length) * 10) / 10 : 0,
      par_type: Object.keys(ref.types).map(function (k) { return { code: k, label: ref.types[k].label, count: types[k] || 0 }; })
        .sort(function (a, b) { return b.count - a.count; }),
      familles: familles.slice(0, 3),
    };
  }

  return {
    AXES_CODES: AXES_CODES, LIMITS: LIMITS, catalogueOf: catalogueOf, familiesFor: familiesFor, allowedCodes: allowedCodes,
    effortOf: effortOf, quadrantOf: quadrantOf, compute: compute, validate: validate, aggregate: aggregate,
  };
});
