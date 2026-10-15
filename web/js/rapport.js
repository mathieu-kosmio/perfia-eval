/**
 * PerfIA Diagnostic IA : rapport imprimable (rapport.html#<jeton>, ou #<jeton>&print pour ouvrir l'impression).
 * Le jeton reste dans le fragment de l'adresse : il n'est envoyé qu'à l'API du rapport, jamais dans les journaux
 * du serveur web ni dans l'en-tête Referer.
 */
(function () {
  "use strict";
  const U = window.PerfiaUI, { esc, stage, gauge } = U;
  const main = document.getElementById("main");
  const hash = location.hash.replace(/^#/, "").split("&");
  const token = hash[0], autoPrint = hash.indexOf("print") > 0;

  document.getElementById("print").addEventListener("click", () => window.print());

  async function boot() {
    if (!/^[A-Za-z0-9]{32}$/.test(token)) return fail("Ce lien de rapport n'est pas complet. Ouvrez le lien reçu par e-mail.");
    let rep, ref;
    try {
      [rep, ref] = await Promise.all([U.api("GET", `/api/app/report/${token}`), U.loadRef()]);
    } catch (err) {
      return fail(err.status === 404 ? "Ce rapport n'existe pas ou n'est plus disponible (il reste consultable 12 mois)." : "Le rapport ne se charge pas. Vérifiez votre connexion, puis rechargez la page.");
    }
    main.innerHTML = sheet(rep, ref);
    const btn = document.getElementById("resend");
    if (btn) btn.addEventListener("click", async () => {
      const msg = document.getElementById("mailmsg");
      btn.disabled = true; msg.textContent = "Envoi en cours…";
      try { msg.textContent = (await U.api("POST", `/api/app/report/${token}/email`)).message; }
      catch (err) { msg.textContent = err.status === 429 ? err.message : "Le renvoi n'a pas abouti. Réessayez dans un instant."; btn.disabled = false; }
    });
    document.title = `Feuille de route IA · ${rep.firstname} ${rep.lastname}`.trim();
    if (autoPrint) setTimeout(() => window.print(), 400);
  }

  function fail(msg) { main.innerHTML = `<div class="state"><p class="notice warn">${esc(msg)}</p><a class="btn ghost" href="/">Faire le diagnostic</a></div>`; }

  function sheet(rep, ref) {
    const r = rep.result || { axes: [], cases: [], acquis: [], par_type: {}, matrix: [], quadrants: {}, offres: [], ressources: [], vigilances: [] };
    const s = rep.session;
    const org = s && s.organizer_logo ? `<span aria-hidden="true">✕</span><img class="org" src="${esc(s.organizer_logo)}" alt="${esc(s.organizer_name || "")}">` : "";
    const who = [["Prénom", rep.firstname], ["Nom", rep.lastname], ["Entreprise", rep.company], ["Fonction", rep.role], ["Maillon", rep.maillon]]
      .filter((x) => x[1]).map((x) => `<dt>${x[0]}</dt><dd>${esc(x[1])}</dd>`).join("");
    const axes = r.axes.map((a) => `<div class="axisbox"><div class="h"><span class="art">${stage(a.n)}</span><div><b>${esc(a.label)}</b> <em>· ${esc(a.niveau)}, niveau\u00a0${a.n}</em><br><span class="small muted">${esc(a.titre)}</span></div></div><ol>${a.steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>`).join("");
    const legend = r.cases.map((c) => `<li><span class="dot" style="background:var(--type-${c.type})"></span><span><b>${c.num}.</b> ${esc(c.label)}</span><span class="ep">E${c.effort}/P${c.priority}</span></li>`).join("");
    const tables = Object.keys(ref.types).filter((t) => (r.par_type[t] || []).length).map((t) => `<div class="tbl"><h3>Vos cas d'usage ${esc(ref.types[t].label)}</h3><table><thead><tr><th scope="col">Cas d'usage</th><th scope="col">Niveau d'effort</th></tr></thead><tbody>${r.par_type[t].map((n) => {
      const c = r.cases[n - 1];
      return `<tr><td>${n}. ${esc(c.label)}${c.ajuste ? '<span class="adj">Effort relevé : vos données sont à structurer d\'abord.</span>' : ""}<span class="adj">Vigilance : ${esc(c.vigilance)}</span></td><td>${gauge(c.effort)}</td></tr>`;
    }).join("")}</tbody></table></div>`).join("");
    const quads = ref.quadrants.filter((q) => (r.quadrants[q.code] || []).length).map((q) => `<p><b>${esc(q.label)}</b> : ${r.quadrants[q.code].map((n) => esc(r.cases[n - 1].label)).join(" ; ")}</p>`).join("");
    const offers = r.offres.map((o) => `<div class="offer2"><b>${esc(o.titre)}</b>${esc(o.texte)}</div>`).join("");
    const res = r.ressources.map((x) => `<li><a href="${esc(x.url)}">${esc(x.titre)}</a> : ${esc(x.texte)}</li>`).join("");
    return `<article class="sheet">
      <header class="sheet-head">
        <div class="logos"><img class="perfia" src="/assets/logos/perfia-sombre.svg" alt="PerfIA"><div class="row"><img src="/assets/logos/logo-kosmio.svg" alt="Kosmio"><span aria-hidden="true">✕</span><img class="xylo" src="/assets/logos/xylofutur.png" alt="Xylofutur">${org}</div></div>
        <div><h1>Feuille de route IA</h1><p class="date">${esc(U.fmtDate(rep.created))}${s ? `<br>${esc(s.title)}` : ""}</p></div>
      </header>
      ${rep.email_masked ? `<p class="mailline no-print">Envoyée à ${esc(rep.email_masked)}${rep.can_resend ? ' · <button type="button" class="linkbtn" id="resend">Renvoyer par e-mail</button>' : ""} <span id="mailmsg" role="status" class="muted"></span></p>` : ""}
      <section class="sec"><h2>Informations participant</h2><dl class="who">${who}</dl></section>
      <section class="sec"><h2>Vos prochaines étapes</h2>${axes}</section>
      ${r.cases.length ? `<section class="sec"><h2>Analyse de vos cas d'usage</h2>
        <div class="matrix-wrap">${U.matrix(r.matrix)}</div>
        <p class="small muted" style="text-align:center;margin:4px 0 0">Effort de mise en œuvre (E) et priorité (P), de 1 à 5. Couleur : <span style="color:var(--type-ia)">IA</span>, <span style="color:var(--type-automatisation)">Automatisation</span>, <span style="color:var(--type-donnees)">Données</span>.</p>
        <ol class="legend2">${legend}</ol>
        <div style="margin-top:14px">${quads}</div>
        <div style="margin-top:14px">${tables}</div></section>` : ""}
      ${r.acquis.length ? `<section class="sec"><h2>Déjà en place</h2><p>${r.acquis.map((c) => esc(c.label)).join(" ; ")}</p></section>` : ""}
      ${r.vigilances.length ? `<section class="sec"><h2>Points de vigilance</h2><ul>${r.vigilances.map((v) => `<li>${esc(v)}</li>`).join("")}</ul></section>` : ""}
      <section class="sec"><h2>Pour aller plus loin</h2>${offers}
        <p><a href="${esc(ref.app.rdv_url)}">Échanger 30 minutes avec nous</a> · ${esc(ref.app.contact)}</p>
        ${res ? `<ul>${res}</ul>` : ""}</section>
      <footer class="sheet-foot">${esc(ref.app.coedition)}<br>Feuille de route établie à partir de vos réponses déclaratives · référentiel ${esc(rep.referentiel_version)}</footer>
    </article>`;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
