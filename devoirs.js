/* ================= Travail à la maison : cahier de textes individuel (27/11/2026) =================
   Dossiers de la nouvelle méthode (catalogue : rythme.devoirs = true).
   - En fin de cours, le professeur coche « J'ai cours » dans son appli (séance enregistrée dans deblocages/rythme_<dossier>_<uid>).
   - Chez chaque élève, le site ouvre aussitôt (ou à la connexion suivante) la fenêtre « Où t'es-tu arrêté ? » :
     la pièce en cours (activité, exercice…) et, pour une activité, la prochaine question à faire (A1, A2… B5).
   - Le site calcule le devoir (environ 15 min, 20 min au plus) à partir des durées indicatives du dossier
     (parties A, B… d'une activité, réparties sur leurs questions) et l'affiche avec sa durée dans « Mon travail à faire ».
   - Enregistrement : pointsdecours/<uid>__devoir:<dossier>  { type: "devoir", liste: { <séance t>: { arret, taches, min, type, at } } }.
     La partie déclarée ne fait JAMAIS avancer la jauge (seul le travail vérifié compte).
   - Vérification et note : rythme.js (statutsMaison, critère « Maison »). Pronote garde la trace collective et l'annonce de l'évaluation. */
import { toMs, heures, devoirId, absentA } from "./rythme.js?v=20261127c";

export const BUDGET = 15, MAX = 20;
const arrondi = m => Math.max(5, Math.round(m / 5) * 5);
export const estActivite = x => !!(x && x.corrige && !x.tp && /^Activit/i.test(x.num));
const estPapier = x => !!(x && x.corrige && !x.tp);   // activité ou exercice : vérifié par le professeur

/* Dernière séance de cours (hors TP) cochée par le professeur */
export function derniereSeance(r){
  const s = ((r && r.seances) || []).map(x => ({ t: toMs(x.t), h: +x.h || 0, tp: !!x.tp })).filter(x => x.t && !x.tp).sort((a, b) => a.t - b.t);
  return s.length ? s[s.length - 1] : null;
}
/* Pièces encore à faire (hors TP, hors parcours, hors pièces facultatives du chemin essentiel) */
export function aFaire(e){ return e.items.filter(x => !x.fait && !x.tp && !x.parcours && !(e.ess && x.horsEss)); }

/* Questions d'une activité dans l'ordre, avec la durée de chacune (durée de la partie répartie sur ses questions) */
function questions(x){
  const out = [];
  (x.parties || []).forEach(p => { const n = (p.questions || []).length || 1;
    (p.questions && p.questions.length ? p.questions : [p.id + "1"]).forEach(q => out.push({ q, partie: p.id, min: p.min / n })); });
  return out;
}
export function resteActivite(x, q){
  const qs = questions(x), i = Math.max(0, qs.findIndex(y => y.q === q));
  return { min: qs.slice(i).reduce((s, y) => s + y.min, 0), qs: qs.slice(i) };
}
const plage = qs => qs.length === 1 ? "la question " + qs[0].q : "les questions " + qs[0].q + " à " + qs[qs.length - 1].q;

/* Texte d'une tâche */
function tache(x, min, extra){
  const t = { num: x.num, titre: x.titre, min: arrondi(min), complet: true, ...(extra || {}) };
  if (x.parties) t.quoi = extra && extra.qs ? (extra.complet ? "reprends à la question " + extra.qs[0].q + " et termine l'activité" : "fais " + plage(extra.qs)) : "fais toute l'activité";
  else if (x.corrige) t.quoi = extra && extra.commence ? "termine l'exercice" : "fais l'exercice en entier";
  else if (x.pdc) t.quoi = "construis-le en ligne (bouton « Vérifier »)";
  else if (x.exemple) t.quoi = "lis la partie du cours, fais l'exemple, puis ouvre sa correction en ligne";
  else if (x.anim) t.quoi = extra && extra.complet === false ? "avance l'animation pendant " + arrondi(min) + " min (elle reprend là où tu t'es arrêté)" : "termine l'animation";
  if (t.qs) t.qs = t.qs.map(y => y.q);
  return t;
}

/* Calcul du devoir.
   arret = { num: pièce en cours, q: prochaine question (activité) ou "fini", etat: "pas" | "commence" | "fini" (autres pièces) }
         ou { attente: true } = « j'ai fini ce que j'avais commencé, j'attends la vérification du professeur ». */
export function calculer(ch, e, arret){
  arret = arret || {};
  if (e.frein || e.statut === "avance")
    return { type: "avance", min: 10, taches: [{ quoi: "Facultatif : tu es en avance. Fais les cartes de révision du dossier (rubrique « Réviser ») ou un « Côté terrain ★ ».", min: 10, complet: false }] };
  const items = e.items.filter(x => !x.tp && !x.parcours && !(e.ess && x.horsEss));
  const iA = arret.num ? items.findIndex(x => x.num === arret.num) : -1;
  const taches = []; let tot = 0, attente = false, bloque = null, premierPapier = true, saute = false;
  for (let k = 0; k < items.length; k++) {
    const x = items[k]; if (x.fait) continue;
    if (x.pdc) {   // le point de cours s'ouvre avec le corrigé de son activité ou de son TP
      const src = e.items.find(y => y.num === x.num.replace(/^Point de cours\s*[–-]\s*/, ""));
      if (src && !src.fait) { bloque = x; if (iA > k) { saute = true; continue; } break; }
    }
    /* Boucle dont le point de cours attend un corrigé : on saute jusqu'à la pièce déclarée par l'élève */
    if (saute && k < iA) continue;
    saute = false;
    let reste = x.duree * 60, extra = null;
    if (estPapier(x)) {
      const avant = iA >= 0 ? k < iA : arret.attente && premierPapier;
      premierPapier = false;
      if (avant) { attente = true; continue; }   // déjà fait, attend la vérification
      if (k === iA) {
        if (x.parties && arret.q) {
          if (arret.q === "fini") { attente = true; continue; }
          const r = resteActivite(x, arret.q); reste = r.min; extra = { qs: r.qs, complet: true };
        } else if (arret.etat === "fini") { attente = true; continue; }
        else if (arret.etat === "commence") { reste = reste / 2; extra = { commence: true }; }
      }
      /* Activité pas commencée ou reprise : la suite (point de cours) ne s'ouvrira qu'avec le corrigé */
    } else if (x.anim) reste = x.duree * 60 * (1 - (x.part || 0));
    if (tot >= BUDGET - 3) break;
    const dispo = MAX - tot;
    if (reste <= dispo + 1e-6) { const t = tache(x, reste, extra); taches.push(t); tot += reste; if (estPapier(x)) break; continue; }
    if (x.parties) {   // activité trop longue : on coupe sur les questions, environ 15 min
      const qs = extra && extra.qs ? extra.qs : questions(x), pris = []; let m = 0;
      for (const y of qs) { if (pris.length && m + y.min > Math.max(BUDGET - tot, 8) + 2) break; pris.push(y); m += y.min; }
      taches.push(tache(x, m, { qs: pris, complet: pris.length === qs.length })); tot += m; break;
    }
    if (x.anim) { const m = Math.max(BUDGET - tot, 8); taches.push(tache(x, m, { complet: false })); tot += m; break; }
    if (!taches.length) { taches.push(tache(x, reste, extra)); tot += reste; }
    break;
  }
  if (taches.length) return { type: "travail", min: arrondi(tot), taches };
  if (attente || bloque) return { type: "attente", min: 10, taches: [{ quoi: "Rien de nouveau à commencer : ton travail attend la vérification du professeur. Relis la partie de « L'essentiel du dossier » déjà vue et refais un exemple de tête.", min: 10, complet: false }] };
  return { type: "avance", min: 10, taches: [{ quoi: "Tout est fait : révise avec les cartes de révision du dossier (rubrique « Réviser »).", min: 10, complet: false }] };
}
export const texteTache = t => (t.num ? (t.titre || t.num) + " : " : "") + t.quoi;

/* ================= Branchement sur le site (index.html) ================= */
export const DEVOIRS_CSS = `
.dv-ov{position:fixed;inset:0;background:rgba(15,25,40,.5);display:flex;align-items:center;justify-content:center;z-index:120;padding:14px}
.dv-box{background:var(--surface,#fff);color:var(--ink,#18212F);border-radius:12px;max-width:520px;width:100%;max-height:92dvh;overflow:auto;padding:18px 18px 14px;box-shadow:0 10px 30px rgba(0,0,0,.25)}
.dv-box h2{margin:0 0 4px;font-size:1.15rem;color:#1F3864}.dv-box .dv-sous{margin:0 0 12px;color:var(--muted,#5A6577);font-size:.92rem}
.dv-box label{display:block;font-weight:700;margin:10px 0 4px}.dv-box select{width:100%;font:inherit;padding:9px 10px;border:1px solid var(--grid,#D8E0EA);border-radius:8px;background:var(--surface,#fff);color:inherit}
.dv-et{display:flex;flex-wrap:wrap;gap:6px}.dv-et button{font:inherit;padding:7px 12px;border-radius:999px;border:1px solid var(--grid,#D8E0EA);background:var(--surface,#fff);color:inherit;cursor:pointer}
.dv-et button[aria-pressed="true"]{background:#1F3864;color:#fff;border-color:#1F3864}
.dv-prev{margin:14px 0 6px;padding:10px 12px;border-radius:10px;background:#FFF2CC;border:1px solid #E8C35A}
.dv-prev b{color:#C55A11}.dv-prev ul,.dv-bloc ul{margin:6px 0 0;padding-left:18px}.dv-prev li,.dv-bloc li{margin:3px 0}
.dv-btns{display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}
.dv-btns button{font:inherit;font-weight:700;padding:9px 16px;border-radius:8px;border:0;cursor:pointer}
.dv-ok{background:#1F3864;color:#fff}.dv-ok:disabled{opacity:.5}.dv-plus{background:transparent;color:var(--muted,#5A6577)}
.dv-bloc{margin:10px 0 2px;padding:10px 12px;border-radius:10px;background:#FFF8E1;border:1px solid #EBD38A}
.dv-bloc .dv-h{display:flex;justify-content:space-between;gap:8px;align-items:baseline;flex-wrap:wrap}
.dv-bloc .dv-d{font-size:.85rem;color:var(--muted,#5A6577)}.dv-bloc .linkbtn,.dv-lien{background:none;border:0;padding:0;color:#2E75B6;text-decoration:underline;cursor:pointer;font:inherit;font-size:.88rem}
.dv-st{font-size:.8rem;font-weight:700;padding:1px 8px;border-radius:999px}`;

export function creerDevoirs(ctx){
  /* ctx : { db, doc, setDoc, serverTimestamp, S, MP, CAT, esc, toast, render, etatEleve, chapIdDe, rythmeDe, chapOK, eleveRev, MAISON, statuts } */
  const { db, doc, setDoc, serverTimestamp, esc, toast } = ctx;
  let ouvert = false; const reporte = new Set();
  const actifs = () => {
    const S = ctx.S(); if (!ctx.eleveRev() || (!S.mpCharge && !S.demo) || !ctx.CAT()) return [];
    return ctx.CAT().classes.filter(c => !S.site || c.id === S.site).flatMap(c => c.chapitres.map(ch => ({ c, ch })))
      .filter(({ ch }) => ch.rythme && ch.rythme.devoirs && ctx.rythmeDe(ch) && ctx.chapOK(ch) && S.rythme[ctx.chapIdDe(ch)]);
  };
  const docDe = ch => ctx.MP()[devoirId(ctx.chapIdDe(ch))] || null;
  const reponse = (ch, t) => { const d = docDe(ch); return d && d.liste && d.liste[t]; };
  /* Appelé après chaque affichage : fenêtre si une séance vient d'être cochée sans réponse */
  function verifier(){
    if (ouvert || ctx.S().demo) return;   // compte de démonstration : pas d'ouverture automatique, lien dans l'encadré
    for (const { c, ch } of actifs()) {
      const s = derniereSeance(ctx.S().rythme[ctx.chapIdDe(ch)]);
      if (!s || Date.now() - s.t > 5 * 864e5 || reponse(ch, s.t) || reporte.has(ch.titre + s.t)) continue;
      if (!ctx.etatEleve(ch)) continue;
      fenetre(c, ch, s); return;
    }
  }
  function libelle(x){ return (x.titre || x.num) + (x.duree ? " (" + heures(x.duree) + ")" : ""); }
  function fenetre(c, ch, s, modif){
    const e = ctx.etatEleve(ch); if (!e) return;
    ouvert = true;
    const pieces = aFaire(e), papier = pieces.filter(estPapier);
    const avant = (reponse(ch, s.t) || {}).arret || ((docDe(ch) || {}).dernier || {}).arret || {};
    let num = avant.num && pieces.some(x => x.num === avant.num) ? avant.num : (papier[0] || pieces[0] || {}).num || "";
    let q = avant.q || "", etat = avant.etat || "pas", attente = !!avant.attente && !avant.num;
    const ov = document.createElement("div"); ov.className = "dv-ov";
    const jour = new Date(s.t).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    const abs = absentA(ctx.S().rythme[ctx.chapIdDe(ch)], s.t);   // absence notée par le professeur (27/11/2026)
    const dessine = () => {
      const x = pieces.find(y => y.num === num), arret = attente ? { attente: true } : x && x.parties ? { num, q: q || questions(x)[0].q } : { num, etat };
      const dv = calculer(ch, e, arret);
      ov.innerHTML = `<div class="dv-box" role="dialog" aria-modal="true" aria-label="Où t'es-tu arrêté ?">
        ${abs ? `<h2>📝 Tu n'étais pas en cours le ${esc(jour)}</h2>
        <p class="dv-sous">${esc(ch.titre)}. Cette séance ne compte pas contre toi dans ta note d'investissement. Ta jauge, elle, continue d'avancer (la date de l'évaluation ne change pas) : voici un rattrapage d'environ 15 min pour revenir à jour. Indique où tu en es.</p>`
        : `<h2>📝 Fin de séance : où t'es-tu arrêté ?</h2>
        <p class="dv-sous">${esc(ch.titre)} · séance du ${esc(jour)}. Ta réponse sert seulement à calculer ton travail pour la prochaine séance : elle ne fait pas avancer ta jauge (seul ton travail vérifié compte).</p>`}
        <label for="dv-p">Je travaille sur</label>
        <select id="dv-p">${pieces.map(y => `<option value="${esc(y.num)}"${!attente && y.num === num ? " selected" : ""}>${esc(libelle(y))}</option>`).join("")}
          <option value="__attente"${attente ? " selected" : ""}>J'ai fini ce que j'avais commencé : j'attends la vérification du professeur</option></select>
        ${attente || !x ? "" : x.parties ? `<label for="dv-q">Prochaine question à faire</label><select id="dv-q">${questions(x).map(y => `<option value="${y.q}"${y.q === (q || questions(x)[0].q) ? " selected" : ""}>${y.q} (partie ${y.partie})</option>`).join("")}<option value="fini"${q === "fini" ? " selected" : ""}>J'ai fini l'activité</option></select>`
          : x.corrige ? `<label>Où en es-tu ?</label><div class="dv-et">${[["pas", "Pas commencé"], ["commence", "Commencé, pas fini"], ["fini", "Fini"]].map(([k, l]) => `<button type="button" data-e="${k}" aria-pressed="${etat === k}">${l}</button>`).join("")}</div>`
          : `<p class="dv-sous" style="margin-top:8px">Le site suit cette pièce tout seul (en ligne) : rien d'autre à indiquer.</p>`}
        <div class="dv-prev"><b>${abs ? "Ton rattrapage" : "Ton travail pour la prochaine séance"} : environ ${dv.min} min</b><ul>${dv.taches.map(t => `<li>${esc(texteTache(t))} <span class="dv-d">(≈ ${t.min} min)</span></li>`).join("")}</ul></div>
        <p class="dv-sous">Les coups de pouce sont sur le site, comme en classe.${abs ? " Ce rattrapage n'est pas noté." : " Ton professeur vérifiera au début de la prochaine séance."}</p>
        <div class="dv-btns">${modif ? "" : `<button type="button" class="dv-plus">Plus tard</button>`}<button type="button" class="dv-ok">${modif ? "Enregistrer" : "Valider"}</button></div></div>`;
      ov.querySelector("#dv-p").onchange = ev => { const v = ev.target.value; attente = v === "__attente"; if (!attente) { num = v; q = ""; etat = "pas"; } dessine(); };
      const sq = ov.querySelector("#dv-q"); if (sq) sq.onchange = ev => { q = ev.target.value; dessine(); };
      ov.querySelectorAll("[data-e]").forEach(b => b.onclick = () => { etat = b.dataset.e; dessine(); });
      const pl = ov.querySelector(".dv-plus"); if (pl) pl.onclick = () => { reporte.add(ch.titre + s.t); fermer(); toast("D'accord : la question reviendra à ta prochaine connexion."); };
      ov.querySelector(".dv-ok").onclick = async ev => { ev.target.disabled = true; await enregistrer(c, ch, s, arret, abs && dv.type === "travail" ? { ...dv, type: "rattrapage" } : dv); fermer(); };
    };
    const fermer = () => { ov.remove(); document.body.style.overflow = ""; ouvert = false; ctx.render(); };
    dessine(); document.body.appendChild(ov); document.body.style.overflow = "hidden";
  }
  async function enregistrer(c, ch, s, arret, dv){
    const S = ctx.S(), id = devoirId(ctx.chapIdDe(ch)), ancien = docDe(ch) || {};
    const ent = { arret, taches: dv.taches, min: dv.min, type: dv.type, at: Date.now() };
    const v = { uid: S.user.uid, pdc: id, type: "devoir", site: c.id, chap: ctx.chapIdDe(ch), titre: "Travail à la maison – " + ch.titre, activite: "",
      nom: S.nom, classe: S.groupe || "", liste: { ...(ancien.liste || {}), [s.t]: ent }, dernier: { t: s.t, ...ent },
      etape: Object.keys(ancien.liste || {}).length + 1, total: 0, erreurs: 0, termine: false, date: serverTimestamp() };
    ctx.MP()[id] = { ...v, date: Date.now() };
    try { await setDoc(doc(db, "pointsdecours", S.user.uid + "__" + id), v); toast("C'est noté : ton travail est dans « Mon travail à faire »."); }
    catch(_) { toast("Enregistrement impossible, vérifie ta connexion."); }
  }
  /* Encadré « Mon travail à faire » (dans la jauge du dossier) */
  function bloc(c, ch, e){
    if (!ch.rythme || !ch.rythme.devoirs || !ctx.eleveRev()) return "";
    const r = ctx.S().rythme[ctx.chapIdDe(ch)]; if (!r) return "";
    const s = derniereSeance(r), d = docDe(ch), lst = (e.maison || []);
    const der = lst[lst.length - 1];
    const manque = s && !reponse(ch, s.t);
    const M = ctx.MAISON;
    let h = `<div class="dv-bloc"><div class="dv-h"><b>📝 Mon travail à faire</b>`;
    if (der && (!s || der.t >= s.t)) {
      const jour = new Date(der.t).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
      h += `<span class="dv-d">donné le ${esc(jour)} · environ <b>${der.min} min</b></span></div><ul>${(der.taches || []).map(t => `<li>${esc(texteTache(t))} <span class="dv-d">(≈ ${t.min} min)</span></li>`).join("")}</ul>
        ${der.type === "travail" ? `<p class="dv-d">Ton professeur le vérifiera au début de la prochaine séance.</p>` : der.type === "rattrapage" ? `<p class="dv-d">Rattrapage de ton absence : pas noté, mais il te remet à jour.</p>` : ""}
        ${!der.taches || !der.taches.some(t => t.prof) ? `<button type="button" class="dv-lien" data-dv-modif>Je me suis trompé : modifier où je me suis arrêté</button>` : `<p class="dv-d">Devoir donné par ton professeur.</p>`}`;
    } else h += `</div><p class="dv-d">${manque ? "" : "Pas encore de travail : il sera calculé à la fin de la prochaine séance, quand ton professeur la cochera."}</p>`;
    if (manque) h += `<button type="button" class="dv-lien" data-dv-dire>${absentA(r, s.t) ? "➜ Absent à la dernière séance : voir mon rattrapage" : "➜ Dire où je me suis arrêté à la dernière séance"}</button>`;
    if (e.absences && e.absences.length) h += `<p class="dv-d">Absence${e.absences.length > 1 ? "s" : ""} notée${e.absences.length > 1 ? "s" : ""} : ${e.absences.map(t => esc(new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "numeric" }))).join(", ")} · ces séances ne comptent pas dans ta régularité.</p>`;
    const vus = lst.filter(x => x.evaluable && x.suiv && M[x.statut]).slice(-4);
    if (vus.length) h += `<p class="dv-d">Derniers devoirs : ${vus.map(x => `<span class="dv-st" style="color:${M[x.statut].couleur};background:${M[x.statut].fond}">${esc(new Date(x.t).toLocaleDateString("fr-FR", { day: "numeric", month: "numeric" }))} · ${esc(M[x.statut].lib)}</span>`).join(" ")}${e.apprenti ? " · alternant : le travail à la maison ne compte pas dans ta note" : ""}</p>`;
    return h + `</div>`;
  }
  function brancher(box, c, ch){
    const S = ctx.S(), r = S.rythme[ctx.chapIdDe(ch)], s = derniereSeance(r);
    const a = box.querySelector("[data-dv-dire]"); if (a && s) a.onclick = () => { reporte.delete(ch.titre + s.t); fenetre(c, ch, s); };
    const m = box.querySelector("[data-dv-modif]"); if (m && s) m.onclick = () => fenetre(c, ch, s, true);
  }
  return { css: DEVOIRS_CSS, verifier, bloc, brancher };
}
