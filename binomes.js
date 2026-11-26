/* ================= Binômes et trinômes de TP (26/11/2026) =================
   En TP, l'étudiant choisit sur le site son ou ses camarades (2 ou 3 étudiants par groupe), et chacun d'eux confirme
   sur son propre compte. Dans la fiche « … - coups de pouce » du TP, ce qu'un membre du groupe débloque (niveau 1, 2 ou 3,
   compte à rebours compris) s'ouvre aussi chez les autres, et compte pour chacun dans son profil de compétences.
   L'appli professeur n'est pas modifiée : chaque élève garde son propre enregistrement « pointsdecours/<uid>__pouce:… ».

   Firestore (règles : voir regles-binomes.txt) :
   - annuaire/<uid>          { uid, nom, classe, site }                 écrit par l'élève à la connexion, lu par son BTS
   - groupesTP/<uid>__<tp>   { uid, nom, classe, site, tp, avec[≤2], refus[], niveaux{}, attente{}, total }
                             écrit par l'élève lui-même, lu par son BTS (tp = identifiant de la fiche « pouce:… »)
   Groupe = camarades déclarés DANS LES DEUX SENS (A a choisi B et B a choisi A) : la confirmation, c'est la réciprocité. */

export const MAX_CAMARADES = 2;   // groupes de 3 au maximum

/* ---------- Logique pure (testée à part) ---------- */
export function etatGroupe(docs, moi){
  const mien = docs[moi] || {}, avec = (mien.avec || []).filter(x => x !== moi), refus = mien.refus || [];
  const reciproque = x => !!(docs[x] && (docs[x].avec || []).includes(moi));
  const membres = avec.filter(reciproque);                        // confirmés des deux côtés
  const refuse = x => !!(docs[x] && (docs[x].refus || []).includes(moi));
  const attente = avec.filter(x => !reciproque(x) && !refuse(x));  // choisis par moi, pas encore confirmés
  const refusent = avec.filter(x => !reciproque(x) && refuse(x));  // ont répondu « ce n'est pas mon groupe »
  const invitations = Object.values(docs).filter(v => v.uid !== moi && (v.avec || []).includes(moi)
    && !avec.includes(v.uid) && !refus.includes(v.uid)).map(v => v.uid);
  return { membres, attente, refusent, invitations };
}
/* Accepter l'invitation de « de » : je rejoins son groupe (lui + ceux qu'il a choisis, sans moi), 3 au maximum. */
export function rejoindre(docs, moi, de){
  const autres = ((docs[de] && docs[de].avec) || []).filter(x => x !== moi && x !== de);
  return [de, ...autres].slice(0, MAX_CAMARADES);
}
/* Niveaux du groupe : le plus haut niveau atteint par l'un des membres, question par question. */
export function fusion(...listes){
  const r = {};
  listes.forEach(n => Object.entries(n || {}).forEach(([q, v]) => { v = Math.min(3, Math.max(0, +v || 0)); if (v > (r[q] || 0)) r[q] = v; }));
  return r;
}
export function plusHaut(a, b){ return Object.entries(a || {}).some(([q, v]) => v > ((b || {})[q] || 0)); }
/* Comptes à rebours en cours chez les camarades (le plus proche de la fin), sans ceux déjà atteints. */
export function attentes(listes, niveaux, maintenant){
  const r = {};
  listes.forEach(a => Object.entries(a || {}).forEach(([q, x]) => {
    if (!x || !(x.fin > maintenant) || (niveaux[q] || 0) >= x.niv) return;
    if (!r[q] || x.niv > r[q].niv || (x.niv === r[q].niv && x.fin < r[q].fin)) r[q] = { niv: x.niv, fin: x.fin };
  }));
  return r;
}

/* ---------- Script ajouté à la fiche de coups de pouce (iframe) ----------
   Les variables de la fiche (P, N, ATT, ID, DELAI, dessine, envoie) sont globales : ce script les lit sans rien changer à la fiche.
   - envoie au site les comptes à rebours lancés ici (« pouce-attente ») ;
   - reçoit du site les niveaux et comptes à rebours du groupe (« pouce-sync ») et met la fiche à jour. */
export const SCRIPT_FICHE = `<script>(function(){
  if (window.POUCE_PROF || typeof P === "undefined" || typeof N === "undefined") return;
  var vu = JSON.stringify(ATT);
  function garde(){ try { localStorage.setItem("pouce-attente." + ID, JSON.stringify(ATT)); } catch(_) {} vu = JSON.stringify(ATT); }
  setInterval(function(){ var s = JSON.stringify(ATT); if (s !== vu) { vu = s; try { parent.postMessage({ type: "pouce-attente", attente: JSON.parse(s) }, "*"); } catch(_) {} } }, 500);
  var bandeau = document.createElement("div"); bandeau.className = "grp-band"; bandeau.style.cssText = "display:none;margin:0 0 14px;padding:10px 14px;border-radius:10px;background:#EFE7FA;color:#4B2E83;font-size:.95rem;line-height:1.4;border:1px solid #C9B4EA";
  var z = document.getElementById("z"); if (z) z.before(bandeau);
  addEventListener("message", function(e){
    if (e.source !== parent || !e.data || e.data.type !== "pouce-sync") return;
    var g = e.data, ch = false, maint = Date.now();
    if (g.noms && g.noms.length) { bandeau.style.display = "block";
      bandeau.innerHTML = "<b>Fiche partagée avec " + g.noms.join(" et ") + "</b> : un coup de pouce débloqué par l'un de vous s'ouvre pour tout le groupe."; }
    else bandeau.style.display = "none";
    P.questions.forEach(function(q){
      var k = q.cle, max = q.n.length, n = Math.min(max, +((g.niveaux || {})[k]) || 0), a = (g.attente || {})[k];
      if (n > (N[k] || 0)) { N[k] = n; if (ATT[k] && ATT[k].niv <= n) delete ATT[k]; ch = true; dessine(q, true); }
      if (a && !ATT[k] && a.niv <= max && a.niv > (N[k] || 0) && a.fin > maint) {
        if ((N[k] || 0) < a.niv - 1) N[k] = a.niv - 1;
        ATT[k] = { niv: a.niv, fin: Math.min(a.fin, maint + DELAI) }; ch = true; dessine(q);
      }
    });
    if (ch) { garde(); envoie(); }
  });
  try { parent.postMessage({ type: "pouce-pret" }, "*"); } catch(_) {}
})();<\/script>`;

/* ---------- Branchement sur le site ---------- */
export const BINOMES_CSS = `
.grp{display:block;margin-top:6px;font-size:.84rem;color:var(--ink)}
.grp .lig{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin-top:4px}
.grp .nm{font-weight:700}
.grp .ok{color:var(--ok);font-weight:700}
.grp .att{color:var(--muted);font-style:italic}
.grp button{font:inherit;font-size:.82rem;font-weight:700;border:1px solid var(--pouce);color:var(--pouce);background:var(--surface);border-radius:7px;padding:3px 9px;cursor:pointer}
.grp button.plein{background:var(--pouce);color:#fff}
.grp .inv{background:var(--pouce-soft);border-radius:8px;padding:6px 9px}
.grp-ov{position:fixed;inset:0;z-index:60;background:rgba(15,25,45,.55);display:flex;align-items:center;justify-content:center;padding:14px}
.grp-ov .bx{background:var(--surface);color:var(--ink);border-radius:14px;max-width:440px;width:100%;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.3)}
.grp-ov .hd{padding:14px 16px 8px}
.grp-ov .hd b{font-size:1.05rem;display:block}
.grp-ov .hd p{margin:6px 0 0;font-size:.88rem;color:var(--muted)}
.grp-ov .ls{overflow:auto;padding:4px 16px;flex:1}
.grp-ov label{display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--grid);cursor:pointer}
.grp-ov label input{width:18px;height:18px;accent-color:#7A4FB5}
.grp-ov details summary{cursor:pointer;padding:10px 4px;color:var(--muted);font-size:.88rem}
.grp-ov .ft{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid var(--grid);flex-wrap:wrap}
.grp-ov .ft button{font:inherit;font-weight:700;border-radius:8px;padding:8px 14px;cursor:pointer;border:1px solid var(--grid);background:var(--surface);color:var(--ink)}
.grp-ov .ft button.v{background:#7A4FB5;border-color:#7A4FB5;color:#fff}
.grp-ov .ft button[disabled]{opacity:.45;cursor:not-allowed}
.grp-ov .vide{padding:12px 4px;color:var(--muted);font-size:.9rem}`;

export function creerBinomes(ctx){
  /* ctx : { db, doc, setDoc, getDocs, collection, query, where, onSnapshot, serverTimestamp, S: () => S, MP: () => MP, esc, toast, render } */
  const { db, doc, setDoc, getDocs, collection, query, where, onSnapshot, serverTimestamp, esc, toast } = ctx;
  const S = () => ctx.S(), MP = () => ctx.MP();
  const GR = {};          // tp → { docs: {uid: doc}, unsub, c, d }
  const OUV = {};         // tp → iframe de la fiche ouverte
  let ANN = null;         // annuaire du BTS (uid → {nom, classe})

  const actif = () => { const s = S(); return !!(s && s.user && !s.prof && !s.premium && !s.demo && !s.tous && s.site); };
  const moi = () => S().user.uid;
  const estTP = d => d && d.format === "pouce" && d.type === "TP";
  const nomDe = uid => (ANN && ANN[uid] && ANN[uid].nom) || Object.values(GR).map(g => g.docs[uid] && g.docs[uid].nom).find(Boolean) || "un camarade";
  const ref = tp => doc(db, "groupesTP", moi() + "__" + tp);

  /* À la connexion : inscription dans l'annuaire du BTS (pour que les camarades puissent te choisir). */
  async function connexion(){
    if (!actif()) return;
    const s = S();
    try { await setDoc(doc(db, "annuaire", s.user.uid), { uid: s.user.uid, nom: s.nom, classe: s.groupe || "", site: s.site, maj: serverTimestamp() }); } catch(_) {}
  }
  async function annuaire(){
    if (ANN) return ANN;
    const r = {};
    try { (await getDocs(query(collection(db, "annuaire"), where("site", "==", S().site)))).forEach(x => { const v = x.data(); r[v.uid] = v; }); ANN = r; }
    catch(_) { toast("La liste de la classe n'a pas pu être chargée. Vérifie ta connexion."); return null; }
    return r;
  }

  function suivre(c, d){
    const tp = d.pouce;
    if (GR[tp]) { GR[tp].c = c; GR[tp].d = d; return GR[tp]; }
    const g = GR[tp] = { docs: {}, c, d, charge: false };
    g.unsub = onSnapshot(query(collection(db, "groupesTP"), where("site", "==", S().site), where("tp", "==", tp)), snap => {
      const docs = {}; snap.forEach(x => { const v = x.data(); docs[v.uid] = v; });
      g.docs = docs; g.charge = true;
      partager(tp); ctx.render();
    }, () => {});
    return g;
  }

  /* Ce que les camarades ont débloqué → mon enregistrement (pour mon profil et l'appli prof) + la fiche si elle est ouverte. */
  async function partager(tp){
    const g = GR[tp]; if (!g || !actif()) return;
    const { membres } = etatGroupe(g.docs, moi());
    const st = MP()[tp], mes = (st && st.niveaux) || {};
    const leurs = membres.map(u => g.docs[u].niveaux || {});
    const tout = fusion(mes, ...leurs);
    const fr = OUV[tp];
    if (fr && fr.contentWindow) fr.contentWindow.postMessage({ type: "pouce-sync", niveaux: tout,
      attente: attentes(membres.map(u => g.docs[u].attente), tout, Date.now()), noms: membres.map(nomDe) }, "*");
    if (membres.length && plusHaut(tout, mes)) {
      const s = S(), total = Math.max(+(st && st.total) || 0, ...membres.map(u => +g.docs[u].total || 0));
      const v = { uid: s.user.uid, pdc: tp, type: "pouce", corrige: g.d.lie || "", titre: g.d.titre, activite: "", site: g.c.id,
        nom: s.nom, classe: s.groupe || "", niveaux: tout, etape: Math.max(1, ...Object.values(tout)), total,
        erreurs: 0, termine: false, groupe: membres, date: serverTimestamp() };
      try { await setDoc(doc(db, "pointsdecours", s.user.uid + "__" + tp), v); } catch(_) {}
    }
    const mien = g.docs[moi()];
    if (mien && (mien.avec || []).length && plusHaut(tout, mien.niveaux)) {
      try { await setDoc(ref(tp), { niveaux: tout, maj: serverTimestamp() }, { merge: true }); } catch(_) {}
    }
  }

  async function ecrireGroupe(tp, avec, extra){
    const s = S(), g = GR[tp], st = MP()[tp];
    const v = { uid: s.user.uid, nom: s.nom, classe: s.groupe || "", site: s.site, tp, avec: avec.slice(0, MAX_CAMARADES),
      refus: ((g && g.docs[s.user.uid] && g.docs[s.user.uid].refus) || []), niveaux: (st && st.niveaux) || {},
      total: +(st && st.total) || 0, maj: serverTimestamp(), ...(extra || {}) };
    if (!v.avec.length) v.attente = {};
    try { await setDoc(ref(tp), v, { merge: true }); return true; }
    catch(_) { toast("Ton choix n'a pas pu être enregistré. Vérifie ta connexion."); return false; }
  }

  /* Bloc affiché sous le titre de la fiche de coups de pouce d'un TP. */
  function bloc(c, d){
    if (!estTP(d) || !actif()) return null;
    const g = suivre(c, d), tp = d.pouce;
    const el = document.createElement("span"); el.className = "grp";
    if (!g.charge) { el.innerHTML = `<span class="att">Binôme du TP : chargement…</span>`; return el; }
    const { membres, attente, refusent, invitations } = etatGroupe(g.docs, moi());
    const cites = [...membres, ...attente, ...invitations.flatMap(u => [u, ...(g.docs[u].avec || [])])];
    if (!ANN && cites.some(u => u !== moi() && !g.docs[u])) annuaire().then(a => { if (a) ctx.render(); });   // noms de ceux qui n'ont rien déclaré
    const h = [];
    invitations.forEach(u => {
      const autres = ((g.docs[u] && g.docs[u].avec) || []).filter(x => x !== moi()).map(nomDe);
      h.push(`<span class="lig inv" data-inv="${esc(u)}"><span><span class="nm">${esc(nomDe(u))}</span> t'a choisi pour ce TP${autres.length ? " (avec " + esc(autres.join(", ")) + ")" : ""}.</span>
        <button class="plein" type="button" data-oui>Confirmer</button><button type="button" data-non>Ce n'est pas mon groupe</button></span>`);
    });
    if (membres.length || attente.length || refusent.length) {
      const noms = [...membres.map(u => `<span class="nm">${esc(nomDe(u))}</span> <span class="ok">✓</span>`),
        ...attente.map(u => `<span class="nm">${esc(nomDe(u))}</span> <span class="att">(doit confirmer sur son compte)</span>`),
        ...refusent.map(u => `<span class="nm">${esc(nomDe(u))}</span> <span class="att">(a répondu que ce n'est pas son groupe : clique sur « Modifier »)</span>`)];
      h.push(`<span class="lig"><span>${membres.length + attente.length > 1 ? "Trinôme" : "Binôme"} : ${noms.join(" · ")}</span><button type="button" data-chx>Modifier</button></span>`);
      if (membres.length) h.push(`<span class="lig"><span class="att">Un coup de pouce débloqué par l'un de vous s'ouvre pour tout le groupe.</span></span>`);
    } else if (!invitations.length) {
      h.push(`<span class="lig"><span>Avant de commencer le TP : choisis ton binôme (ou ton trinôme).</span><button class="plein" type="button" data-chx>Choisir mon binôme</button></span>`);
    }
    el.innerHTML = h.join("");
    el.querySelectorAll("[data-chx]").forEach(b => b.onclick = e => { e.stopPropagation(); choisir(c, d); });
    el.querySelectorAll("[data-inv]").forEach(x => {
      const u = x.dataset.inv;
      x.querySelector("[data-oui]").onclick = async e => { e.stopPropagation();
        const deja = membres.length ? membres.map(nomDe).join(", ") : "";
        if (deja && !confirm("Tu vas quitter ton groupe actuel (" + deja + ") pour rejoindre " + nomDe(u) + ". Continuer ?")) return;
        if (await ecrireGroupe(tp, rejoindre(g.docs, moi(), u))) toast("C'est confirmé : vous êtes en groupe pour ce TP."); };
      x.querySelector("[data-non]").onclick = async e => { e.stopPropagation();
        const mien = g.docs[moi()] || {}, refus = [...new Set([...(mien.refus || []), u])];
        await ecrireGroupe(tp, (mien.avec || []).filter(y => y !== u), { refus }); };
    });
    return el;
  }

  async function choisir(c, d){
    const tp = d.pouce, g = suivre(c, d), s = S();
    const ann = await annuaire(); if (!ann) return;
    const mien = g.docs[moi()] || {}, coches = new Set(mien.avec || []);
    const autres = Object.values(ann).filter(v => v.uid !== moi()).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    const maClasse = autres.filter(v => v.classe === s.groupe), ailleurs = autres.filter(v => v.classe !== s.groupe);
    const ligne = v => `<label><input type="checkbox" value="${esc(v.uid)}"${coches.has(v.uid) ? " checked" : ""}><span>${esc(v.nom)}</span></label>`;
    const ov = document.createElement("div"); ov.className = "grp-ov";
    ov.innerHTML = `<div class="bx" role="dialog" aria-modal="true" aria-label="Choisir mon binôme">
      <div class="hd"><b>Avec qui fais-tu ce TP ?</b><p>Coche ton binôme (ou les deux camarades d'un trinôme). Chacun devra confirmer sur son propre compte, depuis la fiche de coups de pouce du TP.</p></div>
      <div class="ls">${maClasse.length ? maClasse.map(ligne).join("") : `<p class="vide">Personne de ta classe n'apparaît encore : un camarade apparaît ici dès qu'il s'est connecté au site.</p>`}
        ${ailleurs.length ? `<details${ailleurs.some(v => coches.has(v.uid)) ? " open" : ""}><summary>Autre classe</summary>${ailleurs.map(ligne).join("")}</details>` : ""}</div>
      <div class="ft"><button type="button" data-seul>Je travaille seul</button><button type="button" data-ann>Annuler</button><button class="v" type="button" data-ok>Valider</button></div></div>`;
    document.body.appendChild(ov);
    const boites = [...ov.querySelectorAll("input[type=checkbox]")], ok = ov.querySelector("[data-ok]");
    const maj = () => { const n = boites.filter(b => b.checked).length;
      boites.forEach(b => b.disabled = !b.checked && n >= MAX_CAMARADES);
      ok.disabled = n === 0; ok.textContent = n === 2 ? "Valider le trinôme" : "Valider"; };
    boites.forEach(b => b.onchange = maj); maj();
    const ferme = () => ov.remove();
    ov.onclick = e => { if (e.target === ov) ferme(); };
    ov.querySelector("[data-ann]").onclick = ferme;
    ov.querySelector("[data-seul]").onclick = async () => { if (await ecrireGroupe(tp, [])) { ferme(); toast("Noté : tu fais ce TP seul."); } };
    ok.onclick = async () => {
      const avec = boites.filter(b => b.checked).map(b => b.value);
      const refus = (mien.refus || []).filter(u => !avec.includes(u));
      if (await ecrireGroupe(tp, avec, { refus })) { ferme();
        toast(avec.length > 1 ? "C'est envoyé : tes deux camarades doivent confirmer sur leur compte." : "C'est envoyé : ton binôme doit confirmer sur son compte."); }
    };
  }

  /* Fiche de coups de pouce ouverte : branchement de l'iframe (à appeler juste après la création de l'iframe). */
  function brancher(c, d, fr){
    if (!estTP(d) || !actif()) return () => {};
    const tp = d.pouce; suivre(c, d); OUV[tp] = fr;
    const onMsg = async e => {
      if (e.source !== fr.contentWindow || !e.data) return;
      const g = GR[tp];
      if (e.data.type === "pouce-pret") { partager(tp); return; }
      if (!g || !(g.docs[moi()] && (g.docs[moi()].avec || []).length)) return;      // pas de groupe déclaré
      if (e.data.type === "pouce-attente") {
        const att = {}; Object.entries(e.data.attente || {}).forEach(([q, a]) => { if (a && +a.niv && +a.fin) att[q] = { niv: Math.min(3, +a.niv), fin: +a.fin }; });
        try { await setDoc(ref(tp), { attente: att, maj: serverTimestamp() }, { merge: true }); } catch(_) {}
      } else if (e.data.type === "pouce-niveau") {
        const mien = g.docs[moi()], niv = fusion(mien.niveaux, e.data.niveaux);
        if (plusHaut(niv, mien.niveaux) || (+e.data.total || 0) !== (+mien.total || 0))
          try { await setDoc(ref(tp), { niveaux: niv, total: +e.data.total || 0, maj: serverTimestamp() }, { merge: true }); } catch(_) {}
      }
    };
    window.addEventListener("message", onMsg);
    return () => { window.removeEventListener("message", onMsg); if (OUV[tp] === fr) delete OUV[tp]; };
  }

  /* Niveaux à passer à la fiche à l'ouverture (les miens + ceux du groupe). */
  function niveauxInit(d, mes){
    if (!estTP(d) || !actif() || !GR[d.pouce]) return mes;
    const g = GR[d.pouce], { membres } = etatGroupe(g.docs, moi());
    return fusion(mes, ...membres.map(u => g.docs[u].niveaux || {}));
  }

  function deconnexion(){ Object.values(GR).forEach(g => { try { g.unsub && g.unsub(); } catch(_) {} }); for (const k in GR) delete GR[k]; ANN = null; }

  return { connexion, bloc, brancher, niveauxInit, deconnexion, script: SCRIPT_FICHE, css: BINOMES_CSS };
}
