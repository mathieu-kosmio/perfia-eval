/**
 * PerfIA Diagnostic IA : parcours participant (index.html).
 *
 * Étapes : accueil, Vous, Maturité, Cas d'usage, Priorité, Feuille de route, fin. L'identité passe en dernier si la
 * session le demande (identity_position = fin). Le diagnostic est envoyé en entrant dans la feuille de route : le
 * serveur recalcule le résultat, qui fait foi. La progression est gardée dans le navigateur pour reprendre après une
 * fermeture d'onglet ; un envoi qui échoue (réseau de salle) est rejoué au prochain chargement.
 */
(function () {
  "use strict";
  const U = window.PerfiaUI, SC = window.PerfiaScoring;
  const { esc, icon, stage, gauge } = U;
  const main = document.getElementById("main");

  const LABELS = { vous: "Vous", maturite: "Maturité", cas: "Cas", priorite: "Priorité", roadmap: "Feuille de route" };
  const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[A-Za-z]{2,}$/;

  const params = new URLSearchParams(location.search);
  const st = {
    ref: null, session: null, notice: "", code: (params.get("s") || "").toLowerCase(),
    step: "accueil", flow: params.get("v") === "court" ? "court" : "complet", identityPos: "debut",
    a: freshAnswers(), errors: {}, mIdx: 0, openFamilies: {}, details: {},
    startedAt: 0, token: "", result: null, sending: false, pending: null,
  };

  function freshAnswers() {
    return { firstname: "", lastname: "", company: "", role: "", email: "", phone: "", maillon: "", size: "",
      levels: {}, pulse: null, cases: {}, order: [], free_text: "", website: "",
      consent_processing: false, consent_contact: false, consent_partner: false, consent_news: false };
  }
  const storeKey = () => `perfia-diag:${st.code || "web"}`;
  function save() {
    U.store.set(storeKey(), { step: st.step, mIdx: st.mIdx, a: st.a, startedAt: st.startedAt, token: st.token, result: st.result, pending: st.pending, v: st.ref && st.ref.version });
  }
  const steps = () => st.identityPos === "fin" ? ["maturite", "cas", "priorite", "vous", "roadmap"] : ["vous", "maturite", "cas", "priorite", "roadmap"];
  const wanted = () => st.a.order.filter((c) => st.a.cases[c] && st.a.cases[c].state === "veut");
  const selectedCount = () => st.a.order.filter((c) => st.a.cases[c]).length;

  /* ---------- Démarrage ---------- */
  async function boot() {
    try {
      st.ref = await U.loadRef();
    } catch (_) {
      main.innerHTML = `<div class="notice warn mt-xl">Le diagnostic ne se charge pas. Vérifiez votre connexion, puis rechargez la page.</div>`;
      return;
    }
    if (st.code) {
      try {
        st.session = await U.api("GET", `/api/app/sessions/${encodeURIComponent(st.code)}`);
        if (st.session.status !== "ouverte") {
          st.notice = "Cette session est terminée. Vous pouvez tout de même faire le diagnostic.";
          st.session = null; st.code = "";
        }
      } catch (_) {
        st.notice = "Ce lien de session n'est pas reconnu. Vous pouvez tout de même faire le diagnostic.";
        st.code = "";
      }
    }
    if (st.session) {
      st.flow = st.session.flow;
      st.identityPos = st.session.identity_position;
      st.a.maillon = st.session.default_maillon || "";
    } else if (!st.code) {
      st.identityPos = "debut";
    }
    const saved = U.store.get(storeKey());
    if (saved && saved.a && saved.v === st.ref.version) {
      Object.assign(st.a, saved.a);
      st.step = saved.step || "accueil";
      st.mIdx = Math.min(Math.max(Number(saved.mIdx) || 0, 0), st.ref.axes.length);
      st.startedAt = saved.startedAt || 0;
      st.token = saved.token || "";
      st.result = saved.result || null;
      st.pending = saved.pending || null;
      if (st.step === "roadmap" && !st.result) st.step = steps()[3];
    }
    document.getElementById("brand").innerHTML = U.brandbar(st.session);
    main.addEventListener("click", onClick);
    main.addEventListener("input", onInput);
    main.addEventListener("change", onInput);
    render(true);
    if (st.pending && !st.token) submit();
  }

  /* ---------- Rendu ---------- */
  function render(moveFocus) {
    const key = document.activeElement && document.activeElement.getAttribute("data-key");
    const views = { accueil: viewHome, vous: viewYou, maturite: viewMaturity, cas: viewCases, priorite: viewPriority, roadmap: viewRoadmap, fin: viewEnd };
    main.innerHTML = (views[st.step] || viewHome)();
    if (moveFocus) {
      const h = main.querySelector("h1");
      if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
      window.scrollTo(0, 0);
    } else if (key) {
      const el = main.querySelector(`[data-key="${CSS.escape(key)}"]`);
      if (el) el.focus({ preventScroll: true });
    }
  }

  function stepper() {
    const list = steps(), cur = list.indexOf(st.step);
    return `<ol class="stepper" aria-label="Progression">${list.map((s, i) => {
      const cls = i < cur ? "done" : i === cur ? "current" : "";
      return `<li class="${cls}" ${i === cur ? 'aria-current="step"' : ""}><span class="dot">${i < cur ? icon("check") : i + 1}</span>${LABELS[s]}<span class="sr-only">${i < cur ? " (fait)" : ""}</span></li>`;
    }).join("")}</ol>`;
  }
  function nav(nextLabel, opts) {
    opts = opts || {};
    const prev = opts.noPrev ? "" : `<button type="button" class="btn ghost" data-action="prev" data-key="prev">${icon("left")}Précédent</button>`;
    return `<div class="navbtns ${opts.noPrev ? "single" : ""}">${prev}<button type="button" class="btn primary" data-action="${opts.action || "next"}" data-key="next" ${opts.disabled ? "disabled" : ""}>${esc(nextLabel || "Suivant")}${icon("right")}</button></div>`;
  }
  const head = (title, sub) => `${stepper()}<h1 class="screen-title">${U.typo(title)}</h1><p class="screen-sub">${U.typo(sub)}</p>`;

  /* ---------- Accueil ---------- */
  function viewHome() {
    const ref = st.ref, s = st.session;
    const resume = st.token
      ? `<div class="card"><p><b>Vous avez déjà une feuille de route sur cet appareil.</b></p><div class="navbtns"><a class="btn ghost" href="/rapport.html#${esc(st.token)}">${icon("eye")}La revoir</a><button type="button" class="btn primary" data-action="restart">Recommencer</button></div></div>`
      : st.startedAt ? `<div class="card"><p><b>Vous aviez commencé ce diagnostic.</b></p><div class="navbtns"><button type="button" class="btn ghost" data-action="restart">Recommencer</button><button type="button" class="btn primary" data-action="resume">Reprendre${icon("right")}</button></div></div>` : "";
    return `${st.notice ? `<p class="notice mt-l">${esc(st.notice)}</p>` : ""}
      <h1 class="screen-title hero-title">Votre feuille de route IA</h1>
      <p class="screen-sub">${s ? esc(s.title) : "Filière forêt-bois"}</p>
      ${resume}
      <div class="card">
        <ul class="steps">
          <li>Situez-vous sur trois axes : vos usages de l'IA, vos données, votre cadre.</li>
          <li>Choisissez les cas d'usage qui parlent à votre métier.</li>
          <li>Repartez avec vos prochaines étapes et une matrice de priorités, à garder en PDF.</li>
        </ul>
        <p class="muted small flush">Durée : ${esc(ref.app.duree[st.flow])} · aucun compte à créer.</p>
      </div>
      ${st.token || st.startedAt ? "" : `<div class="navbtns single"><button type="button" class="btn primary" data-action="start" data-key="start">Commencer${icon("right")}</button></div>`}
      <p class="muted small center">Vos réponses servent à établir votre feuille de route. <a href="/donnees.html">Comment sont utilisées vos données</a></p>`;
  }

  /* ---------- Vous ---------- */
  function field(name, label, input, opts) {
    opts = opts || {};
    const err = st.errors[name];
    return `<div class="field"><label for="f-${name}">${esc(label)}${opts.req ? ' <span class="req" aria-hidden="true">*</span>' : ""}</label>${input}${err ? `<p class="err" id="e-${name}">${esc(err)}</p>` : ""}${opts.hint ? `<p class="hint">${esc(opts.hint)}</p>` : ""}</div>`;
  }
  function text(name, label, req, type, auto) {
    const err = st.errors[name];
    return field(name, label, `<input id="f-${name}" data-field="${name}" data-key="f-${name}" type="${type || "text"}" value="${esc(st.a[name])}" ${req ? "required" : ""} ${auto ? `autocomplete="${auto}"` : ""} ${err ? `aria-invalid="true" aria-describedby="e-${name}"` : ""}>`, { req });
  }
  function select(name, label, list, req) {
    const err = st.errors[name];
    return field(name, label, `<select id="f-${name}" data-field="${name}" data-key="f-${name}" ${req ? "required" : ""} ${err ? `aria-invalid="true" aria-describedby="e-${name}"` : ""}><option value="">Choisir…</option>${list.map((o) => `<option value="${esc(o.code)}" ${st.a[name] === o.code ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`, { req });
  }
  function consent(name, label, req) {
    const err = st.errors[name];
    return `<label class="consent"><input type="checkbox" data-field="${name}" data-key="f-${name}" ${st.a[name] ? "checked" : ""} ${req ? "required" : ""}><span>${esc(label)}${req ? ' <span class="req" aria-hidden="true">*</span>' : ""}${err ? `<span class="err">${esc(err)}</span>` : ""}</span></label>`;
  }
  function viewYou() {
    const ref = st.ref, full = st.flow === "complet", last = st.identityPos === "fin";
    const partner = st.session && st.session.partner_consent_label;
    return `${head(last ? "Recevez votre feuille de route" : "Faisons connaissance !", last ? "Où vous l'envoyer, et à quel nom ?" : "Quelques informations pour personnaliser votre feuille de route")}
      ${st.errors._global ? `<p class="notice warn">${esc(st.errors._global)}</p>` : ""}
      <form class="card" novalidate onsubmit="return false">
        ${text("firstname", "Prénom", true, "text", "given-name")}
        ${text("lastname", "Nom", full, "text", "family-name")}
        ${text("company", "Entreprise", true, "text", "organization")}
        ${select("role", "Fonction", ref.fonctions, full)}
        ${text("email", "E-mail professionnel", true, "email", "email")}
        ${select("maillon", "Votre maillon dans la filière", ref.maillons, true)}
        ${select("size", "Effectif de l'entreprise", ref.effectifs, full)}
        ${full ? text("phone", "Téléphone (facultatif)", false, "tel", "tel") : ""}
        <div class="honeypot" aria-hidden="true"><label>Site web <input tabindex="-1" autocomplete="off" data-field="website" value=""></label></div>
        <hr class="sep">
        ${consent("consent_processing", "J'accepte que Kosmio traite ces informations pour établir et m'envoyer ma feuille de route.", true)}
        ${consent("consent_contact", "J'accepte d'être recontacté par Kosmio au sujet de l'accompagnement PerfIA.")}
        ${partner ? consent("consent_partner", partner) : ""}
        ${consent("consent_news", "Je souhaite recevoir les invitations aux webinaires et ateliers PerfIA.")}
        <p class="small muted flush"><a href="/donnees.html" target="_blank" rel="noopener">Comment sont utilisées mes données</a></p>
      </form>
      ${nav(last ? "Voir ma feuille de route" : "Suivant", { noPrev: steps()[0] === "vous" })}`;
  }
  function checkYou() {
    const e = {}, a = st.a, full = st.flow === "complet";
    if (!a.firstname.trim()) e.firstname = "Indiquez votre prénom.";
    if (full && !a.lastname.trim()) e.lastname = "Indiquez votre nom.";
    if (!a.company.trim()) e.company = "Indiquez votre entreprise.";
    if (full && !a.role) e.role = "Choisissez votre fonction.";
    if (!EMAIL_RE.test(a.email.trim())) e.email = "Indiquez une adresse e-mail valide.";
    if (!a.maillon) e.maillon = "Choisissez votre maillon.";
    if (full && !a.size) e.size = "Choisissez votre effectif.";
    if (a.phone && !/^[0-9 +().-]{6,30}$/.test(a.phone)) e.phone = "Ce numéro de téléphone n'est pas valide.";
    if (!a.consent_processing) e.consent_processing = "Ce consentement est nécessaire pour établir votre feuille de route.";
    return e;
  }

  /* ---------- Maturité : un axe par écran, puis la question éclair ---------- */
  // Écrans 0 à 2 : les axes ; écran 3 : la question éclair. Un toucher sur un niveau passe à l'écran suivant.
  const ADVANCE_MS = 320;
  let advanceTimer = 0;
  const mCount = () => st.ref.axes.length + 1;
  const firstMissingAxis = () => { const i = st.ref.axes.findIndex((ax) => !st.a.levels[ax.code]); return i < 0 ? st.ref.axes.length : i; };

  function subProgress(label) {
    const bars = Array.from({ length: mCount() }, (_, i) => `<i class="${i < st.mIdx ? "done" : i === st.mIdx ? "cur" : ""}"></i>`).join("");
    return `<div class="subprog"><span class="micro">${esc(label)}</span><span class="bars" aria-hidden="true">${bars}</span></div>`;
  }

  function viewMaturity() {
    const ref = st.ref, axes = ref.axes;
    if (st.mIdx >= axes.length) {
      const q = (st.session && st.session.pulse_question) || ref.pulse_default;
      return `${stepper()}${subProgress("Question éclair · facultative")}
        <h1 class="screen-title">${U.typo(q.replace(/\.$/, ""))}</h1><p class="screen-sub">De 1 (pas du tout) à 5 (tout à fait)</p>
        <div class="scale big" role="radiogroup" aria-label="${esc(q)}">${[1, 2, 3, 4, 5].map((i) => `<button type="button" role="radio" aria-checked="${st.a.pulse === i}" data-action="pulse" data-n="${i}" data-key="pulse-${i}">${i}</button>`).join("")}</div>
        <div class="scale-legend"><span>Pas du tout</span><span>Tout à fait</span></div>
        ${nav(st.a.pulse ? "Suivant" : "Passer")}`;
    }
    const ax = axes[st.mIdx], n = st.a.levels[ax.code];
    const opts = ax.levels.map((lv) => {
      const niv = ref.niveaux[lv.n - 1], on = n === lv.n;
      return `<button type="button" class="opt" role="radio" aria-checked="${on}" data-action="level" data-axis="${ax.code}" data-n="${lv.n}" data-key="lv-${ax.code}-${lv.n}">
        <span class="opt-art">${stage(lv.n)}</span>
        <span class="opt-txt"><b>${esc(niv.nom)}<span class="opt-n">niveau\u00a0${lv.n}</span></b><span>${esc(lv.titre)}</span></span>
        <span class="opt-check">${on ? icon("check") : ""}</span></button>`;
    }).join("");
    return `${stepper()}${subProgress(`Axe ${st.mIdx + 1} sur ${axes.length} · ${ax.label}`)}
      <h1 class="screen-title">${U.typo(ax.question)}</h1><p class="screen-sub">Touchez le niveau qui vous ressemble</p>
      <div class="opts" role="radiogroup" aria-label="${esc(ax.label)}">${opts}</div>
      ${st.errors.levels && !n ? `<p class="notice warn">${esc(st.errors.levels)}</p>` : ""}
      ${nav("Suivant", { noPrev: steps()[0] === "maturite" && st.mIdx === 0, disabled: !n })}`;
  }

  function chooseLevel(axis, value) {
    st.a.levels[axis] = value;
    save(); render(false);
    clearTimeout(advanceTimer);
    const at = st.mIdx;
    // Une courte pause pour voir son choix, puis l'écran suivant (y compris quand on corrige un axe déjà rempli).
    advanceTimer = setTimeout(() => { if (st.step === "maturite" && st.mIdx === at) { st.mIdx = at + 1; save(); render(true); } }, ADVANCE_MS);
  }

  /* ---------- Cas d'usage ---------- */
  function families() { return SC.familiesFor(st.ref, st.a.maillon, st.a.role, st.flow); }
  function caseItem(code) {
    const c = st.ref.cases[code], sel = st.a.cases[code], open = st.details[code];
    const tpe = st.a.size === "1-5" && c.note_tpe;
    return `<div class="case">
      <button type="button" class="case-row" role="checkbox" aria-checked="${!!sel}" aria-label="${esc(c.label)}" data-action="case" data-code="${code}" data-key="c-${code}"><span class="box">${sel ? icon("check") : ""}</span><span>${esc(c.label)}</span></button>
      ${sel ? `<div class="case-opts"><span class="seg" role="group" aria-label="Où en êtes-vous sur ce cas ?">
        <button type="button" aria-pressed="${sel.state === "veut"}" data-action="state" data-code="${code}" data-state="veut" data-key="sv-${code}">Je voudrais</button>
        <button type="button" aria-pressed="${sel.state === "deja"}" data-action="state" data-code="${code}" data-state="deja" data-key="sd-${code}">Déjà en place</button></span></div>` : ""}
      <button type="button" class="linkbtn indent" data-action="detail" data-code="${code}" data-key="d-${code}" aria-expanded="${!!open}">${open ? "Masquer le détail" : "Voir le détail"}</button>
      ${open ? `<div class="case-detail"><p>${esc(c.description)}</p>${c.donnees ? `<p><b>Données nécessaires :</b> ${esc(c.donnees)}</p>` : ""}<p><b>Vigilance :</b> ${esc(c.vigilance)}</p><p><span class="type ${c.type}">${esc(st.ref.types[c.type].label)}</span> <span class="small">effort ${c.effort} sur 5${c.statut === "a_creer" ? " · cas à construire avec un pilote" : ""}</span></p></div>` : ""}
      ${tpe ? `<p class="note-tpe">${icon("info")}<span>${esc(c.note_tpe)}</span></p>` : ""}
    </div>`;
  }
  function viewCases() {
    const fams = families();
    if (!Object.keys(st.openFamilies).length && fams.length) fams.forEach((f) => { if (f.open) st.openFamilies[f.code] = true; });
    const n = selectedCount();
    const body = st.flow === "court"
      ? `<div class="family" data-open="true"><div class="family-body">${fams[0].cases.map(caseItem).join("")}</div></div>`
      : fams.map((f) => {
        const open = !!st.openFamilies[f.code], k = f.cases.filter((c) => st.a.cases[c]).length;
        return `<section class="family" data-open="${open}">
          <button type="button" class="family-head" data-action="family" data-family="${f.code}" data-key="fam-${f.code}" aria-expanded="${open}" aria-label="${esc(f.label)} : ${k} sur ${f.cases.length} sélectionné${k > 1 ? "s" : ""}"><span class="axis-icon">${icon(f.icon)}</span><span class="t"><b>${esc(f.label)}</b><span>${k} / ${f.cases.length} sélectionné${k > 1 ? "s" : ""}</span></span><span class="chev">${icon("chevron")}</span></button>
          ${open ? `<div class="family-body">${f.cases.map(caseItem).join("")}</div>` : ""}</section>`;
      }).join("");
    return `${head("Quels cas d'usage vous parlent ?", "Cochez ceux que vous voudriez mettre en place, ou que vous utilisez déjà")}
      <p class="counter" aria-live="polite"><span><b>${n}</b> cas sélectionné${n > 1 ? "s" : ""}</span></p>
      ${body}
      <div class="field mt-l"><label for="f-free_text">Une tâche qui vous coûte du temps et qui n'est pas dans la liste ? <span class="muted small">(facultatif)</span></label>
      <textarea id="f-free_text" data-field="free_text" data-key="f-free_text" maxlength="280">${esc(st.a.free_text)}</textarea></div>
      ${nav(n ? "Suivant" : "Passer cette étape")}`;
  }

  /* ---------- Priorité ---------- */
  function viewPriority() {
    const list = wanted();
    const rows = list.map((code) => {
      const c = st.ref.cases[code], p = st.a.cases[code].priority;
      return `<div class="row prio"><h3 id="pr-${code}">${esc(c.label)}</h3>
        <div class="stars" role="radiogroup" aria-labelledby="pr-${code}">${[1, 2, 3, 4, 5].map((i) => `<button type="button" role="radio" class="${p >= i ? "on" : ""}" aria-checked="${p === i}" aria-label="${i} sur 5" data-action="star" data-code="${code}" data-n="${i}" data-key="st-${code}-${i}">${icon(p >= i ? "starFill" : "star")}</button>`).join("")}
        <span class="val">${p ? `${p}/5` : "–"}</span></div></div>`;
    }).join("");
    return `${head("Priorisez vos cas d'usage", "Donnez une note de 1 (faible) à 5 (fort) selon le bénéfice attendu")}<section class="card group">${rows}</section>
      <p class="muted small">Sans note, un cas compte pour 3.</p>${nav("Suivant")}`;
  }

  /* ---------- Feuille de route ---------- */
  function viewRoadmap() {
    const r = st.result || SC.compute(st.ref, payloadClean());
    const ref = st.ref;
    const banner = st.sending ? `<p class="notice">Enregistrement de votre diagnostic…</p>`
      : st.pending ? `<div class="notice warn"><p>Votre diagnostic n'a pas pu être envoyé (connexion). Il est gardé sur cet appareil.</p><button type="button" class="btn ghost block" data-action="retry">${icon("refresh")}Réessayer l'envoi</button></div>` : "";
    const axes = r.axes.map((a) => `<section class="card"><div class="roadmap-axis"><span class="art">${stage(a.n)}</span><div><p class="micro kicker accent">${esc(a.label)}</p><b>${esc(a.niveau)}, niveau\u00a0${a.n}</b><br><span class="muted small">${esc(a.titre)}</span></div></div><ol class="steps">${a.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></section>`).join("");
    const byType = Object.keys(ref.types).filter((t) => r.par_type[t].length).map((t) => `<section class="card"><h3 class="card-title">Vos cas d'usage <span class="type ${t}">${esc(ref.types[t].label)}</span></h3>
      <table class="cases-table"><thead><tr><th scope="col">Cas d'usage</th><th scope="col">Effort</th></tr></thead><tbody>${r.par_type[t].map((n) => {
        const c = r.cases[n - 1];
        return `<tr><td>${n}. ${esc(c.label)}${c.ajuste ? `<span class="adj">Effort relevé : vos données sont à structurer d'abord.</span>` : ""}${c.note_tpe ? `<span class="adj">${esc(c.note_tpe)}</span>` : ""}</td><td>${gauge(c.effort)}</td></tr>`;
      }).join("")}</tbody></table></section>`).join("");
    const legend = r.cases.map((c) => `<li><span class="num">${c.num}.</span><span class="lbl">${esc(c.label)}<span class="meta"><span class="type ${c.type}">${esc(ref.types[c.type].label)}</span><span class="ep">Effort ${c.effort} · Priorité ${c.priority}</span></span></span></li>`).join("");
    const quads = ref.quadrants.filter((q) => r.quadrants[q.code].length).map((q) => `<h3>${esc(q.label)}</h3><p class="muted small tight">${esc(q.description)}</p><ul>${r.quadrants[q.code].map((n) => `<li>${esc(r.cases[n - 1].label)}</li>`).join("")}</ul>`).join("");
    const matrix = r.cases.length ? `${head2("Matrice de priorisation", "Vos cas d'usage croisés : effort de mise en œuvre et priorité")}
      <section class="card matrix-card"><div class="matrix">${U.matrix(r.matrix)}</div>
      <div class="legend-types">${Object.keys(ref.types).map((t) => `<span class="type ${t}">${esc(ref.types[t].label)}</span>`).join("")}</div>
      <ol class="legend-list" aria-label="Légende de la matrice">${legend}</ol></section>
      <section class="card quad-list">${quads}</section>` : `<section class="card"><p>Vous n'avez pas choisi de cas d'usage à mettre en place : la feuille de route se concentre sur vos prochaines étapes.</p></section>`;
    const acquis = r.acquis.length ? `<section class="card"><h3 class="card-title">Déjà en place</h3>${r.acquis.map((c) => `<span class="tag">${esc(c.label)}</span>`).join("")}</section>` : "";
    const vig = r.vigilances.length ? `<section class="card"><h3 class="card-title">Points de vigilance</h3><ul>${r.vigilances.map((v) => `<li>${esc(v)}</li>`).join("")}</ul></section>` : "";
    return `${head("Vos prochaines étapes", "Adaptées à votre maturité")}${banner}${axes}
      ${r.cases.length ? `${head2("Analyse de vos cas d'usage", "Par type, avec une note d'effort de mise en œuvre sur 5")}${byType}` : ""}
      ${matrix}${acquis}${vig}
      ${nav("Terminer : voir ma feuille de route", { action: "finish", disabled: st.sending })}`;
  }
  const head2 = (t, s) => `<h2 class="section-title">${U.typo(t)}</h2><p class="screen-sub">${U.typo(s)}</p>`;

  /* ---------- Fin ---------- */
  function viewEnd() {
    const r = st.result, ref = st.ref;
    const link = st.token ? `/rapport.html#${st.token}` : "";
    const offers = r ? r.offres.map((o) => `<section class="card offer"><h3>${icon("right")}${esc(o.titre)}</h3><p class="flush">${esc(o.texte)}</p></section>`).join("") : "";
    const res = r && r.ressources.length ? `<section class="card"><h3 class="card-title">Ressources</h3><ul>${r.ressources.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.titre)}</a> : ${esc(x.texte)}</li>`).join("")}</ul></section>` : "";
    return `<div class="done-mark" aria-hidden="true">${icon("check")}</div>
      <h1 class="screen-title tight-top">Merci ${esc(st.a.firstname)}\u00a0!</h1>
      <p class="screen-sub">Votre feuille de route est prête.</p>
      ${st.token ? `<p class="center">Consultez votre rapport, puis enregistrez-le en PDF.</p>
        <div class="stack"><a class="btn primary block" href="${link}">${icon("eye")}Visualiser mon rapport</a><a class="btn primary block" href="${link}&print">${icon("download")}Télécharger le PDF</a></div>
        <div class="mailbox">${icon("mail")}<div><p class="flush">Il part aussi par e-mail à <b>${esc(st.a.email)}</b>.</p>
          <button type="button" class="linkbtn" data-action="resend" data-key="resend" ${st.mailBusy ? "disabled" : ""}>Renvoyer par e-mail</button>
          <p class="small muted flush" role="status">${esc(st.mailMsg || "")}</p></div></div>
        `
        : `<div class="notice warn"><p>Votre diagnostic n'est pas encore enregistré.</p><button type="button" class="btn ghost block" data-action="retry">${icon("refresh")}Réessayer l'envoi</button></div>`}
      ${head2("Pour aller plus loin", "Ce que nous pouvons faire ensemble")}
      ${offers}
      <a class="btn ghost block" href="${esc(ref.app.rdv_url)}" target="_blank" rel="noopener">${icon("calendar")}Échanger 30 minutes</a>
      <div class="spacer"></div>${res}
      <p class="center"><button type="button" class="linkbtn" data-action="restart">Recommencer un diagnostic</button></p>`;
  }

  /* ---------- Envoi ---------- */
  function payloadClean() {
    const a = st.a;
    return {
      maillon: a.maillon, size: a.size, levels: a.levels,
      cases: a.order.filter((c) => a.cases[c]).map((c) => ({ code: c, state: a.cases[c].state, priority: a.cases[c].priority || null })),
    };
  }
  function payload() {
    const a = st.a;
    return Object.assign(payloadClean(), {
      session: st.session ? st.session.code : undefined, flow: st.flow,
      firstname: a.firstname, lastname: a.lastname, company: a.company, role: a.role, email: a.email, phone: a.phone,
      pulse: a.pulse, free_text: a.free_text, website: a.website,
      consent_processing: a.consent_processing, consent_contact: a.consent_contact, consent_partner: a.consent_partner, consent_news: a.consent_news,
      duration_s: st.startedAt ? Math.round((Date.now() - st.startedAt) / 1000) : 0,
      source: params.get("utm_source") || (st.session ? "session" : "web"),
    });
  }
  async function submit() {
    if (st.sending) return;
    st.sending = true; st.pending = st.pending || payload();
    save(); render(false);
    try {
      const out = await U.api("POST", "/api/app/diagnostics", st.pending);
      st.token = out.token; st.result = out.result; st.pending = null;
    } catch (err) {
      if (err.status === 400) {
        st.pending = null;
        st.errors = mapErrors(err.data || {});
        const where = Object.keys(st.errors).some((k) => k.indexOf("levels") === 0) ? "maturite" : Object.keys(st.errors).some((k) => k === "cases") ? "cas" : "vous";
        st.sending = false; st.step = where;
        if (where === "maturite") st.mIdx = firstMissingAxis();
        if (!Object.keys(st.errors).length) st.errors = { _global: err.message };
        save(); render(true);
        return;
      }
    }
    st.sending = false;
    save(); render(false);
  }
  function mapErrors(data) {
    const e = {};
    Object.keys(data).forEach((k) => { e[k] = String(data[k]); });
    if (Object.keys(e).some((k) => k.indexOf("levels.") === 0)) e.levels = "Choisissez un niveau pour chaque axe.";
    return e;
  }

  async function resend() {
    if (!st.token || st.mailBusy) return;
    st.mailBusy = true; st.mailMsg = "Envoi en cours…"; render(false);
    try {
      const out = await U.api("POST", `/api/app/report/${st.token}/email`);
      st.mailMsg = out.message;
    } catch (err) {
      st.mailMsg = err.status === 429 ? err.message : "Le renvoi n'a pas abouti. Réessayez dans un instant.";
    }
    st.mailBusy = false; render(false);
  }

  /* ---------- Navigation ---------- */
  function go(step) { clearTimeout(advanceTimer); st.step = step; st.errors = {}; save(); render(true); }
  function next() {
    const list = steps(), i = list.indexOf(st.step);
    if (st.step === "maturite" && st.mIdx < st.ref.axes.length) {
      if (!st.a.levels[st.ref.axes[st.mIdx].code]) return;
      clearTimeout(advanceTimer); st.mIdx += 1; save(); render(true); return;
    }
    if (st.step === "vous") {
      st.errors = checkYou();
      if (Object.keys(st.errors).length) {
        render(false);
        const first = main.querySelector('[aria-invalid="true"]') || main.querySelector(".err");
        if (first) { first.scrollIntoView({ block: "center" }); if (first.focus) first.focus(); }
        return;
      }
    }
    let target = list[i + 1];
    if (target === "priorite" && !wanted().length) target = list[i + 2];
    if (target === "roadmap") { st.step = "roadmap"; st.errors = {}; render(true); submit(); return; }
    if (target === "maturite") st.mIdx = 0;
    go(target);
  }
  function prev() {
    if (st.step === "maturite" && st.mIdx > 0) { clearTimeout(advanceTimer); st.mIdx -= 1; save(); render(true); return; }
    const list = steps(), i = list.indexOf(st.step);
    let target = list[i - 1];
    if (target === "priorite" && !wanted().length) target = list[i - 2];
    if (target === "maturite") st.mIdx = st.ref.axes.length;
    go(target || "accueil");
  }

  function onClick(e) {
    const b = e.target.closest("[data-action]");
    if (!b || !main.contains(b)) return;
    const act = b.getAttribute("data-action"), code = b.getAttribute("data-code");
    const a = st.a;
    switch (act) {
      case "start": st.startedAt = Date.now(); st.mIdx = 0; go(steps()[0]); break;
      case "resume": go(st.step === "accueil" ? steps()[0] : st.step); break;
      case "restart": {
        U.store.del(storeKey());
        const keep = st.session ? st.session.default_maillon || "" : "";
        st.a = freshAnswers(); st.a.maillon = keep; st.token = ""; st.result = null; st.pending = null; st.openFamilies = {}; st.details = {};
        st.startedAt = Date.now(); st.mIdx = 0; go(steps()[0]); break;
      }
      case "next": next(); break;
      case "prev": prev(); break;
      case "level": chooseLevel(b.getAttribute("data-axis"), Number(b.getAttribute("data-n"))); break;
      case "pulse": a.pulse = a.pulse === Number(b.getAttribute("data-n")) ? null : Number(b.getAttribute("data-n")); save(); render(false); break;
      case "family": { const f = b.getAttribute("data-family"); st.openFamilies[f] = !st.openFamilies[f]; render(false); break; }
      case "case":
        if (a.cases[code]) { delete a.cases[code]; a.order = a.order.filter((c) => c !== code); }
        else { a.cases[code] = { state: "veut", priority: null }; a.order.push(code); }
        save(); render(false); break;
      case "state": a.cases[code].state = b.getAttribute("data-state"); save(); render(false); break;
      case "detail": st.details[code] = !st.details[code]; render(false); break;
      case "star": { const n = Number(b.getAttribute("data-n")); a.cases[code].priority = a.cases[code].priority === n ? null : n; save(); render(false); break; }
      case "finish": if (!st.sending) go("fin"); break;
      case "retry": st.pending = st.pending || payload(); submit(); break;
      case "resend": resend(); break;
    }
  }

  function onInput(e) {
    const el = e.target, name = el.getAttribute && el.getAttribute("data-field");
    if (!name) return;
    if (el.type === "checkbox") st.a[name] = el.checked;
    else st.a[name] = el.value;
    if (name === "maillon" || name === "role") {
      // Un changement de maillon change le catalogue : on retire les cas qui n'en font plus partie.
      const allowed = SC.allowedCodes(st.ref, st.a.maillon, st.flow);
      st.a.order = st.a.order.filter((c) => allowed[c]);
      Object.keys(st.a.cases).forEach((c) => { if (!allowed[c]) delete st.a.cases[c]; });
      st.openFamilies = {};
    }
    if (st.errors[name]) {
      // On retire l'erreur sur place, sans tout redessiner : le focus reste où l'utilisateur l'a mis.
      delete st.errors[name];
      el.removeAttribute("aria-invalid");
      const box = el.closest(".field, .consent");
      const err = box && box.querySelector(".err");
      if (err) err.remove();
    }
    save();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
