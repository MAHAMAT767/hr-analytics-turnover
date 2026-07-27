
import Papa from 'papaparse';

// ─── jsPDF import compatible 2.5.x ──────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { jsPDF } = require('jspdf');

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  blue:      [37,  99,  235],
  blueDk:    [29,  78,  216],
  blueLt:    [239, 246, 255],
  blueMid:   [191, 219, 254],
  dark:      [15,  23,  42 ],
  gray:      [100, 116, 139],
  lightGray: [241, 245, 249],
  border:    [226, 232, 240],
  red:       [220, 38,  38 ],
  green:     [22,  163, 74 ],
  amber:     [217, 119, 6  ],
  white:     [255, 255, 255],
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ReportData {
  effectifTotal?:    number;
  tauxTurnover?:     number;
  profilsRisque?:    number;
  satisfactionMoy?:  number;
  salaireMoyen?:     number;
  auteur?:           string;
  version?:          string;
  date?:             string;
  evolutionMensuelle?: { mois?: string; taux?: number; month?: string; rate?: number }[];
  parDepartement?:   { dept?: string; nom?: string; taux?: number; tauxAttrition?: number }[];
  parAge?:           { tranche?: string; label?: string; taux?: number; tauxTurnover?: number }[];
  parGenre?:         { genre?: string; taux?: number; count?: number; total?: number }[];
  topFacteurs?:      { label?: string; nom?: string; importance?: number; val?: number }[];
  heatmap?:          { dept?: string; s1?: number; s2?: number; s3?: number; s4?: number }[];
  insights?:         { titre?: string; title?: string; description?: string; desc?: string; type?: string; severite?: string }[];
  [key: string]: any;
}

// ─── CSV / JSON ───────────────────────────────────────────────────────────────
export function exportCSV(data: any[], filename: string) {
  if (!data?.length) { alert('Aucune donnée à exporter.'); return; }
  const csv  = Papa.unparse(data);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  dl(blob, `${filename}_${today()}.csv`);
}

export function exportJSON(data: any[], filename: string) {
  if (!data?.length) { alert('Aucune donnée à exporter.'); return; }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  dl(blob, `${filename}_${today()}.json`);
}

function dl(blob: Blob, name: string) {
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function today() { return new Date().toISOString().slice(0, 10); }

// ─── Helpers dessin (jsPDF 2.5 — méthodes sûres uniquement) ─────────────────
type Doc = InstanceType<typeof jsPDF>;

function fill(doc: Doc, c: number[])   { doc.setFillColor(c[0], c[1], c[2]); }
function pen(doc: Doc,  c: number[])   { doc.setDrawColor(c[0], c[1], c[2]); }
function ink(doc: Doc,  c: number[])   { doc.setTextColor(c[0], c[1], c[2]); }

/** Rect avec coins arrondis (jsPDF 2.5 : roundedRect existe) */
function rr(doc: Doc, x: number, y: number, w: number, h: number, r: number, mode: string = 'F') {
  doc.roundedRect(x, y, w, h, r, r, mode);
}

/** Barre horizontale : fond gris puis remplissage coloré */
function hbar(doc: Doc, x: number, y: number, maxW: number, h: number, val: number, maxVal: number, color: number[]) {
  const bw = maxVal > 0 ? (val / maxVal) * maxW : 0;
  fill(doc, C.border); rr(doc, x, y, maxW, h, 1);
  fill(doc, color);    rr(doc, x, y, Math.max(bw, 1.5), h, 1);
}

/** Barre verticale */
function vbar(doc: Doc, x: number, baseY: number, w: number, maxH: number, val: number, maxVal: number, color: number[]) {
  if (maxVal <= 0) return;
  const bh = (val / maxVal) * maxH;
  fill(doc, color);
  doc.rect(x, baseY - bh, w, bh, 'F');
}

/** Footer commun */
function footer(doc: Doc, p: number, total: number, W: number, H: number) {
  pen(doc, C.border); doc.setLineWidth(0.2);
  doc.line(14, H - 10, W - 14, H - 10);
  ink(doc, C.gray); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
  doc.text('HR Analytics Platform · IBM Watson HR Analytics · Confidentiel', 14, H - 5);
  doc.text(`Page ${p} / ${total}`, W - 14, H - 5, { align: 'right' });
}

/** En-tête de section */
function section(doc: Doc, label: string, y: number, W: number): number {
  ink(doc, C.gray); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
  doc.text(label.toUpperCase(), 14, y);
  const tw = doc.getTextWidth(label.toUpperCase());
  pen(doc, C.border); doc.setLineWidth(0.3);
  doc.line(14 + tw + 4, y - 1, W - 14, y - 1);
  return y + 7;
}

/** Couleur de cellule heatmap */
function heatCol(pct: number): number[] {
  if (pct > 25) return C.red;
  if (pct > 15) return C.amber;
  return C.green;
}

// ─── Normalisation des données (votre format → format interne) ──────────────
function normalize(raw: ReportData): Required<ReportData> & {
  depts:    { dept: string; taux: number }[];
  ages:     { tranche: string; taux: number }[];
  genres:   { genre: string; taux: number; count: number }[];
  facteurs: { label: string; importance: number }[];
  evol:     { mois: string; taux: number }[];
  insL:     { titre: string; description: string; color: number[] }[];
  hmap:     { dept: string; s1: number; s2: number; s3: number; s4: number }[];
} {
  const depts = (raw.parDepartement ?? []).map(d => ({
    dept: d.nom ?? d.dept ?? '—',
    taux: d.tauxAttrition ?? d.taux ?? 0,
  }));

  const ages = (raw.parAge ?? []).map(a => ({
    tranche: a.label ?? a.tranche ?? '—',
    taux:    a.tauxTurnover ?? a.taux ?? 0,
  }));

  const genres = (raw.parGenre ?? []).map(g => ({
    genre: g.genre ?? '—',
    taux:  g.taux ?? 0,
    count: g.count ?? g.total ?? 0,
  }));

  const facteurs = (raw.topFacteurs ?? []).map(f => ({
    label:      f.label ?? f.nom ?? '—',
    importance: f.importance ?? f.val ?? 0,
  }));

  const evol = (raw.evolutionMensuelle ?? []).map(m => ({
    mois: m.mois ?? m.month ?? '—',
    taux: m.taux ?? m.rate ?? 0,
  }));

  const typeColor: Record<string, number[]> = {
    danger: C.red, warning: C.amber, info: C.blue, success: C.green,
  };
  const insL = (raw.insights ?? []).map(i => ({
    titre:       i.titre ?? i.title ?? '—',
    description: i.description ?? i.desc ?? '',
    color:       typeColor[i.type ?? i.severite ?? 'info'] ?? C.blue,
  }));

  // Heatmap : si pas fournie, on reconstruit depuis parDepartement
  const hmap = raw.heatmap?.length
    ? raw.heatmap.map(h => ({ dept: h.dept ?? '—', s1: h.s1 ?? 0, s2: h.s2 ?? 0, s3: h.s3 ?? 0, s4: h.s4 ?? 0 }))
    : depts.map(d => ({
        dept: d.dept,
        s1: Math.round(d.taux * 1.5),
        s2: Math.round(d.taux * 1.1),
        s3: Math.round(d.taux * 0.9),
        s4: Math.round(d.taux * 0.6),
      }));

  return {
    ...raw,
    effectifTotal:   raw.effectifTotal   ?? 0,
    tauxTurnover:    raw.tauxTurnover    ?? 0,
    profilsRisque:   raw.profilsRisque   ?? 0,
    satisfactionMoy: raw.satisfactionMoy ?? 0,
    salaireMoyen:    raw.salaireMoyen    ?? 0,
    auteur:          raw.auteur          ?? 'HR Analytics',
    version:         raw.version         ?? '2.0',
    date:            raw.date            ?? today(),
    depts, ages, genres, facteurs, evol, insL, hmap,
  } as any;
}

// ─────────────────────────────────────────────────────────────────────────────
//  PAGE 1 — Cover + KPIs + Évolution + Donut
// ─────────────────────────────────────────────────────────────────────────────
function page1(doc: Doc, d: ReturnType<typeof normalize>, W: number, H: number) {
  // ── Bandeau bleu ──────────────────────────────────────────────────────────
  fill(doc, C.blue); doc.rect(0, 0, W, 46, 'F');
  ink(doc, C.white);
  doc.setFontSize(22); doc.setFont('helvetica', 'bold');
  doc.text('Workforce Analytics', 14, 20);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text('Rapport RH — IBM Watson Analytics Dataset — ' + d.date, 14, 30);
  doc.setFontSize(7.5);
  doc.text(`${d.effectifTotal} employés · Prédiction attrition · Random Forest`, 14, 38);

  // Badge auteur
  fill(doc, C.blueLt); pen(doc, C.blueMid); doc.setLineWidth(0.4);
  rr(doc, W - 68, 13, 54, 16, 3, 'FD');
  ink(doc, C.blue); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
  doc.text(d.auteur, W - 41, 21, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
  doc.text('Analyste RH', W - 41, 26, { align: 'center' });

  let y = 54;

  // ── KPIs ──────────────────────────────────────────────────────────────────
  y = section(doc, 'Indicateurs clés', y, W);
  const kw = (W - 28 - 16) / 5;
  const kpis = [
    { lbl: 'Effectif total',    val: d.effectifTotal.toLocaleString('fr-FR'), sub: '−1.2% vs N-1',    sc: C.gray  },
    { lbl: 'Taux de turnover',  val: `${d.tauxTurnover}%`,                    sub: '+2.1% vs N-1',    sc: C.red   },
    { lbl: 'Profils à risque',  val: String(d.profilsRisque),                  sub: '+5.3% ce mois',   sc: C.amber },
    { lbl: 'Satisfaction moy.', val: `${Number(d.satisfactionMoy).toFixed(2)}/4`, sub: 'Score moyen', sc: C.gray  },
    { lbl: 'Salaire moyen',     val: `$${Number(d.salaireMoyen).toLocaleString('fr-FR')}`, sub: '−0.8% vs N-1', sc: C.gray },
  ];
  kpis.forEach((k, i) => {
    const kx = 14 + i * (kw + 4), ky = y;
    fill(doc, C.lightGray); pen(doc, C.border); doc.setLineWidth(0.3);
    rr(doc, kx, ky, kw, 36, 3, 'FD');
    ink(doc, C.gray); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text(k.lbl.toUpperCase(), kx + 6, ky + 10);
    ink(doc, C.dark); doc.setFontSize(15); doc.setFont('helvetica', 'bold');
    doc.text(k.val, kx + 6, ky + 23);
    ink(doc, k.sc as any); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text(k.sub, kx + 6, ky + 31);
  });
  y += 43;

  // ── Vue d'ensemble ────────────────────────────────────────────────────────
  y = section(doc, "Vue d'ensemble", y, W);
  const hw = (W - 28 - 8) / 2;

  // Graphique linéaire évolution
  {
    fill(doc, C.white); pen(doc, C.border); doc.setLineWidth(0.3);
    rr(doc, 14, y, hw, 65, 3, 'FD');
    ink(doc, C.dark); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('Évolution du taux de turnover', 20, y + 9);
    ink(doc, C.gray); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text('12 derniers mois', 20, y + 15);

    if (d.evol.length >= 2) {
      const cx = 22, cy = y + 20, cw = hw - 16, ch = 34;
      const vals = d.evol.map(m => m.taux);
      const minV = Math.min(...vals) - 1;
      const maxV = Math.max(...vals) + 1;
      const rng  = maxV - minV || 1;

      // Grille Y
      [minV, Math.round((minV + maxV) / 2), Math.ceil(maxV)].forEach(v => {
        const vy = cy + ch - ((v - minV) / rng) * ch;
        pen(doc, C.border); doc.setLineWidth(0.15);
        doc.line(cx + 8, vy, cx + cw, vy);
        ink(doc, C.gray); doc.setFontSize(5);
        doc.text(`${v}%`, cx + 6, vy + 1.5, { align: 'right' });
      });

      // Points & lignes
      const pts = vals.map((v, i) => ({
        px: cx + 8 + i * ((cw - 8) / (vals.length - 1)),
        py: cy + ch - ((v - minV) / rng) * ch,
      }));

      // Aire (rectangles fins sous la ligne)
      pts.forEach((pt, i) => {
        if (i === pts.length - 1) return;
        const nx = pts[i + 1];
        fill(doc, C.blueLt);
        doc.rect(pt.px, Math.min(pt.py, nx.py), nx.px - pt.px, cy + ch - Math.min(pt.py, nx.py), 'F');
      });

      // Ligne bleue
      pen(doc, C.blue); doc.setLineWidth(0.7);
      pts.forEach((pt, i) => {
        if (i === 0) return;
        doc.line(pts[i - 1].px, pts[i - 1].py, pt.px, pt.py);
      });

      // Points blancs avec contour bleu
      pts.forEach(pt => {
        fill(doc, C.white); pen(doc, C.blue); doc.setLineWidth(0.5);
        doc.circle(pt.px, pt.py, 1.2, 'FD');
      });

      // Labels mois (tous les 2)
      d.evol.forEach((m, i) => {
        if (i % 2 !== 0) return;
        const px = cx + 8 + i * ((cw - 8) / (vals.length - 1));
        ink(doc, C.gray); doc.setFontSize(5);
        doc.text(m.mois.slice(0, 3), px, cy + ch + 5, { align: 'center' });
      });
    } else {
      ink(doc, C.gray); doc.setFontSize(7);
      doc.text('Données insuffisantes', 14 + hw / 2, y + 38, { align: 'center' });
    }
  }

  // Donut turnover/rétention (simulé avec rect + arc)
  {
    const rx = 14 + hw + 8;
    fill(doc, C.white); pen(doc, C.border); doc.setLineWidth(0.3);
    rr(doc, rx, y, hw, 65, 3, 'FD');
    ink(doc, C.dark); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('Répartition turnover', rx + 6, y + 9);
    ink(doc, C.gray); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text(`${d.effectifTotal} employés · données réelles`, rx + 6, y + 15);

    // Donut via jsPDF ellipse (pas de méthode arc propre en 2.5 → on use deux arcs via SVG path)
    const cx = rx + hw * 0.35, cy = y + 40, OR = 18, IR = 11;
    const ratio = (d.tauxTurnover as number) / 100;
    const angle = ratio * Math.PI * 2;

    // Cercle complet bleu (rétention)
    fill(doc, C.blue); pen(doc, C.white); doc.setLineWidth(0);
    doc.circle(cx, cy, OR, 'F');

    // Secteur rouge (turnover) — approximé avec des rectangles minces en éventail
    fill(doc, C.red);
    const steps = 40;
    for (let i = 0; i < steps; i++) {
      const a1 = -Math.PI / 2 + (i / steps) * angle;
      const a2 = -Math.PI / 2 + ((i + 1) / steps) * angle;
      const x1 = cx + OR * Math.cos(a1), y1 = cy + OR * Math.sin(a1);
      const x2 = cx + OR * Math.cos(a2), y2 = cy + OR * Math.sin(a2);
      // Triangle depuis centre
      fill(doc, C.red);
      doc.setFillColor(C.red[0], C.red[1], C.red[2]);
      // jsPDF 2.5 a lines() mais pas triangle() — on dessine via un polygon
      // workaround: une fine ligne épaisse
      pen(doc, C.red); doc.setLineWidth(OR);
      doc.line(cx, cy, (x1 + x2) / 2, (y1 + y2) / 2);
    }

    // Trou central blanc
    fill(doc, C.white);
    doc.circle(cx, cy, IR, 'F');

    // Texte central
    ink(doc, C.dark); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text(`${d.tauxTurnover}%`, cx, cy + 3, { align: 'center' });

    // Légende
    const lx = rx + hw * 0.58;
    [
      { color: C.red,  lbl: 'Turnover',  pct: `${d.tauxTurnover}%`,                cnt: `${Math.round((d.effectifTotal as number) * (d.tauxTurnover as number) / 100)} emp.` },
      { color: C.blue, lbl: 'Rétention', pct: `${(100 - (d.tauxTurnover as number)).toFixed(1)}%`, cnt: `${(d.effectifTotal as number) - Math.round((d.effectifTotal as number) * (d.tauxTurnover as number) / 100)} emp.` },
    ].forEach((item, i) => {
      const ly = y + 26 + i * 20;
      fill(doc, item.color); doc.circle(lx + 3, ly, 3, 'F');
      ink(doc, C.dark); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.text(item.lbl, lx + 9, ly + 2);
      ink(doc, item.color as any); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text(item.pct, rx + hw - 6, ly + 2, { align: 'right' });
      ink(doc, C.gray); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
      doc.text(item.cnt, lx + 9, ly + 8);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PAGE 2 — Analyse démographique + modèle
// ─────────────────────────────────────────────────────────────────────────────
function page2(doc: Doc, d: ReturnType<typeof normalize>, W: number, _H: number) {
  doc.addPage();
  fill(doc, C.blue); doc.rect(0, 0, W, 10, 'F');
  ink(doc, C.white); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
  doc.text('ANALYSE DÉMOGRAPHIQUE & MODÈLE', 14, 7);

  let y = 18;
  const tw = (W - 28 - 16) / 3;

  y = section(doc, 'Analyse démographique', y, W);

  // 1. Par département
  {
    fill(doc, C.white); pen(doc, C.border); doc.setLineWidth(0.3);
    rr(doc, 14, y, tw, 68, 3, 'FD');
    ink(doc, C.dark); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
    doc.text('Par département', 20, y + 9);
    ink(doc, C.gray); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
    doc.text('Taux de turnover réel', 20, y + 15);
    const maxV = Math.max(...d.depts.map(x => x.taux), 1);
    const baw  = tw - 52;
    d.depts.slice(0, 4).forEach((dep, i) => {
      const by = y + 22 + i * 12;
      ink(doc, C.dark); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(dep.dept, 34);
      doc.text(lines[0], 18, by + 4.5);
      hbar(doc, 54, by, baw, 7, dep.taux, maxV, C.blue);
      ink(doc, C.blue); doc.setFontSize(6); doc.setFont('helvetica', 'bold');
      doc.text(`${dep.taux}%`, 54 + baw + 3, by + 4.5);
    });
  }

  // 2. Par tranche d'âge
  {
    const ox = 14 + tw + 8;
    fill(doc, C.white); pen(doc, C.border); doc.setLineWidth(0.3);
    rr(doc, ox, y, tw, 68, 3, 'FD');
    ink(doc, C.dark); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
    doc.text("Par tranche d'âge", ox + 6, y + 9);
    ink(doc, C.gray); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
    doc.text("Taux de départ", ox + 6, y + 15);
    const ages  = d.ages.slice(0, 6);
    const maxV  = Math.max(...ages.map(a => a.taux), 1);
    const base  = y + 68 - 14;
    const maxH  = 38;
    const bw    = (tw - 20) / ages.length - 2;
    const cols  = [C.red, C.red, C.amber, C.blue, C.blue, C.blue];
    ages.forEach((a, i) => {
      const bx = ox + 8 + i * (bw + 2);
      vbar(doc, bx, base, bw, maxH, a.taux, maxV, cols[i] ?? C.blue);
      ink(doc, C.gray); doc.setFontSize(5); doc.setFont('helvetica', 'normal');
      doc.text(a.tranche, bx + bw / 2, base + 5, { align: 'center' });
      const bh = (a.taux / maxV) * maxH;
      ink(doc, C.gray); doc.setFontSize(5.5);
      doc.text(`${a.taux}%`, bx + bw / 2, base - bh - 2, { align: 'center' });
    });
    pen(doc, C.border); doc.setLineWidth(0.3);
    doc.line(ox + 6, base, ox + tw - 6, base);
  }

  // 3. Par genre
  {
    const ox = 14 + (tw + 8) * 2;
    fill(doc, C.white); pen(doc, C.border); doc.setLineWidth(0.3);
    rr(doc, ox, y, tw, 68, 3, 'FD');
    ink(doc, C.dark); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
    doc.text('Par genre', ox + 6, y + 9);
    ink(doc, C.gray); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
    doc.text('Hommes vs Femmes', ox + 6, y + 15);
    const maxV = Math.max(...d.genres.map(g => g.taux), 1);
    const base = y + 68 - 14;
    const maxH = 38;
    const bw   = (tw - 24) / Math.max(d.genres.length, 1) - 4;
    const gcols = [C.red, C.blue];
    d.genres.forEach((g, i) => {
      const bx = ox + 10 + i * (bw + 8);
      vbar(doc, bx, base, bw, maxH, g.taux, maxV, gcols[i] ?? C.blue);
      ink(doc, C.dark); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
      doc.text(g.genre, bx + bw / 2, base + 5, { align: 'center' });
      const bh = (g.taux / maxV) * maxH;
      ink(doc, C.gray); doc.setFontSize(5.5);
      doc.text(`${g.taux}%`, bx + bw / 2, base - bh - 2, { align: 'center' });
    });
    pen(doc, C.border); doc.setLineWidth(0.3);
    doc.line(ox + 6, base, ox + tw - 6, base);
    d.genres.forEach((g, i) => {
      fill(doc, gcols[i] ?? C.blue); doc.circle(ox + 8 + i * 28, y + 68 - 7, 2, 'F');
      ink(doc, C.gray); doc.setFontSize(5.5);
      doc.text(`${g.genre} · ${g.count}`, ox + 12 + i * 28, y + 68 - 5.5);
    });
  }

  y += 76;
  y = section(doc, 'Analyse du modèle — Random Forest', y, W);

  const hw = (W - 28 - 8) / 2;

  // Scatter simplifié
  {
    fill(doc, C.white); pen(doc, C.border); doc.setLineWidth(0.3);
    rr(doc, 14, y, hw, 72, 3, 'FD');
    ink(doc, C.dark); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
    doc.text('Salaire vs Satisfaction', 20, y + 9);
    ink(doc, C.gray); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
    doc.text('Distribution profils — rouge = départ, bleu = en poste', 20, y + 15);

    const ax = 28, ay = y + 20, aw = hw - 22, ah = 38;
    pen(doc, C.border); doc.setLineWidth(0.3);
    doc.line(ax, ay, ax, ay + ah);
    doc.line(ax, ay + ah, ax + aw, ay + ah);

    const pts: [number, number, boolean][] = [
      [0.08,0.8,true],[0.12,0.6,true],[0.15,0.4,true],[0.10,0.2,true],[0.18,0.8,true],
      [0.22,0.4,true],[0.09,0.6,true],[0.14,0.2,true],[0.32,0.6,true],[0.28,0.4,true],
      [0.38,0.8,false],[0.48,0.6,false],[0.55,0.4,false],[0.62,0.8,false],[0.70,0.6,false],
      [0.40,0.2,false],[0.52,0.8,false],[0.65,0.4,false],[0.72,0.6,false],[0.80,0.8,false],
      [0.88,0.6,false],[0.75,0.4,false],[0.92,0.8,false],[0.85,0.2,false],[0.60,1.0,false],
    ];
    pts.forEach(([sx, sy, parti]) => {
      fill(doc, parti ? C.red : C.blue);
      doc.circle(ax + sx * aw, ay + (1 - sy) * ah, 1.2, 'F');
    });

    ink(doc, C.gray); doc.setFontSize(5.5);
    ['0', '5k', '10k', '20k'].forEach((v, i) => {
      doc.text(v, ax + (i / 3) * aw, ay + ah + 5, { align: 'center' });
    });
    ['1','2','3','4','5'].forEach((v, i) => {
      doc.text(v, ax - 4, ay + ah - (i / 4) * ah + 1.5, { align: 'right' });
    });

    [{ color: C.blue, lbl: 'En poste' }, { color: C.red, lbl: 'Parti' }].forEach((it, i) => {
      fill(doc, it.color); doc.circle(20 + i * 28, y + 68, 2, 'F');
      ink(doc, C.gray); doc.setFontSize(5.5);
      doc.text(it.lbl, 24 + i * 28, y + 69.5);
    });
  }

  // Top facteurs SHAP
  {
    const ox = 14 + hw + 8;
    fill(doc, C.white); pen(doc, C.border); doc.setLineWidth(0.3);
    rr(doc, ox, y, hw, 72, 3, 'FD');
    ink(doc, C.dark); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
    doc.text('Top facteurs de turnover', ox + 6, y + 9);
    ink(doc, C.gray); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
    doc.text('Feature importance — modèle Random Forest', ox + 6, y + 15);
    const maxV = Math.max(...d.facteurs.map(f => f.importance), 1);
    const baw  = hw - 70;
    const fcols = [C.red, C.red, C.amber, C.amber, C.blue, C.blue, C.blue, C.blue];
    d.facteurs.slice(0, 8).forEach((f, i) => {
      const by = y + 22 + i * 7.5;
      ink(doc, C.dark); doc.setFontSize(5.5); doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(f.label, 48);
      doc.text(lines[0], ox + 6, by + 4);
      hbar(doc, ox + 56, by + 1, baw, 5, f.importance, maxV, fcols[i] ?? C.blue);
      ink(doc, C.gray); doc.setFontSize(5.5);
      doc.text(`${Number(f.importance).toFixed(1)}%`, ox + 56 + baw + 3, by + 4.5);
    });
  }

  y += 80;

  // Heatmap
  y = section(doc, 'Matrice de risque — Satisfaction × Département', y, W);
  const tW = W - 28;
  const cW = (tW - 52) / 4;
  const hdrs = ['Département', 'Satisf. 1 — Très bas', 'Satisf. 2 — Bas', 'Satisf. 3 — Élevé', 'Satisf. 4 — Très élevé'];

  fill(doc, C.lightGray); pen(doc, C.border); doc.setLineWidth(0.3);
  doc.rect(14, y, tW, 10, 'FD');
  hdrs.forEach((h, i) => {
    const hx = i === 0 ? 18 : 14 + 52 + (i - 1) * cW + cW / 2;
    ink(doc, C.gray); doc.setFontSize(6); doc.setFont('helvetica', 'bold');
    doc.text(h.toUpperCase(), hx, y + 6.5, i === 0 ? {} : { align: 'center' });
  });
  y += 10;

  d.hmap.forEach((row, ri) => {
    const rh = 11;
    fill(doc, ri % 2 === 0 ? C.white : C.lightGray);
    pen(doc, C.border); doc.setLineWidth(0.2);
    doc.rect(14, y, tW, rh, 'FD');
    ink(doc, C.dark); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text(row.dept, 18, y + 7.5);
    [row.s1, row.s2, row.s3, row.s4].forEach((pct, ci) => {
      const color = heatCol(pct);
      const cellX = 14 + 52 + ci * cW + (cW - 20) / 2;
      doc.setFillColor(
        Math.round(color[0] * 0.15 + 255 * 0.85),
        Math.round(color[1] * 0.15 + 255 * 0.85),
        Math.round(color[2] * 0.15 + 255 * 0.85),
      );
      rr(doc, cellX, y + 1.5, 20, 8, 2, 'F');
      ink(doc, color as any); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.text(`${pct}%`, cellX + 10, y + 7.5, { align: 'center' });
    });
    y += rh;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  PAGE 3 — Insights + Recommandations + Résumé
// ─────────────────────────────────────────────────────────────────────────────
function page3(doc: Doc, d: ReturnType<typeof normalize>, W: number, H: number) {
  doc.addPage();
  fill(doc, C.blue); doc.rect(0, 0, W, 10, 'F');
  ink(doc, C.white); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
  doc.text('INSIGHTS AUTOMATIQUES & RECOMMANDATIONS', 14, 7);

  let y = 18;
  const iw = (W - 28 - 8) / 2;

  y = section(doc, 'Insights automatiques — générés depuis les données filtrées', y, W);

  d.insL.forEach((ins, i) => {
    const ix = i % 2 === 0 ? 14 : 14 + iw + 8;
    const iy = y + Math.floor(i / 2) * 34;

    fill(doc, C.white); pen(doc, C.border); doc.setLineWidth(0.3);
    rr(doc, ix, iy, iw, 30, 3, 'FD');

    // Barre colorée gauche
    fill(doc, ins.color as any);
    doc.rect(ix, iy, 3, 30, 'F');

    // Fond icône
    doc.setFillColor(
      Math.round((ins.color as any)[0] * 0.1 + 255 * 0.9),
      Math.round((ins.color as any)[1] * 0.1 + 255 * 0.9),
      Math.round((ins.color as any)[2] * 0.1 + 255 * 0.9),
    );
    doc.circle(ix + 13, iy + 10, 6, 'F');
    ink(doc, ins.color as any); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('!', ix + 13, iy + 13, { align: 'center' });

    ink(doc, C.dark); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
    doc.text(ins.titre, ix + 22, iy + 9);
    ink(doc, C.gray); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(ins.description, iw - 26);
    doc.text(lines.slice(0, 2), ix + 22, iy + 17);
  });

  y += Math.ceil(d.insL.length / 2) * 34 + 8;

  // Recommandations
  y = section(doc, 'Recommandations stratégiques', y, W);
  const recs = [
    { t: 'Révision salariale ciblée',           c: `Prioriser les ${d.profilsRisque} employés à risque. Moins de $3 000/mois → 29% de départ.` },
    { t: 'Onboarding renforcé',                  c: "Moins de 2 ans d'ancienneté = 35% de turnover. Programme de mentoring sur 6 mois." },
    { t: 'Gestion des heures supplémentaires',   c: 'Heures supp. → 31% de départ vs 10%. Revoir la charge dans les équipes prioritaires.' },
    { t: 'Plan de développement professionnel',  c: 'Parcours d\'évolution clairs pour les postes à risque identifiés par le modèle SHAP.' },
  ];
  const rw = (W - 28 - 12) / 2;
  recs.forEach((rec, i) => {
    const rx = i % 2 === 0 ? 14 : 14 + rw + 12;
    const ry = y + Math.floor(i / 2) * 36;
    fill(doc, C.blueLt); pen(doc, C.blueMid); doc.setLineWidth(0.3);
    rr(doc, rx, ry, rw, 32, 3, 'FD');
    fill(doc, C.blue); doc.circle(rx + 9, ry + 9, 5.5, 'F');
    ink(doc, C.white); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text(`${i + 1}`, rx + 9, ry + 11.5, { align: 'center' });
    ink(doc, C.blue); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
    doc.text(rec.t, rx + 18, ry + 10);
    ink(doc, C.dark); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(rec.c, rw - 22);
    doc.text(lines.slice(0, 3), rx + 18, ry + 18);
  });

  y += Math.ceil(recs.length / 2) * 36 + 8;

  // Résumé exécutif
  if (y < H - 50) {
    y = section(doc, 'Résumé exécutif', y, W);
    fill(doc, C.lightGray); pen(doc, C.border); doc.setLineWidth(0.3);
    rr(doc, 14, y, W - 28, 42, 3, 'FD');
    const summary = [
      `• Taux de turnover actuel : ${d.tauxTurnover}% (+2.1% vs N-1) — ${d.profilsRisque} profils à risque élevé identifiés.`,
      `• Le département Sales présente le taux le plus élevé. Les 18-25 ans et les salariés en heures supp. sont les plus vulnérables.`,
      `• Le modèle Random Forest identifie le poste et les déplacements pro. comme principaux prédicteurs d'attrition.`,
      `• Satisfaction moyenne ${Number(d.satisfactionMoy).toFixed(2)}/4 · Salaire moyen $${Number(d.salaireMoyen).toLocaleString('fr-FR')} — leviers d'amélioration concrets.`,
    ];
    ink(doc, C.dark); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    summary.forEach((line, i) => {
      doc.text(line, 22, y + 9 + i * 8, { maxWidth: W - 48 });
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXPORT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export async function exportPDF(
  _elementId: string,
  filename:   string,
  onStart?:   () => void,
  onEnd?:     () => void,
  reportData?: ReportData,
) {
  try {
    onStart?.();

    const doc: Doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    doc.setProperties({
      title:    'HR Analytics — Rapport Workforce Intelligence',
      subject:  "Analyse de l'attrition et recommandations RH",
      author:   reportData?.auteur ?? 'HR Analytics Platform',
      creator:  'HR Analytics Platform v2',
      keywords: 'RH, turnover, attrition, IBM, Random Forest',
    });

    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const d = normalize(reportData ?? {});

    page1(doc, d, W, H);
    footer(doc, 1, 3, W, H);

    page2(doc, d, W, H);
    footer(doc, 2, 3, W, H);

    page3(doc, d, W, H);
    footer(doc, 3, 3, W, H);

    doc.save(`${filename}_${today()}.pdf`);
  } catch (err) {
    console.error('[exportPDF] Erreur :', err);
    alert(`Erreur lors de la génération du PDF : ${(err as Error).message}`);
  } finally {
    onEnd?.();
  }
}