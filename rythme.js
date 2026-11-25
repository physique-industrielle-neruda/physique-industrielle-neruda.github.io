/* Rythme individuel du dossier, jauge et note d'investissement (25/11/2026, prototype BTS CIRA « Amplification »).
   Partagé par le site (index.html) et l'appli professeur (prof.html).
   - Durée du dossier = somme des durées indicatives (catalogue : chapitre.rythme.items) + marge (1 h).
   - Temps écoulé = séances cochées par le professeur (« J'ai cours », 1 h ou 2 h), enregistrées dans
     deblocages/rythme_<dossier>_<uid> (un document par élève : seances, evalDate, attitude, ajust).
   - Travail fait : corrigé débloqué (activités, TP, exercices), clic « J'ai lu le cours et fait les exemples »,
     animation terminée, parcours avant l'évaluation terminé.
   - Frein : plus d'1 h d'avance sur le temps écoulé -> la suite (hors TP et cours) attend la prochaine séance.
   - Note /20 : corrigés 8, cours 2, animation 3, régularité 5, attitude 2 (+ ajustement du professeur),
     arrêtée à la fin du jour de l'évaluation. Les coups de pouce ne comptent jamais. */
export const toMs = x => x == null ? null : typeof x === "number" ? x : x.toMillis ? x.toMillis() : x instanceof Date ? x.getTime() : (typeof x === "string" ? Date.parse(x) : null);
export const BAREME = { corriges: 8, cours: 2, anim: 3, regularite: 5, attitude: 2 };
export const coursId = chapId => "rythme-cours:" + chapId;
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
    else if (it.clic) { const v = mp[coursId(chapId)]; if (v && v.termine) { t = toMs(v.date) || now; part = 1; } }
    else if (it.anim) {
      const v = mp["anim:" + chapId], rep = (v && v.reponses) || {};
      const n = Object.values(rep).filter(x => x.ok || x.t >= 2).length, tot = it.questions || 1;
      part = Math.min(1, n / tot); if (part >= 1) t = toMs(v.date) || now;
    }
    else if (it.parcours) { const v = mp["parcours:" + it.parcours]; if (v && v.fini) { t = toMs(v.date) || now; part = 1; } }
    return { ...it, t, part, fait: !!t };
  });
  const contenu = items.reduce((s, x) => s + x.duree, 0), marge = R.marge ?? 1, total = contenu + marge;
  const limite = finJour(r.evalDate);
  const seances = (r.seances || []).map(s => ({ t: toMs(s.t), h: +s.h || 0 })).filter(s => s.t).sort((a, b) => a.t - b.t);
  const ecoule = seances.reduce((s, x) => s + x.h, 0);
  const faitA = t => items.reduce((s, x) => s + (x.t && x.t <= t ? x.duree : 0), 0);
  const fait = faitA(now);
  const retard = Math.min(ecoule, contenu) - fait;
  const statut = retard <= 0 ? "vert" : retard <= 1 ? "orange" : "rouge";
  const avance = fait - ecoule;
  const frein = avance >= marge && ecoule < contenu;
  const reste = Math.max(0, contenu - fait), resteCours = Math.max(0, total - ecoule);
  /* Régularité : à chaque séance, l'élève est-il à jour avant la séance suivante ? (vert 1, orange 0,5, rouge 0) */
  const scores = []; let cum = 0;
  const sv = seances.filter(s => s.t <= limite);
  sv.forEach((s, k) => { cum += s.h; const tn = k + 1 < sv.length ? sv[k + 1].t : Math.min(now, limite);
    const rr = Math.min(cum, contenu) - faitA(tn); scores.push(rr <= 0 ? 1 : rr <= 1 ? 0.5 : 0); });
  const corr = items.filter(x => x.corrige), avant = x => x.t && x.t <= limite;
  const anim = items.find(x => x.anim), cours = items.find(x => x.clic);
  const pts = {
    corriges: corr.length ? BAREME.corriges * corr.filter(avant).length / corr.length : BAREME.corriges,
    cours: cours ? (avant(cours) ? BAREME.cours : 0) : BAREME.cours,
    anim: anim ? BAREME.anim * anim.part : BAREME.anim,
    regularite: scores.length ? BAREME.regularite * scores.reduce((a, b) => a + b, 0) / scores.length : BAREME.regularite,
    attitude: Math.max(0, Math.min(BAREME.attitude, BAREME.attitude + 0.5 * (+r.attitude || 0)))
  };
  const brut = Object.values(pts).reduce((a, b) => a + b, 0) + (+r.ajust || 0);
  const note = Math.max(0, Math.min(20, Math.round(brut * 2) / 2));
  return { items, contenu, marge, total, ecoule, fait, retard, statut, avance, frein, reste, resteCours, seances, scores, pts, note, limite, evalDate: r.evalDate || "" };
}
export const STATUTS = {
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
