/**
 * PerfIA Diagnostic IA : page de l'équipe (equipe.html). Connexion d'un compte d'équipe (créé dans la console),
 * sessions (création, liens, QR code, ouverture et fermeture), diagnostics de la session (suivi des prospects),
 * export CSV, clé MCP pour un agent IA. Le jeton de connexion reste dans l'onglet (sessionStorage).
 */
(function () {
  "use strict";
  const U = window.PerfiaUI, { esc } = U;
  const main = document.getElementById("main");
  const TK = "perfia-equipe";
  let auth = null, ref = null, sessions = [], current = null, diags = [], editing = null, msg = "";

  const parse = (s) => { const t = Date.parse(String(s || "").replace(" ", "T")); return isNaN(t) ? null : new Date(t); };
  const fmtDateTime = (s) => { const d = parse(s); return d ? d.toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""; };
  // Champ datetime-local : heure locale du navigateur, sans fuseau.
  const toLocalInput = (s) => { const d = parse(s); return d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""; };

  const tokenGet = () => { try { return JSON.parse(sessionStorage.getItem(TK) || "null"); } catch (_) { return null; } };
  const tokenSet = (v) => { try { v ? sessionStorage.setItem(TK, JSON.stringify(v)) : sessionStorage.removeItem(TK); } catch (_) {} };
  const authed = (method, path, body) => U.api(method, path, body, { Authorization: auth.token });

  async function boot() {
    try { ref = await U.loadRef(); } catch (_) { main.innerHTML = '<p class="notice warn">Le référentiel ne se charge pas.</p>'; return; }
    auth = tokenGet();
    document.getElementById("logout").addEventListener("click", () => { tokenSet(null); auth = null; document.getElementById("logout").hidden = true; login(); });
    main.addEventListener("click", onClick);
    main.addEventListener("change", onChange);
    if (!auth) return login();
    try { await authed("POST", "/api/collections/users/auth-refresh").then((r) => { auth.token = r.token; tokenSet(auth); }); }
    catch (_) { tokenSet(null); auth = null; return login("Votre connexion a expiré."); }
    document.getElementById("logout").hidden = false;
    await loadSessions();
    route();
  }

  function login(err) {
    main.innerHTML = `<form class="card" id="login" style="max-width:420px;margin:30px auto"><h1>Connexion de l'équipe</h1>
      ${err ? `<p class="notice warn">${esc(err)}</p>` : ""}
      <div class="field"><label for="em">E-mail</label><input id="em" type="email" autocomplete="username" required></div>
      <div class="field"><label for="pw">Mot de passe</label><input id="pw" type="password" autocomplete="current-password" required></div>
      <button class="btn primary block">Se connecter</button>
      <p class="small muted" style="margin-top:12px">Les comptes d'équipe se créent dans la console d'administration (/_/), collection users.</p></form>`;
    document.getElementById("login").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const r = await U.api("POST", "/api/collections/users/auth-with-password", { identity: document.getElementById("em").value.trim(), password: document.getElementById("pw").value });
        auth = { token: r.token, name: r.record.name }; tokenSet(auth);
        document.getElementById("logout").hidden = false;
        await loadSessions(); route();
      } catch (_) { login("Identifiants incorrects, ou adresse non vérifiée."); }
    });
  }

  async function loadSessions() { sessions = (await authed("GET", "/api/app/staff/sessions")).items; }
  async function loadDiags() {
    const r = await authed("GET", `/api/collections/diagnostics/records?perPage=500&sort=-created&filter=${encodeURIComponent(`session = "${current.id}"`)}`);
    diags = r.items;
  }

  function route() {
    const code = location.hash.replace(/^#/, "");
    current = sessions.find((s) => s.code === code) || null;
    if (current) loadDiags().then(render, () => render()); else render();
  }
  window.addEventListener("hashchange", () => { if (auth) { msg = ""; editing = null; route(); } });

  /* ---------- Vues ---------- */
  function render() {
    main.innerHTML = (msg ? `<p class="notice">${esc(msg)}</p>` : "") + (editing ? viewForm() : current ? viewSession() : viewList());
  }

  function viewList() {
    const rows = sessions.map((s) => `<tr><td><a href="#${esc(s.code)}"><b>${esc(s.code)}</b></a></td><td>${esc(s.title)}</td><td>${esc(U.fmtDate(s.date))}</td><td><span class="status ${s.status}">${esc(s.status)}</span></td><td>${s.diagnostics}</td></tr>`).join("");
    return `<div class="row" style="justify-content:space-between"><h1>Sessions</h1><div class="row"><button type="button" class="btn primary sm" data-act="new">Nouvelle session</button><button type="button" class="btn ghost sm" data-act="export" data-code="">Exporter tout (CSV)</button></div></div>
      <section class="card scroll">${sessions.length ? `<table class="list"><thead><tr><th>Code</th><th>Titre</th><th>Date</th><th>Statut</th><th>Diagnostics</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="muted">Aucune session pour l\'instant.</p>'}</section>
      <section class="card"><h2>Lien sans session</h2><p>Pour un usage hors intervention (site, e-mail, réseau) : <code>${esc(location.origin)}/</code>. Version courte : <code>${esc(location.origin)}/?v=court</code>.</p></section>
      <section class="card" id="mcp"><h2>Connecter un agent IA</h2><p class="small muted">Une clé personnelle, valable 30 jours, permet à Claude ou à un autre agent de lire les sessions et les diagnostics et de mettre à jour le suivi (serveur MCP : <code>${esc(location.origin)}/mcp</code>).</p>
        <button type="button" class="btn ghost sm" data-act="key">Générer une clé</button><div id="keyout"></div></section>`;
  }

  function viewSession() {
    const s = current, part = `${location.origin}/s/${s.code}`, room = `${location.origin}/salle.html#${s.code}:${s.presenter_key}`;
    const lab = (list, c) => { const x = list.find((i) => i.code === c); return x ? x.label : c || "—"; };
    const rows = diags.map((d) => `<tr>
      <td>${esc(U.fmtDate(d.created))}</td>
      <td><b>${esc([d.firstname, d.lastname].filter(Boolean).join(" ") || "(anonymisé)")}</b><br><span class="small muted">${esc(lab(ref.fonctions, d.role))}</span></td>
      <td>${esc(d.company)}<br><span class="small muted">${esc(d.email)}${d.phone ? ` · ${esc(d.phone)}` : ""}</span></td>
      <td>${esc(lab(ref.maillons, d.maillon))}</td>
      <td>IA ${d.levels ? d.levels.ia : "?"} · D ${d.levels ? d.levels.donnees : "?"} · C ${d.levels ? d.levels.cadre : "?"}</td>
      <td>${((d.result || {}).cases || []).length}</td>
      <td>${d.consent_contact ? "oui" : "non"}${d.consent_partner ? "<br><span class=\"small muted\">partage</span>" : ""}${d.followup_sent_at ? "<br><span class=\"small muted\">relancé</span>" : ""}</td>
      <td><select data-diag="${d.id}" aria-label="Suivi">${["nouveau", "contacte", "qualifie", "converti", "perdu"].map((v) => `<option value="${v}" ${d.lead_status === v ? "selected" : ""}>${v}</option>`).join("")}</select></td></tr>`).join("");
    return `<p><a href="#">← Toutes les sessions</a></p>
      <div class="row" style="justify-content:space-between"><h1>${esc(s.title)} <span class="status ${s.status}">${esc(s.status)}</span></h1>
      <div class="row"><button type="button" class="btn ghost sm" data-act="edit">Modifier</button>
      ${s.status !== "ouverte" ? '<button type="button" class="btn primary sm" data-act="status" data-v="ouverte">Ouvrir la session</button>' : '<button type="button" class="btn ghost sm" data-act="status" data-v="fermee">Fermer la session</button>'}</div></div>
      <section class="card"><div class="links"><div class="qr">${U.qr(part, 6)}</div><div>
        <p><b>Lien participants</b> (QR code ci-contre)<br><code>${esc(part)}</code> <button type="button" class="linkbtn" data-act="copy" data-v="${esc(part)}">Copier</button></p>
        <p><b>Vue salle</b> (à projeter ; contient la clé animateur, ne pas diffuser)<br><a class="btn ghost sm" href="${esc(room)}" target="_blank" rel="noopener">Ouvrir la vue salle</a> <button type="button" class="linkbtn" data-act="copy" data-v="${esc(room)}">Copier le lien</button></p>
        <p class="small muted">Version ${esc(s.flow)} · identité ${s.identity_position === "fin" ? "en fin de parcours" : "en début"} · maillon par défaut : ${esc(lab(ref.maillons, s.default_maillon))}${s.status !== "ouverte" ? " · <b>la session doit être ouverte pour recevoir des réponses</b>" : ""}</p>
      </div></div></section>
      ${viewFollowup(s)}
      <section class="card scroll"><div class="row" style="justify-content:space-between"><h2>${diags.length} diagnostic${diags.length > 1 ? "s" : ""}</h2><div class="row"><button type="button" class="btn ghost sm" data-act="reload">Actualiser</button><button type="button" class="btn primary sm" data-act="export" data-code="${esc(s.code)}">Exporter (CSV)</button></div></div>
      ${diags.length ? `<table class="list"><thead><tr><th>Date</th><th>Participant</th><th>Entreprise</th><th>Maillon</th><th>Niveaux</th><th>Cas</th><th>Recontact</th><th>Suivi</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="muted">Aucune réponse pour l\'instant.</p>'}</section>`;
  }

  /** Relance après la session : état, destinataires à ce jour, aperçu du message à la demande. */
  function viewFollowup(s) {
    const waiting = diags.filter((d) => d.consent_contact && d.email && !d.followup_sent_at).length;
    let state;
    if (s.followup !== "auto") state = "Pas de relance pour cette session. Modifiez la session pour l'activer.";
    else if (s.followup_done_at) state = `Relance envoyée le ${esc(fmtDateTime(s.followup_done_at))} à ${s.followup_sent} participant${s.followup_sent > 1 ? "s" : ""}.`;
    else if (s.followup_scheduled) state = `Relance automatique prévue le <b>${esc(fmtDateTime(s.followup_scheduled))}</b>, pour les participants qui ont accepté d'être recontactés : ${waiting} à ce jour.`;
    else state = "Relance automatique : donnez une date à la session pour la programmer.";
    return `<section class="card" id="followup"><h2>Relance après la session</h2><p>${state}</p>
      <p class="small muted">Le message remercie, rappelle la feuille de route et les cas à tester, donne les résultats anonymes de la salle (à partir de 3 réponses) et propose la suite. Les réponses arrivent à ${esc(ref.app.contact)}.</p>
      <button type="button" class="btn ghost sm" data-act="followup">Aperçu du message</button><div id="fuout"></div></section>`;
  }

  async function showFollowup() {
    const out = document.getElementById("fuout");
    out.innerHTML = '<p class="small muted">Chargement…</p>';
    try {
      const r = await authed("GET", `/api/app/staff/sessions/${encodeURIComponent(current.code)}/followup`);
      const pl = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;
      const parts = [];
      if (!r.done_at) parts.push(`${pl(r.recipients, "destinataire")} à ce jour`);
      parts.push(`${pl(r.responses, "réponse")} prise${r.responses > 1 ? "s" : ""} en compte${r.stats_ready ? "" : " : les résultats de la salle n'apparaissent qu'à partir de 3"}`);
      parts.push(r.sample === "fictif" ? "aperçu pour un participant fictif" : r.done_at ? "message reçu par le premier destinataire" : "aperçu pour le premier destinataire");
      out.innerHTML = `<p style="margin-top:12px"><b>Objet :</b> ${esc(r.subject)}</p>
        <p class="small muted">${parts.join(" · ")}.</p>
        <iframe title="Aperçu de la relance" sandbox="" style="width:100%;height:720px;border:1px solid var(--line);border-radius:8px"></iframe>`;
      out.querySelector("iframe").srcdoc = r.html;
    } catch (_) { out.innerHTML = '<p class="notice warn">Aperçu indisponible.</p>'; }
  }

  function viewForm() {
    const s = editing === "new" ? { flow: "complet", identity_position: "debut", status: "brouillon", baseline: null, followup: "auto" } : current;
    const b = s.baseline || {};
    const opt = (list, v) => list.map((o) => `<option value="${esc(o[0])}" ${v === o[0] ? "selected" : ""}>${esc(o[1])}</option>`).join("");
    return `<p><a href="#${editing === "new" ? "" : esc(current.code)}" data-act="cancel">← Annuler</a></p><h1>${editing === "new" ? "Nouvelle session" : "Modifier la session"}</h1>
      <form class="card" id="sf"><div class="grid2">
        <div class="field"><label for="s-code">Code court (lien /s/code)</label><input id="s-code" name="code" value="${esc(s.code || "")}" pattern="[a-z0-9][a-z0-9\\-]{1,23}" required ${editing === "new" ? "" : "readonly"}><p class="hint">Minuscules, chiffres et tirets, ex. « ibc-1610 ».</p></div>
        <div class="field"><label for="s-title">Titre</label><input id="s-title" name="title" value="${esc(s.title || "")}" required></div>
        <div class="field"><label for="s-date">Date</label><input id="s-date" name="date" type="date" value="${esc(String(s.date || "").slice(0, 10))}"></div>
        <div class="field"><label for="s-org">Organisateur</label><input id="s-org" name="organizer_name" value="${esc(s.organizer_name || "")}"></div>
        <div class="field"><label for="s-logo">Logo de l'organisateur (PNG, JPEG, WebP, 300 Ko)</label><input id="s-logo" name="organizer_logo" type="file" accept="image/png,image/jpeg,image/webp"></div>
        <div class="field"><label for="s-m">Maillon par défaut</label><select id="s-m" name="default_maillon"><option value="">Aucun</option>${opt(ref.maillons.map((m) => [m.code, m.label]), s.default_maillon)}</select></div>
        <div class="field"><label for="s-flow">Version</label><select id="s-flow" name="flow">${opt([["complet", "Complète (5 à 7 min)"], ["court", "Courte (3 min)"]], s.flow)}</select></div>
        <div class="field"><label for="s-id">Identité</label><select id="s-id" name="identity_position">${opt([["debut", "Au début (en salle)"], ["fin", "À la fin (lien en ligne)"]], s.identity_position)}</select></div>
        <div class="field"><label for="s-st">Statut</label><select id="s-st" name="status">${opt([["brouillon", "Brouillon"], ["ouverte", "Ouverte"], ["fermee", "Fermée"]], s.status)}</select></div>
        <div class="field"><label for="s-pq">Question éclair</label><input id="s-pq" name="pulse_question" value="${esc(s.pulse_question || "")}" placeholder="${esc(ref.pulse_default)}"><p class="hint">Vide : la question par défaut.</p></div>
        <div class="field"><label for="s-pc">Consentement de partage avec l'organisateur</label><input id="s-pc" name="partner_consent_label" value="${esc(s.partner_consent_label || "")}" placeholder="J'accepte que mes réponses soient transmises à …"><p class="hint">Vide : pas de partage proposé.</p></div>
        <div class="field"><label for="s-bl">Mesure de référence (libellé)</label><input id="s-bl" name="bl_label" value="${esc(b.label || "")}" placeholder="Atelier IBC 25/09"></div>
        <div class="field"><label for="s-bu">Référence usage IA (sur 5)</label><input id="s-bu" name="bl_usage" type="number" step="0.1" min="1" max="5" value="${esc(b.usage_ia || "")}"></div>
        <div class="field"><label for="s-bc">Référence question éclair (sur 5)</label><input id="s-bc" name="bl_clarte" type="number" step="0.1" min="1" max="5" value="${esc(b.clarte || "")}"></div>
        <div class="field"><label for="s-fu">Relance après la session</label><select id="s-fu" name="followup">${opt([["auto", "Automatique"], ["aucune", "Aucune"]], s.followup || "aucune")}</select><p class="hint">Aux participants qui ont accepté d'être recontactés.</p></div>
        <div class="field"><label for="s-fat">Envoi de la relance</label><input id="s-fat" name="followup_at" type="datetime-local" value="${esc(toLocalInput(s.followup_at))}"><p class="hint">Vide : le lendemain de la session, à la même heure.</p></div>
      </div>
      <div class="field"><label for="s-fm">Mot d'ouverture de la relance (facultatif)</label><textarea id="s-fm" name="followup_message" maxlength="1500" aria-describedby="s-fm-h">${esc(s.followup_message || "")}</textarea><p class="hint" id="s-fm-h">Un ou deux paragraphes à votre nom, placés après le remerciement : l'ambiance de la séance, ce que vous en retenez. Une ligne vide sépare deux paragraphes.</p></div>
      <div class="field"><label for="s-notes">Notes internes</label><textarea id="s-notes" name="notes">${esc(s.notes || "")}</textarea></div>
      <p class="notice warn" id="ferr" hidden></p>
      <button class="btn primary">${editing === "new" ? "Créer la session" : "Enregistrer"}</button></form>`;
  }

  /* ---------- Actions ---------- */
  async function saveForm(form) {
    const fd = new FormData(form), out = new FormData();
    ["title", "date", "organizer_name", "default_maillon", "flow", "identity_position", "status", "pulse_question", "partner_consent_label", "notes", "followup", "followup_message"].forEach((k) => out.append(k, fd.get(k) || ""));
    if (editing === "new") out.append("code", String(fd.get("code") || "").trim().toLowerCase());
    if (out.get("date")) out.set("date", `${out.get("date")} 09:00:00.000Z`);
    const fat = fd.get("followup_at");
    out.append("followup_at", fat ? new Date(String(fat)).toISOString().replace("T", " ") : "");
    const bl = {};
    if (fd.get("bl_label")) bl.label = String(fd.get("bl_label"));
    if (fd.get("bl_usage")) bl.usage_ia = Number(fd.get("bl_usage"));
    if (fd.get("bl_clarte")) bl.clarte = Number(fd.get("bl_clarte"));
    out.append("baseline", Object.keys(bl).length ? JSON.stringify(bl) : "null");
    const logo = fd.get("organizer_logo");
    if (logo && logo.size) out.append("organizer_logo", logo);
    const url = editing === "new" ? "/api/collections/sessions/records" : `/api/collections/sessions/records/${current.id}`;
    const res = await fetch(url, { method: editing === "new" ? "POST" : "PATCH", headers: { Authorization: auth.token }, body: out });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const first = data.data && Object.keys(data.data)[0];
      const e = document.getElementById("ferr");
      e.textContent = (data.message || "Enregistrement impossible.") + (first ? ` (${first} : ${data.data[first].message})` : "");
      e.hidden = false;
      return;
    }
    const code = data.code;
    editing = null; msg = "Session enregistrée.";
    await loadSessions();
    if (location.hash === `#${code}`) route(); else location.hash = code;
  }

  async function onClick(e) {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.getAttribute("data-act");
    if (act === "new") { editing = "new"; msg = ""; render(); main.querySelector("#sf").addEventListener("submit", (ev) => { ev.preventDefault(); saveForm(ev.target); }); }
    if (act === "edit") { editing = "edit"; msg = ""; render(); main.querySelector("#sf").addEventListener("submit", (ev) => { ev.preventDefault(); saveForm(ev.target); }); }
    if (act === "cancel") { e.preventDefault(); editing = null; render(); }
    if (act === "status") {
      await authed("PATCH", `/api/collections/sessions/records/${current.id}`, { status: b.getAttribute("data-v") });
      msg = b.getAttribute("data-v") === "ouverte" ? "Session ouverte : elle accepte les réponses." : "Session fermée.";
      await loadSessions(); route();
    }
    if (act === "reload") { await loadDiags(); render(); }
    if (act === "followup") await showFollowup();
    if (act === "copy") { try { await navigator.clipboard.writeText(b.getAttribute("data-v")); b.textContent = "Copié"; } catch (_) { window.prompt("Copiez le lien :", b.getAttribute("data-v")); } }
    if (act === "export") {
      const code = b.getAttribute("data-code");
      const res = await fetch(`/api/app/export.csv${code ? `?session=${encodeURIComponent(code)}` : ""}`, { headers: { Authorization: auth.token } });
      if (!res.ok) { msg = "Export impossible."; render(); return; }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `perfia-diagnostics-${code || "toutes"}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    if (act === "key") {
      const r = await authed("POST", "/api/app/keys", { name: "Agent IA" });
      document.getElementById("keyout").innerHTML = `<p style="margin-top:12px"><b>Votre clé (affichée une seule fois) :</b></p><p class="key">${esc(r.key)}</p>
        <p class="small">Claude Code : <code>claude mcp add --transport http perfia ${esc(location.origin)}/mcp --header "Authorization: Bearer ${esc(r.key)}"</code></p>`;
    }
  }

  async function onChange(e) {
    const id = e.target.getAttribute && e.target.getAttribute("data-diag");
    if (!id) return;
    try { await authed("PATCH", `/api/collections/diagnostics/records/${id}`, { lead_status: e.target.value }); e.target.style.outline = "2px solid var(--accent-fill)"; }
    catch (_) { e.target.style.outline = "2px solid var(--danger)"; }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
