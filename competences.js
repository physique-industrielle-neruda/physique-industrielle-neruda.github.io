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
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const lignes = COMPS.filter(c => pr[c]).map(c => {
    const x = pr[c], N = NIVEAUX[x.niveau], w = x.score == null ? 0 : Math.max(4, x.score / 3 * 100);
    const det = (x.nP ? x.nP + " question" + (x.nP > 1 ? "s" : "") + " avec coups de pouce" : "") + (x.nP && x.nA ? " · " : "") + (x.nA ? x.nA + " question" + (x.nA > 1 ? "s" : "") + " de l'animation" : "");
    const al = x.alerte === "auto" ? "Tu as été autonome en activité, mais l'animation montre que ce n'est pas encore fixé."
      : x.alerte === "progres" ? "Tu as eu besoin d'aide en activité, mais tu as réussi l'animation seul : tu progresses."  : "";
    return `<div class="cpf-l" title="${esc(det)}"><div class="cpf-n"><b>${esc(LIBS[c])}</b><span>${esc(DEFS[c])}</span></div>
      <div class="cpf-b"><div class="cpf-t"><i style="width:${w}%;background:${N.couleur}"></i></div>
      <span class="cpf-e" style="color:${N.couleur};background:${N.fond}">${x.niveau === "solide" ? "✓ " : x.niveau === "fragile" ? "! " : ""}${esc(N.lib)}</span></div>
      ${al ? `<div class="cpf-a">${esc(al)}</div>` : ""}${opts.detail ? `<div class="cpf-d">${esc(det)}${x.score != null ? " · score " + x.score.toFixed(1).replace(".", ",") + " / 3" : ""}</div>` : ""}</div>`;
  }).join("");
  return `<div class="cpf">${lignes || '<p class="cpf-v">Aucune donnée pour l\'instant.</p>'}</div>`;
}
export const PROFIL_CSS = `.cpf{display:grid;gap:12px}.cpf-l{border:1px solid #D8E0EA;border-radius:10px;padding:10px 12px;background:#fff;color:#18212F}
.cpf-n b{display:block;color:#1F3864;font-size:16px}.cpf-n span{font-size:13px;color:#5A6577}
.cpf-b{display:flex;align-items:center;gap:10px;margin-top:8px}.cpf-t{flex:1;height:12px;background:#EEF1F5;border-radius:6px;overflow:hidden}
.cpf-t i{display:block;height:100%;border-radius:6px}.cpf-e{font-size:12px;font-weight:bold;border-radius:10px;padding:2px 9px;white-space:nowrap}
.cpf-a{margin-top:6px;font-size:13px;color:#C55A11;font-style:italic}.cpf-d{margin-top:4px;font-size:12px;color:#5A6577}.cpf-v{color:#5A6577}`;
