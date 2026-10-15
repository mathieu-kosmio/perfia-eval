/**
 * PerfIA Diagnostic IA : vue salle (salle.html#<code>:<clé animateur>), à projeter ou partager en visio.
 * Interroge toutes les 5 secondes les agrégats anonymes de la session. La clé passe dans un en-tête, jamais dans
 * l'adresse envoyée au serveur. Rien ne s'affiche sous 3 réponses.
 */
(function () {
  "use strict";
  const U = window.PerfiaUI, { esc } = U;
  const main = document.getElementById("main");
  let code = "", key = "", timer = null, lastOk = 0, ref = null, sessionInfo = null;

  function parseHash() {
    const h = decodeURIComponent(location.hash.replace(/^#/, ""));
    const i = h.indexOf(":");
    code = (i > 0 ? h.slice(0, i) : h).trim().toLowerCase();
    key = i > 0 ? h.slice(i + 1).trim() : "";
  }

  function accessForm(msg) {
    clearInterval(timer);
    main.innerHTML = `<form class="access card" id="acc"><h1 style="font-size:24px;margin:0 0 12px">Vue salle</h1>
      ${msg ? `<p class="notice warn">${esc(msg)}</p>` : ""}
      <div class="field"><label for="c">Code de la session</label><input id="c" value="${esc(code)}" autocomplete="off" required></div>
      <div class="field"><label for="k">Clé animateur</label><input id="k" value="${esc(key)}" autocomplete="off" required></div>
      <button class="btn primary block">Ouvrir la vue salle</button>
      <p class="small muted" style="margin-top:12px">Le code et la clé figurent sur la page Équipe.</p></form>`;
    document.getElementById("acc").addEventListener("submit", (e) => {
      e.preventDefault();
      location.hash = `${document.getElementById("c").value.trim()}:${document.getElementById("k").value.trim()}`;
    });
  }

  async function poll() {
    try {
      const data = await U.api("GET", `/api/app/sessions/${encodeURIComponent(code)}/live`, undefined, { "X-Presenter-Key": key });
      lastOk = Date.now();
      if (!sessionInfo) { sessionInfo = data.session; document.getElementById("brand").innerHTML = U.brandbar(sessionInfo); }
      draw(data);
    } catch (err) {
      if (err.status === 404) return accessForm("Code de session ou clé animateur incorrects.");
      const m = document.getElementById("meta");
      if (m) m.textContent = "Connexion perdue, nouvel essai dans 5 secondes…";
    }
  }

  function joinBlock(n) {
    const url = `${location.origin}/s/${code}`;
    return `<section class="card join"><p class="micro muted" style="margin:0">Diagnostic IA en direct</p><h1>${esc(sessionInfo.title)}</h1>
      <div class="qr">${U.qr(url, 8)}</div><p class="url">${esc(url.replace(/^https?:\/\//, ""))}</p>
      <p class="big" aria-live="polite">${n}</p><p class="muted" style="margin:0">réponse${n > 1 ? "s" : ""}</p></section>`;
  }

  function draw(data) {
    const s = data.stats, base = (data.session && data.session.baseline) || {};
    if (!s.ready) {
      main.innerHTML = `<div class="room">${joinBlock(s.n)}<section class="card waiting"><h2 style="font-size:30px">Scannez le QR code pour commencer</h2>
        <p class="muted" style="font-size:20px">Les résultats de la salle s'affichent dès ${s.seuil} réponses (${s.n} / ${s.seuil}).</p><p id="meta" class="meta"></p></section></div>`;
      return;
    }
    // Ordre du référentiel : le JSON du serveur trie les clés par ordre alphabétique.
    const axes = ref.axes.map((ax) => ax.code).filter((k) => s.axes[k]).map((k) => {
      const a = s.axes[k], max = Math.max.apply(null, a.dist.concat([1]));
      const bl = k === "ia" && base.usage_ia ? `<p class="base">${esc(base.label || "Référence")} : <b>${String(base.usage_ia).replace(".", ",")}</b> / 5</p>` : "";
      return `<section class="card stat"><h2>${esc(a.label)}</h2><p class="mean">${String(a.mean).replace(".", ",")} <small>/ 5</small></p>
        <div class="bars" role="img" aria-label="Répartition des niveaux 1 à 5 : ${a.dist.join(", ")}">${a.dist.map((v) => `<div style="height:${Math.round((v / max) * 100)}%"><span>${v}</span></div>`).join("")}</div>
        <div class="bars-x">${ref.niveaux.map((nv) => `<span>${esc(nv.nom)}</span>`).join("")}</div>${bl}</section>`;
    }).join("");
    const pulse = s.pulse.mean ? `<section class="card stat"><h2>Question éclair</h2><p class="small muted" style="margin:0 0 6px">${esc(data.pulse_question)}</p>
      <p class="mean">${String(s.pulse.mean).replace(".", ",")} <small>/ 5 · ${s.pulse.n} réponse${s.pulse.n > 1 ? "s" : ""}</small></p>
      ${base.clarte ? `<p class="base">${esc(base.label || "Référence")} : <b>${String(base.clarte).replace(".", ",")}</b> / 5</p>` : ""}</section>` : "";
    const maxc = s.top.length ? s.top[0].count : 1;
    const top = s.top.map((t, i) => `<li><span class="n">${i + 1}.</span><span>${esc(t.label)}</span><span class="small muted">${t.count} · P ${String(t.prio_mean).replace(".", ",")}</span><span class="bar"><i style="width:${Math.round((t.count / maxc) * 100)}%;background:var(--type-${t.type})"></i></span></li>`).join("");
    const cells = s.top.map((t) => ({ effort: t.effort, priority: t.prio_mean, count: t.count, type: t.type, label: t.label }));
    main.innerHTML = `<div class="room">${joinBlock(s.n)}<div>
      <div class="grid3">${axes}${pulse}</div>
      <div class="grid3" style="margin-top:14px">
        <section class="card"><h2 style="font-size:20px;margin:0 0 14px">Cas d'usage les plus choisis</h2><ol class="top">${top}</ol></section>
        <section class="card matrix-card"><h2 style="font-size:20px;margin:0 0 6px">Matrice de la salle</h2><p class="small muted" style="margin:0 0 6px">Numéros : classement ci-contre. Taille : nombre de réponses.</p><div class="matrix">${U.matrix(cells, { aggregate: true, label: "Matrice de la salle : effort et priorité moyenne des cas les plus choisis" })}</div></section>
      </div>
      <p id="meta" class="meta"><span>Mise à jour toutes les 5 secondes · résultats anonymes</span><button type="button" class="btn ghost" id="fs" style="min-height:40px;padding:6px 12px">Plein écran</button></p>
    </div></div>`;
    const fs = document.getElementById("fs");
    if (fs && document.documentElement.requestFullscreen) fs.addEventListener("click", () => document.documentElement.requestFullscreen().catch(() => {}));
    else if (fs) fs.hidden = true;
  }

  async function start() {
    parseHash();
    if (!code || !key) return accessForm("");
    clearInterval(timer);
    sessionInfo = null;
    try { ref = await U.loadRef(); } catch (_) { return accessForm("Le référentiel ne se charge pas."); }
    await poll();
    timer = setInterval(poll, 5000);
  }

  window.addEventListener("hashchange", start);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
