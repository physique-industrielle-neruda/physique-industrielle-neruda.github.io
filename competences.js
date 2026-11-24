/* Profil de compétences de la démarche scientifique (24/11/2026, prototype BTS CIRA « Amplification »).
   Partagé par le site (index.html) et l'appli professeur (prof.html). Publié à la racine du site.
   Sources d'un profil :
   - coups de pouce : niveau atteint par question, seulement pour les activités / TP / exercices dont le corrigé
     est débloqué (travail vérifié). Aucun coup de pouce = 3 · niveau 1 = 2 · niveau 2 = 1 · niveau 3 = 0.
   - animation : juste au 1er essai = 3 · au 2e essai = 2 · correction affichée = 0 (questions répondues seulement).
   Score d'une compétence (0 à 3) : moyenne des deux sources quand elles existent toutes les deux.
   Moins de 3 questions comptées : « pas encore assez d'éléments ». Rien n'est noté. */
export const COMPS = ["APP", "ANA", "REA", "VAL", "COM"];
export const LIBS = { APP: "S'approprier", ANA: "Analyser", REA: "Réaliser", VAL: "Valider", COM: "Communiquer" };
export const DEFS = {
  APP: "trouver et organiser les informations utiles (énoncé, document, plaque, unités)",
  ANA: "choisir la bonne relation ou la bonne méthode, établir une relation",
  REA: "mener le calcul ou la mesure jusqu'au bout, avec les bonnes unités",
  VAL: "juger un résultat : cohérence, comparaison à un critère, conclusion",
  COM: "rédiger une justification claire avec le bon vocabulaire"
};
export const NIVEAUX = {
  fragile: { lib: "À renforcer", couleur: "#C0392B", fond: "#FBE5E1" },
  moyen:   { lib: "En progrès",  couleur: "#C55A11", fond: "#FBE5D6" },
  solide:  { lib: "Solide",      couleur: "#3F7A3A", fond: "#E2EFDA" },
  vide:    { lib: "Pas encore assez d'éléments", couleur: "#5A6577", fond: "#EEF1F5" }
};
export const niveauDe = s => s == null ? "vide" : s < 1.25 ? "fragile" : s < 2.25 ? "moyen" : "solide";
const moy = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

/* map : catalogue → chapitre.competences.questions ({ "Activité 1": {A2: "VAL", …}, "Animation": {"1.1": "REA", …} })
   pouces : { "Activité 1": { niveaux: {A2: 2}, valide: true }, … }   (valide = corrigé débloqué)
   anim : { "1.1": {t: 1, ok: true}, … }  (deux premiers essais seulement : t = nombre d'essais, ok = juste) */
export function pointsAnim(r){
  if (!r) return null;
  if (r.ok && r.t <= 1) return 3;
  if (r.ok && r.t === 2) return 2;
  if (r.t >= 2) return 0;
  return null;                                       // 1er essai faux, 2e pas encore fait : pas compté
}
export function profil(map, pouces, anim){
  const R = {};
  COMPS.forEach(c => R[c] = { p: [], a: [] });
  Object.entries(map || {}).forEach(([docu, qs]) => {
    if (docu === "Animation") {
      Object.entries(qs).forEach(([n, c]) => { const r = pointsAnim(anim && anim[n]); if (R[c] && r != null) R[c].a.push(r); });
      return;
    }
    const st = pouces && pouces[docu];
    if (!st || !st.valide) return;
    Object.entries(qs).forEach(([q, c]) => { const n = Math.min(3, (st.niveaux || {})[q] || 0); if (R[c]) R[c].p.push(3 - n); });
  });
  const out = {};
  COMPS.forEach(c => {
    const P = moy(R[c].p), A = moy(R[c].a), nb = R[c].p.length + R[c].a.length;
    if (!nb) return;                                   // compétence non travaillée dans ce dossier
    const score = nb < 3 ? null : P != null && A != null ? (P + A) / 2 : P != null ? P : A;
    let alerte = null;
    if (R[c].p.length >= 2 && R[c].a.length >= 2) {
      if (P >= 2.5 && A <= 1.5) alerte = "auto";     // autonome en activité, mais l'animation montre que ce n'est pas fixé
      else if (P <= 1.5 && A >= 2.5) alerte = "progres";
    }
    out[c] = { score, P, A, nP: R[c].p.length, nA: R[c].a.length, niveau: niveauDe(score), alerte };
  });
  return out;
}

/* Phrase de synthèse pour l'élève */
export function synthese(pr){
  const cs = Object.keys(pr).filter(c => pr[c].score != null);
  if (!cs.length) return "Ton profil se construit au fil du dossier : il apparaîtra quand tu auras terminé des activités et l'animation.";
  const fort = cs.slice().sort((a, b) => pr[b].score - pr[a].score)[0];
  const faible = cs.slice().sort((a, b) => pr[a].score - pr[b].score)[0];
  if (pr[faible].niveau === "solide") return "Toutes tes compétences sont solides sur ce dossier. Bravo : vérifie-le avec l'exercice type évaluation de ton parcours.";
  return "Ton point fort : " + LIBS[fort] + ". Ton point à travailler : " + LIBS[faible] + " (" + DEFS[faible] + ").";
}

/* Profil dessiné en HTML (barres horizontales 0 à 3, une par compétence, étiquette de niveau en clair) */
export function profilHtml(pr, opts = {}){
  const ev = opts.eval || {};   // taux de réussite à l'évaluation de fin de dossier, par compétence (0 à 1)
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const lignes = COMPS.filter(c => pr[c] || ev[c] != null).map(c => {
    const x = pr[c] || { score: null, nP: 0, nA: 0, niveau: "vide" }, N = NIVEAUX[x.niveau], w = x.score == null ? 0 : Math.max(4, x.score / 3 * 100);
    const e = ev[c], eh = e == null ? "" : `<i class="cpf-m" style="left:calc(${Math.round(e * 100)}% - 7px)" title="Évaluation : ${Math.round(e * 100)} %"></i>`;
    const det = (x.nP ? x.nP + " question" + (x.nP > 1 ? "s" : "") + " avec coups de pouce" : "") + (x.nP && x.nA ? " · " : "") + (x.nA ? x.nA + " question" + (x.nA > 1 ? "s" : "") + " de l'animation" : "");
    const al = x.alerte === "auto" ? "Tu as été autonome en activité, mais l'animation montre que ce n'est pas encore fixé."
      : x.alerte === "progres" ? "Tu as eu besoin d'aide en activité, mais tu as réussi l'animation seul : tu progresses."  : "";
    return `<div class="cpf-l" title="${esc(det)}"><div class="cpf-n"><b>${esc(LIBS[c])}</b><span>${esc(DEFS[c])}</span></div>
      <div class="cpf-b"><div class="cpf-t"><i style="width:${w}%;background:${N.couleur}"></i>${eh}</div>
      <span class="cpf-e" style="color:${N.couleur};background:${N.fond}">${x.niveau === "solide" ? "✓ " : x.niveau === "fragile" ? "! " : ""}${esc(N.lib)}</span></div>
      ${e != null ? `<div class="cpf-ev">◆ Évaluation de fin de dossier : <b>${Math.round(e * 100)} %</b> de réussite${x.score != null ? (e * 3 >= x.score + 0.5 ? " · mieux qu'en apprentissage 👍" : e * 3 <= x.score - 0.75 ? " · moins bien qu'en apprentissage" : "") : ""}</div>` : ""}
      ${al ? `<div class="cpf-a">${esc(al)}</div>` : ""}${opts.detail ? `<div class="cpf-d">${esc(det)}${x.score != null ? " · score " + x.score.toFixed(1).replace(".", ",") + " / 3" : ""}</div>` : ""}</div>`;
  }).join("");
  return `<div class="cpf">${lignes || '<p class="cpf-v">Aucune donnée pour l\'instant.</p>'}</div>`;
}
export const PROFIL_CSS = `.cpf{display:grid;gap:12px}.cpf-l{border:1px solid #D8E0EA;border-radius:10px;padding:10px 12px;background:#fff;color:#18212F}
.cpf-n b{display:block;color:#1F3864;font-size:16px}.cpf-n span{font-size:13px;color:#5A6577}
.cpf-b{display:flex;align-items:center;gap:10px;margin-top:8px}.cpf-t{flex:1;height:12px;background:#EEF1F5;border-radius:6px;overflow:hidden}
.cpf-t{position:relative;overflow:visible}.cpf-t>i:first-child{display:block;height:100%;border-radius:6px}
.cpf-m{position:absolute;top:-3px;width:14px;height:14px;background:#1F3864;transform:rotate(45deg);border:2px solid #fff;border-radius:2px}
.cpf-ev{margin-top:6px;font-size:13px;color:#1F3864}.cpf-leg{font-size:13px;color:#5A6577;margin:4px 0 10px}.cpf-e{font-size:12px;font-weight:bold;border-radius:10px;padding:2px 9px;white-space:nowrap}
.cpf-a{margin-top:6px;font-size:13px;color:#C55A11;font-style:italic}.cpf-d{margin-top:4px;font-size:12px;color:#5A6577}.cpf-v{color:#5A6577}`;

/* ---------- Suivi sur l'année (24/11/2026) ----------
   dossiers : [{ titre, profil, eval }] dans l'ordre du cours (profil = profil(), eval = taux par compétence ou null).
   Niveau de l'année = moyenne des scores d'autonomie des dossiers où la compétence a un score ; évaluation = moyenne des taux. */
export function bilanAnnee(dossiers){
  const out = {};
  COMPS.forEach(c => {
    const serie = dossiers.map(d => ({ titre: d.titre, score: d.profil && d.profil[c] ? d.profil[c].score : null, eval: d.eval && d.eval[c] != null ? d.eval[c] : null }))
      .filter(p => p.score != null || p.eval != null);
    if (!serie.length) return;
    const sc = serie.map(p => p.score).filter(x => x != null), ev = serie.map(p => p.eval).filter(x => x != null);
    const score = sc.length ? moy(sc) : null;
    out[c] = { score, niveau: niveauDe(score), eval: ev.length ? moy(ev) : null, serie, nP: 0, nA: 0 };
  });
  return out;
}
function courbe(serie){
  if (serie.length < 2) return "";
  const W = 240, H = 64, n = serie.length, x = i => 12 + i * (W - 24) / (n - 1), y = v => H - 8 - v / 3 * (H - 16);
  const pts = serie.map((p, i) => p.score != null ? [x(i), y(p.score)] : null);
  const ligne = pts.filter(Boolean).map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return `<svg class="cpf-c" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Évolution dossier par dossier">
    <line x1="4" x2="${W - 4}" y1="${y(2.25)}" y2="${y(2.25)}" stroke="#E2EFDA" stroke-width="1.5"/><line x1="4" x2="${W - 4}" y1="${y(1.25)}" y2="${y(1.25)}" stroke="#FBE5E1" stroke-width="1.5"/>
    <path d="${ligne}" fill="none" stroke="#1F3864" stroke-width="2"/>
    ${pts.map((p, i) => p ? `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${NIVEAUX[niveauDe(serie[i].score)].couleur}" stroke="#fff" stroke-width="2"><title>${serie[i].titre} : ${NIVEAUX[niveauDe(serie[i].score)].lib}</title></circle>` : "").join("")}
    ${serie.map((p, i) => p.eval != null ? `<rect x="${x(i) + 3}" y="${y(p.eval * 3) - 4}" width="8" height="8" fill="#1F3864" opacity=".75" transform="rotate(45 ${x(i) + 7} ${y(p.eval * 3)})"><title>${p.titre} : évaluation ${Math.round(p.eval * 100)} %</title></rect>` : "").join("")}
  </svg>`;
}
export function anneeHtml(bilan){
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const lignes = COMPS.filter(c => bilan[c]).map(c => {
    const b = bilan[c], N = NIVEAUX[b.niveau], w = b.score == null ? 0 : Math.max(4, b.score / 3 * 100);
    const eh = b.eval == null ? "" : `<i class="cpf-m" style="left:calc(${Math.round(b.eval * 100)}% - 7px)" title="Évaluations : ${Math.round(b.eval * 100)} %"></i>`;
    return `<div class="cpf-l"><div class="cpf-n"><b>${esc(LIBS[c])}</b><span>${esc(DEFS[c])}</span></div>
      <div class="cpf-b"><div class="cpf-t"><i style="width:${w}%;background:${N.couleur}"></i>${eh}</div><span class="cpf-e" style="color:${N.couleur};background:${N.fond}">${esc(N.lib)}</span></div>
      <div class="cpf-y">${courbe(b.serie)}<span>${b.serie.length} dossier${b.serie.length > 1 ? "s" : ""}${b.eval != null ? " · ◆ évaluations : " + Math.round(b.eval * 100) + " % de réussite" : ""}</span></div></div>`;
  }).join("");
  return `<div class="cpf">${lignes || '<p class="cpf-v">Aucun dossier avec profil de compétences pour l\'instant.</p>'}</div>`;
}
export const ANNEE_CSS = `.cpf-y{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:6px;font-size:13px;color:#5A6577}`;
