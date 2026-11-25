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
   - Note /20 : corrigés 8, cours 2, animation 3, régularité 5, attitude 2 (+ ajustement du professeur),
     arrêtée à la fin du jour de l'évaluation. Les coups de pouce ne comptent jamais. */
export const toMs = x => x == null ? null : typeof x === "number" ? x : x.toMillis ? x.toMillis() : x instanceof Date ? x.getTime() : (typeof x === "string" ? Date.parse(x) : null);
export const BAREME = { corriges: 8, cours: 2, anim: 3, regularite: 5, attitude: 2 };
/* 25/11/2026 : dossier avec points de cours en ligne → corrigés 7, cours 3 (exemples + points de cours) */
export const BAREME_PDC = { corriges: 7, cours: 3, anim: 3, regularite: 5, attitude: 2 };
export const baremeDe = ch => ch && ch.rythme && ch.rythme.items.some(x => x.pdc) ? BAREME_PDC : BAREME;
export const exemplesId = chapId => "exemples:" + chapId;
export const rythmeDocId = (chapId, uid) => "rythme_" + chapId + "_" + uid;
export const rythmeDoc = chapId => "rythme:" + chapId;
export function heures(h){
  const m = Math.round(Math.max(0, h) * 60), hh = Math.floor(m / 60), mm = m % 60;
  return hh ? hh + " h" + (mm ? " " + String(mm).padStart(2, "0") : "") : mm + " min";
}
export function finJour(iso){ if (!iso) return Infinity; const d = new Date(iso + "T23:59:59"); return isNaN(d) ? Infinity : d.getTime(); }

/* src = { corrAt: {corrigeId: ms}, mp: {pdc: doc pointsdecours}, r: doc rythme (seances, evalDate, attitude, ajust), now } */
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
  const contenu = items.reduce((s, x) => s + (x.tp ? 0 : x.duree), 0), marge = R.marge ?? 1, total = contenu + marge;
  const limite = finJour(r.evalDate);
  const toutes = (r.seances || []).map(s => ({ t: toMs(s.t), h: +s.h || 0, tp: !!s.tp })).filter(s => s.t).sort((a, b) => a.t - b.t);
  const seances = toutes.filter(s => !s.tp);   // séances de TP : hors jauge
  const ecoule = seances.reduce((s, x) => s + x.h, 0);
  const faitA = t => items.reduce((s, x) => s + (!x.tp && x.t && x.t <= t ? x.duree : 0), 0);
  const fait = faitA(now);
  const retard = Math.min(ecoule, contenu) - fait;
  const statut = retard < -1e-6 ? "avance" : retard <= 1e-6 ? "vert" : retard <= 1 ? "orange" : "rouge";
  const avance = fait - ecoule;
  const frein = avance >= marge && ecoule < contenu;
  const reste = Math.max(0, contenu - fait), resteCours = Math.max(0, total - ecoule);
  /* Régularité : à chaque séance, l'élève est-il à jour avant la séance suivante ? (vert 1, orange 0,5, rouge 0) */
  const scores = []; let cum = 0;
  const sv = seances.filter(s => s.t <= limite);
  sv.forEach((s, k) => { cum += s.h; const tn = k + 1 < sv.length ? sv[k + 1].t : Math.min(now, limite);
    const rr = Math.min(cum, contenu) - faitA(tn); scores.push(rr <= 0 ? 1 : rr <= 1 ? 0.5 : 0); });
  const corr = items.filter(x => x.corrige), avant = x => x.t && x.t <= limite;
  const B = baremeDe(ch);
  const anim = items.find(x => x.anim), exs = items.filter(x => x.exemple || x.pdc);   // critère « Cours » : exemples + points de cours en ligne
  const pts = {
    corriges: corr.length ? B.corriges * corr.filter(avant).length / corr.length : B.corriges,
    cours: exs.length ? B.cours * exs.filter(avant).length / exs.length : B.cours,
    anim: anim ? B.anim * anim.part : B.anim,
    regularite: scores.length ? B.regularite * scores.reduce((a, b) => a + b, 0) / scores.length : B.regularite,
    attitude: Math.max(0, Math.min(B.attitude, B.attitude + 0.5 * (+r.attitude || 0)))
  };
  const brut = Object.values(pts).reduce((a, b) => a + b, 0) + (+r.ajust || 0);
  const note = Math.max(0, Math.min(20, Math.round(brut * 2) / 2));
  return { bareme: B, toutes, items, contenu, marge, total, ecoule, fait, retard, statut, avance, frein, reste, resteCours, seances, scores, pts, note, limite, evalDate: r.evalDate || "" };
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
