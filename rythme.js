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
/* 27/11/2026 : dossier avec travail à la maison (rythme.devoirs) → critère « Maison » /2, pris sur la régularité (5 → 3).
   Apprentis (classes et1a, et2a, élèves inscrits dans deux classes, ou cochés « apprenti » dans l'appli) : même devoir, hors note. */
export const baremeDe = (ch, sansMaison) => { const b = ch && ch.rythme && ch.rythme.items.some(x => x.pdc) ? BAREME_PDC : BAREME;
  return ch && ch.rythme && ch.rythme.devoirs && !sansMaison ? { ...b, regularite: b.regularite - 2, maison: 2 } : b; };
export const CLASSES_APPRENTIS = ["et1a", "et2a"];
export function estApprenti(ch, classe, login, r){
  if (r && r.apprenti != null) return !!r.apprenti;   // réglage du professeur, élève par élève
  const R = (ch && ch.rythme) || {};
  return CLASSES_APPRENTIS.includes(classe) || (R.aussi || []).includes(login);
}
export const devoirId = chapId => "devoir:" + chapId;
/* Absences (27/11/2026) : r.absences = { <séance t>: true }, posé par le professeur après « J'ai cours »
   (l'appli propose « absent ? » pour chaque élève sans aucune trace de travail sur le site pendant la séance).
   Effets : la séance ne compte pas dans sa régularité ; sa jauge continue (la date d'évaluation ne bouge pas) ;
   le devoir de cette séance devient un rattrapage non compté, et le devoir précédent se vérifie à sa séance suivante où il est présent. */
export const absentA = (r, t) => !!(r && r.absences && r.absences[t]);
export const FENETRE_AVANT = 10 * 60e3;   // marge avant le début de la séance
/* Présent pendant la séance (t = fin, h heures) si au moins une trace de travail tombe dans la séance */
export function traceDansSeance(t, h, traces){
  const debut = t - (+h || 1) * 3600e3 - FENETRE_AVANT;
  return traces.some(x => x && x >= debut && x <= t + 5 * 60e3);
}
const finJourMs = t => { const d = new Date(t); d.setHours(23, 59, 59, 999); return d.getTime(); };
/* Travail à la maison (27/11/2026) : statut de chaque devoir donné en fin de séance.
   Le devoir de la séance t se vérifie à la séance de cours suivante (jusqu'à la fin de ce jour-là).
   Automatique quand chaque tâche correspond à une pièce entière suivie par le site (corrigé débloqué, point de cours terminé,
   correction d'exemple ouverte) ; sinon « à vérifier » jusqu'à ce que le professeur choisisse fait / en partie / pas fait.
   Devoirs « avance » (facultatif) et « attente » (rien de nouveau) : jamais comptés. */
export function statutsMaison(items, devDoc, r, seancesCours, now){
  const liste = (devDoc && devDoc.liste) || {}, prof = (r && r.maison) || {}, perso = (r && r.devoirProf) || {};
  const ts = seancesCours.filter(s => !absentA(r, s.t)).map(s => s.t);   // vérification à la séance suivante où l'élève est présent
  /* 27/11/2026 : séance de cours où l'élève était présent sans répondre à « Où t'es-tu arrêté ? » → devoir « pas fait (sans réponse) »
     dès que le professeur coche la séance de cours suivante (une réponse donnée après compte de même) ; modifiable par le professeur. */
  const tous = seancesCours.map(s => s.t).sort((a, b) => a - b);
  const limiteRep = t => tous.find(x => x > t + 60e3) || null;
  const cles = new Set(Object.keys(liste).map(Number).filter(t => t > 0));
  tous.forEach(t => { if (!absentA(r, t) && !perso[t]) cles.add(t); });
  return [...cles].sort((a, b) => a - b).map(t => {
    const sansRep = !liste[t] && !perso[t], lr = limiteRep(t);
    const tard = !sansRep && !perso[t] && lr && (toMs(liste[t].at) || 0) > lr;
    const d = sansRep ? { type: "travail", taches: [], min: 0, sansReponse: true } : { ...liste[t] }, p = perso[t];
    if (p) { d.taches = [{ quoi: p.quoi, min: +p.min || 15, prof: true }]; d.min = +p.min || 15; d.type = "travail"; }
    const abs = absentA(r, t) || d.type === "rattrapage";
    if (abs && d.type === "travail") d.type = "rattrapage";
    const suiv = ts.find(x => x > t + 60e3), evaluable = d.type === "travail";
    let statut = "attente";
    if (!evaluable) statut = abs ? "rattrapage" : "libre";
    else if (prof[t]) statut = prof[t];
    else if (sansRep || tard) statut = lr ? "sansrep" : "attente";
    else if (suiv) {
      const fin = finJourMs(suiv), tch = d.taches || [];
      if (tch.some(x => !x.num || !x.complet)) statut = "verifier";
      else { const ok = tch.filter(x => { const it = items.find(y => y.num === x.num); return it && it.t && it.t <= fin; }).length;
        statut = ok === tch.length ? "fait" : ok ? "partiel" : "non"; }
    }
    return { t, suiv: suiv || ((sansRep || tard) ? lr : null), ...d, statut, evaluable };
  });
}
export const MAISON = { fait: { lib: "Fait", pts: 1, couleur: "#3F7A3A", fond: "#E6F1E3" }, partiel: { lib: "En partie", pts: 0.5, couleur: "#C55A11", fond: "#FBE5D6" },
  non: { lib: "Pas fait", pts: 0, couleur: "#C0392B", fond: "#FBE5E1" }, sansrep: { lib: "Pas fait (sans réponse)", pts: 0, couleur: "#C0392B", fond: "#FBE5E1" }, verifier: { lib: "À vérifier", couleur: "#2E75B6", fond: "#DEEAF6" },
  attente: { lib: "Pour la prochaine séance", couleur: "#5A6577", fond: "#EEF1F5" }, rattrapage: { lib: "Rattrapage (absent)", couleur: "#5A6577", fond: "#EEF1F5" }, libre: { lib: "Non compté", couleur: "#5A6577", fond: "#EEF1F5" } };
export const exemplesId = chapId => "exemples:" + chapId;
export const rythmeDocId = (chapId, uid) => "rythme_" + chapId + "_" + uid;
export const rythmeDoc = chapId => "rythme:" + chapId;
export function heures(h){
  const m = Math.round(Math.max(0, h) * 60), hh = Math.floor(m / 60), mm = m % 60;
  return hh ? hh + " h" + (mm ? " " + String(mm).padStart(2, "0") : "") : mm + " min";
}
export function finJour(iso){ if (!iso) return Infinity; const d = new Date(iso + "T23:59:59"); return isNaN(d) ? Infinity : d.getTime(); }

/* src = { corrAt: {corrigeId: ms}, mp: {pdc: doc pointsdecours}, r: doc rythme (seances, evalDate, ajust, essentiel, maison, devoirProf, apprenti), now, apprenti } */
/* 27/11/2026 : travail DÉCLARÉ en fin de cours (« Où t'es-tu arrêté ? », devoirs.js) — compté dans la jauge ET dans la régularité,
   jamais dans les autres critères de la note (corrigés, cours, animation : vérifié seulement).
   Seules les pièces « papier » (activités, exercices hors TP) peuvent être déclarées : le reste est suivi par le site.
   Pièces avant celle déclarée = faites (attendent la vérification) ; activité en cours = questions avant la question déclarée ;
   exercice « commencé » = moitié ; « fini » ou « j'attends la vérification » = entier. Remplacé par le vérifié dès le corrigé débloqué.
   Garde-fou : le déclaré d'une pièce expire s'il n'est toujours pas vérifié après deux séances de cours où l'élève est présent
   (comptées après la première déclaration de cette pièce). */
function declarations(devDoc){
  const liste = (devDoc && devDoc.liste) || {};
  return Object.keys(liste).map(Number).filter(t => t > 0 && liste[t] && liste[t].arret)
    .map(t => ({ t, at: toMs(liste[t].at) || t, arret: liste[t].arret })).sort((a, b) => a.at - b.at);
}
function partsDecl(items, d, ess, T){
  const fait = x => !!(x.t && x.t <= T);
  const papier = x => !!(x.corrige && !x.tp && !x.parcours && !(ess && x.horsEss));
  const L = items.filter(x => !x.tp && !x.parcours && !(ess && x.horsEss)), arret = d.arret || {};
  let iA = arret.num ? L.findIndex(x => x.num === arret.num) : -1, etatA = arret;
  if (iA < 0 && arret.attente) { iA = L.findIndex(x => papier(x) && !fait(x)); etatA = { etat: "fini" }; }
  const part = new Map(); if (iA < 0) return part;
  L.forEach((x, k) => { if (fait(x) || !papier(x) || k > iA) return;
    if (k < iA) { part.set(x, 1); return; }
    if (x.parties && etatA.q) {
      if (etatA.q === "fini") { part.set(x, 1); return; }
      const qs = []; x.parties.forEach(p => { const q = p.questions && p.questions.length ? p.questions : [p.id + "1"]; q.forEach(y => qs.push({ q: y, min: (+p.min || 0) / q.length })); });
      const tot = qs.reduce((a, y) => a + y.min, 0), i = qs.findIndex(y => y.q === etatA.q);
      if (tot > 0 && i > 0) part.set(x, qs.slice(0, i).reduce((a, y) => a + y.min, 0) / tot);
    }
    else if (etatA.etat === "fini") part.set(x, 1);
    else if (etatA.etat === "commence") part.set(x, 0.5);
  });
  return part;
}
/* Déclaré valable à l'instant T : Map pièce → part (0 à 1). presents = fins des séances de cours où l'élève était présent. */
function declareA(items, decls, ess, T, presents){
  const avant = decls.filter(d => d.at <= T); if (!avant.length) return new Map();
  const part = partsDecl(items, avant[avant.length - 1], ess, T), out = new Map();
  part.forEach((v, x) => {
    const prem = avant.find(d => partsDecl(items, d, ess, T).get(x) > 0);
    const n = presents.filter(t => t > prem.t + 60e3 && t <= T).length;
    if (n < 2) out.set(x, v);
  });
  return out;
}
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
  const verifie = faitA(now);
  /* Jauge = vérifié + déclaré en fin de cours ; régularité et note = vérifié seulement */
  const decls = ch.rythme.devoirs ? declarations(mp[devoirId(chapId)]) : [];
  const presents = seances.filter(s => !absentA(r, s.t)).map(s => s.t);
  const declH = (T, e = ess) => { if (!decls.length) return 0; let h = 0; declareA(items, decls, e, T, presents).forEach((v, x) => { h += v * x.duree; }); return h; };
  const decNow = decls.length ? declareA(items, decls, ess, now, presents) : new Map();
  items.forEach(x => { x.decl = decNow.get(x) || 0; });
  const declare = items.reduce((s, x) => s + x.decl * x.duree, 0);
  const fait = verifie + declare;
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
    if (absentA(r, s.t)) return;   // absent à cette séance : elle ne compte pas dans sa régularité
    const e = ess && s.t >= essDepuis, rr = attendu(cum, e) - faitA(tn, e) - declH(tn, e); scores.push(rr <= 0 ? 1 : rr <= 1 ? 0.5 : 0); });
  const corr = items.filter(x => x.corrige), avant = x => x.t && x.t <= limite;
  const B = baremeDe(ch, !!src.apprenti);
  /* Maison (27/11/2026) : moyenne des devoirs vérifiés avant la fin du jour de l'évaluation (fait 1, en partie ½, pas fait 0) */
  const maison = ch.rythme.devoirs ? statutsMaison(items, mp[devoirId(chapId)], r, seances, now) : [];
  const mv = maison.filter(x => x.evaluable && MAISON[x.statut] && MAISON[x.statut].pts != null && x.t <= limite);
  const anim = items.find(x => x.anim), exs = items.filter(x => x.exemple || x.pdc);   // critère « Cours » : exemples + points de cours en ligne
  const pts = {
    corriges: corr.length ? B.corriges * corr.filter(avant).length / corr.length : B.corriges,
    cours: exs.length ? B.cours * exs.filter(avant).length / exs.length : B.cours,
    anim: anim ? B.anim * anim.part : B.anim,
    regularite: scores.length ? B.regularite * scores.reduce((a, b) => a + b, 0) / scores.length : B.regularite
  };
  if (B.maison) pts.maison = mv.length ? B.maison * mv.reduce((a, x) => a + MAISON[x.statut].pts, 0) / mv.length : B.maison;
  const brut = Object.values(pts).reduce((a, b) => a + b, 0) + (+r.ajust || 0);
  const note = Math.max(0, Math.min(20, Math.round(brut * 2) / 2));
  const absences = seances.filter(s => absentA(r, s.t)).map(s => s.t);
  return { bareme: B, maison, absences, apprenti: !!src.apprenti, toutes, items, contenu, contenuTout, contenuEss, ess, deuxTiers, marge, total, ecoule, fait, verifie, declare, arret: decls.length ? decls[decls.length - 1].arret : null, arretAt: decls.length ? decls[decls.length - 1].at : null, retard, statut, avance, frein, reste, resteCours, seances, scores, pts, note, limite, evalDate: r.evalDate || "" };
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

/* ================= Prévisionnel du dossier (25/11/2026) =================
   À partir du déblocage du dossier, on fait défiler les séances de COURS de la classe lues sur Pronote (jamais les TP,
   ni les cours annulés, ni les absences de classe) jusqu'à couvrir la durée du dossier (travail en autonomie + marge).
   L'évaluation est prévue à la séance de cours suivante. seances = [{ t: début en ms, h: heures, type: "cours" | "tp" }].
   La date saisie par le professeur (evalDate) reste prioritaire. */
/* 27/11/2026 : un créneau Pronote de x h dure x h − 10 min de travail réel (1 h → 50 min, 2 h → 1 h 50) */
export const dureeReelle = h => Math.max(0, (+h || 0) - 1 / 6);
export function prevision(ch, seances, debut){
  const R = ch && ch.rythme; if (!R || !debut || !seances) return null;
  const total = R.items.reduce((s, x) => s + (x.tp ? 0 : x.duree), 0) + (R.marge ?? 1);
  const cours = seances.filter(s => s.type !== "tp" && s.t > debut).sort((a, b) => a.t - b.t);
  let cum = 0, i = 0;
  for (; i < cours.length && cum < total - 1e-6; i++) cum += dureeReelle(cours[i].h);
  if (cum < total - 1e-6) return { total, seances: cours, fin: null, eval: null, n: cours.length };
  const evalS = cours[i] || null;
  return { total, seances: cours.slice(0, i), fin: cours[i - 1].t, eval: evalS ? evalS.t : null, n: i };
}
