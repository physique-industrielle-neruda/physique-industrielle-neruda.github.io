/* Rythme individuel du dossier, jauge et note d'investissement (25/11/2026, prototype BTS CIRA « Amplification »).
   Partagé par le site (index.html) et l'appli professeur (prof.html).
   - Durée du dossier = somme des durées indicatives (catalogue : chapitre.rythme.items) + marge (1 h).
   - Temps écoulé = séances cochées par le professeur (« J'ai cours », 1 h ou 2 h), enregistrées dans
     deblocages/rythme_<dossier>_<uid> (un document par élève : seances, evalDate, attitude, ajust).
   - Travail fait : corrigé débloqué (activités, TP, exercices), correction de l'exemple ouverte (une partie du cours
     par exemple, « Correction des exemples » → pointsdecours « exemples:<dossier> »), animation terminée,
     point de cours en ligne terminé (25/11/2026 : compte aussi dans le critère « Cours »), parcours avant l'évaluation terminé.
   - TP (25/11/2026) : faits par toute la classe en même temps, hors jauge : une séance « J'ai TP » (tp: true) ne compte pas
     dans le temps écoulé et le TP ne compte pas dans le travail fait ; son corrigé rapporte toujours ses points « Corrigés ».
   - Frein : plus d'1 h d'avance sur le temps écoulé -> la suite (hors TP et cours) attend la prochaine séance.
   - Note /20 (25/11/2026 : critère « attitude » supprimé, la note ne porte que sur le travail) :
     corrigés 10, cours 2, animation 3, régularité 5 (dossier avec points de cours en ligne : corrigés 9, cours 3)
     + ajustement du professeur, arrêtée à la fin du jour de l'évaluation. Les coups de pouce ne comptent jamais.
   - Chemin essentiel (25/11/2026) : le professeur l'ouvre à un élève en retard (r.essentiel = date). Les pièces
     marquées « horsEss » (catalogue) deviennent facultatives : la jauge et la régularité (séances suivantes) ne
     portent plus que sur le chemin essentiel. La note d'investissement continue de compter tout le dossier. */
export const toMs = x => x == null ? null : typeof x === "number" ? x : x.toMillis ? x.toMillis() : x instanceof Date ? x.getTime() : (typeof x === "string" ? Date.parse(x) : null);
export const BAREME = { corriges: 10, cours: 2, anim: 3, regularite: 5 };
/* 25/11/2026 : dossier avec points de cours en ligne → corrigés 7, cours 3 (exemples + points de cours) */
export const BAREME_PDC = { corriges: 9, cours: 3, anim: 3, regularite: 5 };
export const baremeDe = ch => ch && ch.rythme && ch.rythme.items.some(x => x.pdc) ? BAREME_PDC : BAREME;
export const exemplesId = chapId => "exemples:" + chapId;
export const rythmeDocId = (chapId, uid) => "rythme_" + chapId + "_" + uid;
export const rythmeDoc = chapId => "rythme:" + chapId;
export function heures(h){
  const m = Math.round(Math.max(0, h) * 60), hh = Math.floor(m / 60), mm = m % 60;
  return hh ? hh + " h" + (mm ? " " + String(mm).padStart(2, "0") : "") : mm + " min";
}
export function finJour(iso){ if (!iso) return Infinity; const d = new Date(iso + "T23:59:59"); return isNaN(d) ? Infinity : d.getTime(); }

/* src = { corrAt: {corrigeId: ms}, mp: {pdc: doc pointsdecours}, r: doc rythme (seances, evalDate, ajust, essentiel), now } */
export function etat(ch, src){
  const R = ch.rythme, chapId = ch.verrou ? ch.verrou.id : ch.titre, now = src.now || Date.now();
  const r = src.r || {}, corrAt = src.corrAt || {}, mp = src.mp || {};
  const items = R.items.map(it => {
    let t = null, part = 0;
    if (it.corrige) { t = toMs(corrAt[it.corrige]); part = t ? 1 : 0; }
    else if (it.exemple) { const v = mp[exemplesId(chapId)], vu = v && v.vus && v.vus[it.exemple]; if (vu) { t = toMs(vu) || now; part = 1; } }
    else if (it.anim) {
      const v = mp["anim:" + chapId], rep = (v && v.reponses) || {};
      const n = Object.values(rep).filter(x => x.ok || x.t >= 2).length, tot = it.questions || 1;
      part = Math.min(1, n / tot); if (part >= 1) t = toMs(v.date) || now;
    }
    else if (it.pdc) { const v = mp[it.pdc]; if (v && v.termine) { t = toMs(v.date) || now; part = 1; } }   // point de cours en ligne terminé (25/11/2026)
    else if (it.parcours) { const v = mp["parcours:" + it.parcours]; if (v && v.fini) { t = toMs(v.date) || now; part = 1; } }
    return { ...it, t, part, fait: !!t };
  });
  const contenuTout = items.reduce((s, x) => s + (x.tp ? 0 : x.duree), 0), marge = R.marge ?? 1, total = contenuTout + marge;
  const contenuEss = items.reduce((s, x) => s + (x.tp || x.horsEss ? 0 : x.duree), 0);
  const essDepuis = toMs(r.essentiel), ess = !!essDepuis && contenuEss < contenuTout;
  const ecart = contenuTout - contenuEss;   // temps gagné par le chemin essentiel
  const contenu = ess ? contenuEss : contenuTout;
  const limite = finJour(r.evalDate);
  const toutes = (r.seances || []).map(s => ({ t: toMs(s.t), h: +s.h || 0, tp: !!s.tp })).filter(s => s.t).sort((a, b) => a.t - b.t);
  const seances = toutes.filter(s => !s.tp);   // séances de TP : hors jauge
  const ecoule = seances.reduce((s, x) => s + x.h, 0);
  const faitA = (t, e = ess) => items.reduce((s, x) => s + (!x.tp && !(e && x.horsEss) && x.t && x.t <= t ? x.duree : 0), 0);
  const fait = faitA(now);
  /* Temps de cours « attendu » : sur le chemin essentiel, l'élève dispose du temps gagné (pièces facultatives) */
  const attendu = (cum, e = ess) => e ? Math.min(Math.max(0, cum - ecart), contenuEss) : Math.min(cum, contenuTout);
  const retard = attendu(ecoule) - fait;
  const deuxTiers = ecoule >= (2 / 3) * total - 1e-6;   // alerte aux deux tiers du dossier
  const statut = retard < -1e-6 ? "avance" : retard <= 1e-6 ? "vert" : retard <= 1 ? "orange" : "rouge";
  const avance = fait - (ess ? attendu(ecoule) : ecoule);
  const frein = !ess && avance >= marge && ecoule < contenu;
  const reste = Math.max(0, contenu - fait), resteCours = Math.max(0, total - ecoule);
  /* Régularité : à chaque séance, l'élève est-il à jour avant la séance suivante ? (vert 1, orange 0,5, rouge 0) */
  const scores = []; let cum = 0;
  const sv = seances.filter(s => s.t <= limite);
  sv.forEach((s, k) => { cum += s.h; const tn = k + 1 < sv.length ? sv[k + 1].t : Math.min(now, limite);
    const e = ess && s.t >= essDepuis, rr = attendu(cum, e) - faitA(tn, e); scores.push(rr <= 0 ? 1 : rr <= 1 ? 0.5 : 0); });
  const corr = items.filter(x => x.corrige), avant = x => x.t && x.t <= limite;
  const B = baremeDe(ch);
  const anim = items.find(x => x.anim), exs = items.filter(x => x.exemple || x.pdc);   // critère « Cours » : exemples + points de cours en ligne
  const pts = {
    corriges: corr.length ? B.corriges * corr.filter(avant).length / corr.length : B.corriges,
    cours: exs.length ? B.cours * exs.filter(avant).length / exs.length : B.cours,
    anim: anim ? B.anim * anim.part : B.anim,
    regularite: scores.length ? B.regularite * scores.reduce((a, b) => a + b, 0) / scores.length : B.regularite
  };
  const brut = Object.values(pts).reduce((a, b) => a + b, 0) + (+r.ajust || 0);
  const note = Math.max(0, Math.min(20, Math.round(brut * 2) / 2));
  return { bareme: B, toutes, items, contenu, contenuTout, contenuEss, ess, deuxTiers, marge, total, ecoule, fait, retard, statut, avance, frein, reste, resteCours, seances, scores, pts, note, limite, evalDate: r.evalDate || "" };
}
export const STATUTS = {
  avance: { lib: "En avance",      couleur: "#2E75B6", fond: "#DEEAF6" },
  vert:   { lib: "Dans les temps", couleur: "#3F7A3A", fond: "#E6F1E3" },
  orange: { lib: "Léger retard",   couleur: "#C55A11", fond: "#FBE5D6" },
  rouge:  { lib: "Retard important", couleur: "#C0392B", fond: "#FBE5E1" }
};
/* Élément du rythme correspondant à un document du site (énoncé d'activité, de TP, d'exercice, animation) */
export function itemDuDoc(ch, num, d){
  if (!ch || !ch.rythme) return null;
  if (d && d.type === "Animation") return ch.rythme.items.find(x => x.anim) || null;
  return num ? ch.rythme.items.find(x => x.num === num) || null : null;
}

/* ================= Mini-oral et tutorat (25/11/2026 : Amplification, Statique des fluides, Sources) =================
   Mini-oral : une fois par dossier et par élève, à la fin d'une activité (jamais un TP). L'appli répartit la classe
   (r.oralIdx = rang de l'activité) ; si le corrigé de cette activité est débloqué sans oral, il passe à l'activité suivante.
   Le professeur note r.oral = { niveau: "clair" | "partiel" | "reprendre", act, date }.
   Tutorat (à l'essai) : r.tutorats = [dates], un élève en avance explique une notion à un camarade.
   Les deux alimentent la compétence COM du profil (jamais la note d'investissement). */
export const ORAL_NIVEAUX = { clair: { lib: "Clair", pts: 3 }, partiel: { lib: "Partiel", pts: 1.5 }, reprendre: { lib: "À reprendre", pts: 0 } };
export const oralActs = ch => ch && ch.rythme && ch.rythme.oral ? ch.rythme.items.filter(x => x.corrige && !x.tp && /^activit/i.test(x.num.normalize("NFKD").replace(/[̀-ͯ]/g, ""))) : [];
export function oralCible(ch, r, corrAt){
  const acts = oralActs(ch); r = r || {}; corrAt = corrAt || {};
  if (!acts.length) return null;
  if (r.oral && r.oral.niveau) return { fait: true, niveau: r.oral.niveau, act: r.oral.act };
  if (r.oralIdx == null) return null;
  const i0 = Math.max(0, Math.min(acts.length - 1, +r.oralIdx));
  for (let k = i0; k < acts.length; k++) if (!corrAt[acts[k].corrige]) return { num: acts[k].num, titre: acts[k].titre, corrige: acts[k].corrige, report: k > i0 };
  return { libre: true, report: true };   // toutes les activités corrigées sans oral : à faire avant l'évaluation
}
/* Scores COM pour le profil de compétences : mini-oral (3 / 1,5 / 0) et tutorats (3 chacun, 2 au plus) */
export function comDe(r){
  if (!r) return [];
  const out = [];
  if (r.oral && ORAL_NIVEAUX[r.oral.niveau]) out.push(ORAL_NIVEAUX[r.oral.niveau].pts);
  (r.tutorats || []).slice(0, 2).forEach(() => out.push(3));
  return out;
}
