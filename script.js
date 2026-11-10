/* ---------- Tarifs (issus de SABLES-GRAVIERS.py) ---------- */
const TARIFS = {
  "Gravier 5-15": {"m³":11000,"Tricycle":13000,"Brouette":1500,"Bafana":1000,"Bachet":13000},
  "Gravier 5-25": {"m³":10500,"Tricycle":13000,"Brouette":1500,"Bafana":1000,"Bachet":13000},
  "Sable":        {"m³":8000, "Tricycle":9000, "Brouette":1000,"Bafana":500, "Bachet":9000}
};
const UNITES = Object.keys(TARIFS["Gravier 5-15"]);
/* Unité d'une vente (les anciennes ventes sans unité sont en m³) */
const uniteDe = v => v.unite || ((v.cubage && v.cubage !== '1m3') ? v.cubage : 'm³');

/* ---------- Utilitaires ---------- */
const $ = id => document.getElementById(id);
const fmt = n => Number(n).toLocaleString('fr-FR');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => new Date().toISOString().slice(0,10);
function load(key){ try { return JSON.parse(localStorage.getItem(key)) || []; } catch(e){ return []; } }
function save(key, v){ try { localStorage.setItem(key, JSON.stringify(v)); } catch(e){} }
function downloadCSV(rows, name){
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8'}));
  a.download = name; a.click();
}


/* Messages intégrés (alert/confirm peuvent être bloqués dans certains affichages) */
let toastTimer;
function msg(text, ok){
  const t = document.getElementById('toast');
  t.textContent = text; t.className = 'toast ' + (ok ? 'ok' : 'err'); t.style.display = 'block';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.style.display = 'none', 5000);
  t.onclick = () => t.style.display = 'none';
}
function askConfirm(text, yes){
  const m = document.getElementById('modal');
  document.getElementById('modalTxt').textContent = text; m.style.display = 'flex';
  document.getElementById('modalYes').onclick = () => { m.style.display = 'none'; yes(); };
  document.getElementById('modalNo').onclick = () => m.style.display = 'none';
}

/* ---------- Navigation ---------- */
document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('active', x === b));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === b.dataset.page));
}));

/* ==================== VENTES ==================== */
let ventes = load('ventes');
Object.keys(TARIFS).forEach(p => $('product').insertAdjacentHTML('beforeend', `<option>${p}</option>`));
UNITES.forEach(u => $('unite').insertAdjacentHTML('beforeend', `<option>${u}</option>`));
$('sdate').value = today();

function majPrix(){
  const p = TARIFS[$('product').value];
  /* Pré-remplit avec le tarif officiel (valeur exacte), que l'utilisateur peut ensuite modifier */
  $('unitPrice').value = p ? p[$('unite').value] : '';
  majTotalForm();
}
/* Total en direct = quantité × prix unitaire */
function majTotalForm(){
  const q = parseFloat($('quantity').value), p = parseFloat($('unitPrice').value);
  $('formTotal').value = (q > 0 && p >= 0) ? calcTotal(p, q) : '';
}
$('quantity').addEventListener('input', majTotalForm);
$('unitPrice').addEventListener('input', majTotalForm);
/* Total exact (évite les erreurs de virgule flottante, ex. 11000 × 0,3) */
const calcTotal = (prix, qte) => Math.round(prix * qte * 100) / 100;
$('product').addEventListener('change', majPrix);
$('unite').addEventListener('change', majPrix);

$('addVente').addEventListener('click', () => {
  if (!$('product').value || !$('client').value.trim() || !(parseFloat($('quantity').value) > 0) || !$('sdate').value)
    return msg('Veuillez remplir tous les champs (produit, quantité, client, date).');
  const prix = parseFloat($('unitPrice').value);
  if (!(prix >= 0)) return msg('Veuillez indiquer un prix unitaire valide.');
  /* Le total du formulaire (calculé automatiquement, mais modifiable) fait foi */
  const totalSaisi = parseFloat($('formTotal').value);
  if (!(totalSaisi >= 0)) return msg('Veuillez indiquer un total valide.');
  const produit = $('product').value, unite = $('unite').value;
  const qte = parseFloat($('quantity').value);
  ventes.push({
    id: Date.now(), date: $('sdate').value, produit, unite, qte, prix,
    client: $('client').value.trim(), total: totalSaisi, paye: $('paye').checked
  });
  save('ventes', ventes);
  $('client').value = ''; $('quantity').value = 1; $('paye').checked = true; majPrix();
  renderVentes();
  msg('Vente ajoutée.', true);
});

function renderVentes(){
  let paid = 0, pending = 0;
  $('salesTable').innerHTML = ventes.map(v => {
    v.paye ? paid += v.total : pending += v.total;
    return `<tr>
      <td data-label="Date">${esc(v.date)}</td><td data-label="Produit">${esc(v.produit)}</td><td data-label="Quantité">${v.qte} ${esc(uniteDe(v))}</td>
      <td data-label="Prix unitaire"><input type="number" class="prix-edit" min="0" step="1" value="${v.prix}" title="Modifier le prix unitaire" onchange="editPrix(${v.id}, this.value)"></td><td data-label="Client">${esc(v.client)}</td><td data-label="Total">${fmt(v.total)}</td>
      <td data-label="Statut"><button type="button" class="status-btn ${v.paye ? 'status-paid' : 'status-pending'}" onclick="toggleVente(${v.id})">${v.paye ? 'Payé' : 'Non payé'}</button></td>
      <td><button class="del" title="Supprimer" onclick="delVente(${v.id})">🗑</button></td></tr>`;
  }).join('');
  $('totalPaid').textContent = fmt(paid);
  $('totalPending').textContent = fmt(pending);
  $('totalAmount').textContent = fmt(paid + pending);
}
function editPrix(id, val){
  const v = ventes.find(x => x.id === id), p = parseFloat(val);
  if (!v) return;
  if (!(p >= 0)) { msg('Prix unitaire invalide.'); return renderVentes(); }
  v.prix = p; v.total = calcTotal(p, v.qte);
  save('ventes', ventes); renderVentes(); msg('Prix modifié.', true);
}
function toggleVente(id){ const v = ventes.find(x => x.id === id); if (v){ v.paye = !v.paye; save('ventes', ventes); renderVentes(); } }
function delVente(id){ askConfirm('Supprimer cette vente ?', () => { ventes = ventes.filter(x => x.id !== id); save('ventes', ventes); renderVentes(); }); }
/* Totaux de quantités par jour / semaine (ISO) / mois pour l'export */
const dec = n => String(Math.round(n * 10) / 10).replace('.', ',');
function cleSemaine(d){
  const [y, m, j] = d.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, j)), dow = t.getUTCDay() || 7;
  const jeudi = new Date(t); jeudi.setUTCDate(t.getUTCDate() + 4 - dow);
  const an = jeudi.getUTCFullYear();
  const sem = Math.ceil(((jeudi - Date.UTC(an, 0, 1)) / 864e5 + 1) / 7);
  const lun = new Date(t); lun.setUTCDate(t.getUTCDate() - (dow - 1));
  const dim = new Date(lun); dim.setUTCDate(lun.getUTCDate() + 6);
  const f = x => x.toISOString().slice(0, 10);
  return `${an}-S${String(sem).padStart(2, '0')} (du ${f(lun)} au ${f(dim)})`;
}
const CATEGORIES = ['Sable', 'Gravier 5-25', 'Gravier 5-15'];
/* Total vendu en Fcfa d'une catégorie (toutes unités) */
const totalFcfa = cat => Math.round(ventes.filter(v => v.produit === cat).reduce((a, v) => a + v.total, 0) * 100) / 100;
/* Par catégorie : quantité en m³ (ventes en m³), puis le total vendu en Fcfa en bas de chaque colonne */
function totauxPar(cleFn, titre, colonne){
  const m = {};
  ventes.forEach(v => {
    const k = cleFn(v.date);
    m[k] = m[k] || {};
    if (uniteDe(v) === 'm³') m[k][v.produit] = (m[k][v.produit] || 0) + v.qte;
  });
  return [[''], [titre], [colonne, ...CATEGORIES.map(c => c + ' (m³)')],
    ...Object.keys(m).sort().map(k => [k, ...CATEGORIES.map(c => dec(m[k][c] || 0))]),
    ['TOTAL VENDU (Fcfa)', ...CATEGORIES.map(totalFcfa)]];
}
function exportVentesCSV(){
  downloadCSV([['Date','Produit','Quantité','Unité','Prix Unitaire','Client','Total','Statut'],
    ...ventes.map(v => [v.date,v.produit,dec(v.qte),uniteDe(v),v.prix,v.client,v.total,v.paye?'Payé':'Non payé']),
    ...totauxPar(d => d, 'TOTAL PAR JOUR', 'Jour'),
    ...totauxPar(cleSemaine, 'TOTAL PAR SEMAINE', 'Semaine'),
    ...totauxPar(d => d.slice(0, 7), 'TOTAL PAR MOIS', 'Mois'),
    ...CATS_BAS.flatMap(cat => [[''], ['QUANTITÉ VENDUE – ' + cat],
      ...[['Jour', d => d], ['Semaine', cleSemaine], ['Mois', d => d.slice(0, 7)]].flatMap(([lib, fn]) => [
        [''], [lib, 'Quantité (m³)'],
        ...agregCategorie(cat, fn).map(([k, q]) => [k, dec(q)]),
        ['Total (Fcfa)', totalFcfa(cat)]])])
    ],
    `Rapport_Ventes_${today()}.csv`);
}

/* Pour une catégorie, par période : quantité en m³ (ventes en m³) et total vendu en Fcfa (toutes unités) */
const CATS_BAS = ['Gravier 5-25', 'Gravier 5-15', 'Sable'];
function agregCategorie(cat, cleFn){
  const m = {};
  ventes.forEach(v => {
    if (v.produit !== cat) return;
    const k = cleFn(v.date);
    const o = m[k] = m[k] || {q: 0, t: 0};
    if (uniteDe(v) === 'm³') o.q += v.qte;
    o.t += v.total;
  });
  return Object.keys(m).sort().map(k => [k, Math.round(m[k].q * 10) / 10, Math.round(m[k].t * 100) / 100]);
}

/* ---------- Export Excel (.xlsx) mis en forme ---------- */
const dateXL = s => { const [y, m, j] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, j)); };
const arr1 = n => Math.round(n * 10) / 10;
const FMT_MONTANT = '#,##0', FMT_QTE = '0.0', FMT_DATE = 'dd/mm/yyyy';
const BORD = {style:'thin', color:{argb:'FFBFBFBF'}};

/* Crée une feuille avec titre + vrai tableau Excel (filtres, lignes alternées, ligne de totaux) */
function feuilleTableau(wb, feuille, titre, nomTable, cols, lignes, sansTotaux){
  const ws = wb.addWorksheet(feuille, {views:[{state:'frozen', ySplit:3}]});
  const nc = cols.length, n = lignes.length, h = 3;
  ws.mergeCells(1, 1, 1, nc);
  const t = ws.getCell(1, 1);
  t.value = titre; t.font = {bold:true, size:15, color:{argb:'FF2C3E50'}};
  t.alignment = {vertical:'middle'}; ws.getRow(1).height = 28;
  ws.addTable({
    name: nomTable, ref: 'A' + h, headerRow: true, totalsRow: !sansTotaux,
    style: {theme:'TableStyleMedium2', showRowStripes:true},
    columns: cols.map((c, i) => ({
      name: c.name, filterButton: true,
      ...(sansTotaux ? {} : {
        ...(i === 0 ? {totalsRowLabel:'TOTAL'} : {}),
        ...(c.total ? {totalsRowFunction:'sum'} : (i === 0 ? {} : {totalsRowFunction:'none'}))
      })
    })),
    rows: lignes
  });
  cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.width || 14; });
  for (let r = h; r <= h + n + (sansTotaux ? 0 : 1); r++) {
    for (let c = 1; c <= nc; c++) {
      const cell = ws.getCell(r, c), def = cols[c - 1];
      cell.border = {top:BORD, left:BORD, bottom:BORD, right:BORD};
      if (r === h) {
        cell.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FF2C3E50'}};
        cell.font = {bold:true, color:{argb:'FFFFFFFF'}};
        cell.alignment = {horizontal:'center', vertical:'middle', wrapText:true};
      } else {
        if (def.fmt) cell.numFmt = def.fmt;
        cell.alignment = {horizontal: def.align || (def.fmt && def.fmt !== FMT_DATE ? 'right' : 'left'), vertical:'middle'};
        if (!sansTotaux && r === h + n + 1) {
          cell.font = {bold:true};
          cell.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFE8EEF3'}};
        }
      }
    }
  }
  ws.getRow(h).height = 24;
  return ws;
}
async function telechargerXLSX(wb, nom){
  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  a.download = nom; a.click();
}

/* Par catégorie et par période : quantité en m³, avec le total vendu en Fcfa en bas de chaque colonne */
function feuilleRecap(wb, feuille, titre, nomTable, colonne, cleFn, largeur){
  const m = {};
  ventes.forEach(v => {
    const k = cleFn(v.date);
    m[k] = m[k] || {};
    if (uniteDe(v) === 'm³') m[k][v.produit] = (m[k][v.produit] || 0) + v.qte;
  });
  const lignes = Object.keys(m).sort().map(k => [k, ...CATEGORIES.map(c => arr1(m[k][c] || 0))]);
  const ws = feuilleTableau(wb, feuille, titre, nomTable, [
    {name:colonne, width:largeur},
    ...CATEGORIES.map(c => ({name:c + ' (m³)', width:18, fmt:FMT_QTE}))
  ], lignes, true);
  /* Ligne du bas : total vendu en Fcfa pour chaque catégorie */
  const rf = 3 + lignes.length + 1;
  const fond = {type:'pattern', pattern:'solid', fgColor:{argb:'FFE8EEF3'}};
  const l = ws.getCell(rf, 1);
  l.value = 'TOTAL VENDU (Fcfa)'; l.font = {bold:true}; l.fill = fond; l.border = {top:BORD, left:BORD, bottom:BORD, right:BORD};
  CATEGORIES.forEach((c, i) => {
    const x = ws.getCell(rf, 2 + i);
    x.value = totalFcfa(c); x.numFmt = FMT_MONTANT; x.font = {bold:true, color:{argb:'FF1E8449'}};
    x.fill = fond; x.alignment = {horizontal:'right'}; x.border = {top:BORD, left:BORD, bottom:BORD, right:BORD};
  });
  ws.getColumn(1).width = Math.max(largeur, 20);
}

$('exportVentes').addEventListener('click', async () => {
  if (!ventes.length) return msg('Aucune vente à exporter.');
  if (typeof ExcelJS === 'undefined') { exportVentesCSV(); return msg('Bibliothèque Excel non chargée (connexion internet requise) : export CSV effectué à la place.'); }
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ETS-J624';
    const ws = feuilleTableau(wb, 'Ventes', 'ETS-J624 – Rapport des ventes (édité le ' + new Date().toLocaleDateString('fr-FR') + ')', 'TableVentes', [
      {name:'Date', width:13, fmt:FMT_DATE, align:'center'},
      {name:'Produit', width:18},
      {name:'Quantité', width:12, fmt:FMT_QTE},
      {name:'Unité', width:12, align:'center'},
      {name:'Prix unitaire (Fcfa)', width:16, fmt:FMT_MONTANT},
      {name:'Client', width:24},
      {name:'Total (Fcfa)', width:16, fmt:FMT_MONTANT, total:true},
      {name:'Statut', width:13, align:'center'}
    ], ventes.map((v, i) => [dateXL(v.date), v.produit, arr1(v.qte), uniteDe(v), v.prix, v.client,
      (Math.abs(calcTotal(v.prix, v.qte) - v.total) < 0.005 ? {formula:`ROUND(C${4 + i}*E${4 + i},2)`, result:v.total} : v.total), v.paye ? 'Payé' : 'Non payé']));
    ventes.forEach((v, i) => {
      ws.getCell(4 + i, 8).font = {bold:true, color:{argb: v.paye ? 'FF1E8449' : 'FFC0392B'}};
    });
    const paid = ventes.filter(v => v.paye).reduce((a, v) => a + v.total, 0);
    const pend = ventes.filter(v => !v.paye).reduce((a, v) => a + v.total, 0);
    const r0 = 4 + ventes.length + 2;
    [['Total encaissé', paid, 'FF1E8449'], ['Total impayés', pend, 'FFC0392B']].forEach(([lib, val, col], i) => {
      const l = ws.getCell(r0 + i, 6), c = ws.getCell(r0 + i, 7);
      l.value = lib; l.font = {bold:true}; l.alignment = {horizontal:'right'};
      c.value = val; c.numFmt = FMT_MONTANT; c.font = {bold:true, color:{argb:col}};
    });
    /* Bas de la feuille : par catégorie, quantité (m³) par jour, semaine et mois, avec le total vendu (Fcfa) en bas */
    const bord = {top:BORD, left:BORD, bottom:BORD, right:BORD};
    const entete = c => { c.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FF2C3E50'}};
      c.font = {bold:true, color:{argb:'FFFFFFFF'}}; c.alignment = {horizontal:'center'}; c.border = bord; };
    const nombre = (c, v, f) => { c.value = v; c.numFmt = f; c.alignment = {horizontal:'right'}; c.border = bord; };
    const fond = {type:'pattern', pattern:'solid', fgColor:{argb:'FFE8EEF3'}};
    const totalCell = (c, v) => { nombre(c, v, FMT_MONTANT); c.font = {bold:true, color:{argb:'FF1E8449'}}; c.fill = fond; };
    const libTotal = c => { c.value = 'Total (Fcfa)'; c.font = {bold:true}; c.fill = fond; c.border = bord; };
    let r = r0 + 4;
    CATS_BAS.forEach(cat => {
      const jours = agregCategorie(cat, d => d), sem = agregCategorie(cat, cleSemaine),
            mois = agregCategorie(cat, d => d.slice(0, 7)), tot = totalFcfa(cat);
      ws.mergeCells(r, 1, r, 7);
      const tt = ws.getCell(r, 1);
      tt.value = 'Quantité vendue (m³) – ' + cat;
      tt.font = {bold:true, size:12, color:{argb:'FFFFFFFF'}};
      tt.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FF2980B9'}};
      r++;
      ws.mergeCells(r, 4, r, 6);
      [[1,'Jour'],[2,'Quantité (m³)'],[4,'Semaine'],[7,'Quantité (m³)']].forEach(([c, t]) => { ws.getCell(r, c).value = t; });
      [1, 2, 4, 5, 6, 7].forEach(c => entete(ws.getCell(r, c)));
      r++;
      const n = Math.max(jours.length, sem.length);
      for (let i = 0; i < n; i++, r++) {
        if (jours[i]) {
          const a = ws.getCell(r, 1);
          a.value = dateXL(jours[i][0]); a.numFmt = FMT_DATE; a.alignment = {horizontal:'center'}; a.border = bord;
          nombre(ws.getCell(r, 2), jours[i][1], FMT_QTE);
        }
        if (sem[i]) {
          ws.mergeCells(r, 4, r, 6);
          const a = ws.getCell(r, 4);
          a.value = sem[i][0]; a.alignment = {horizontal:'left'};
          [4, 5, 6].forEach(c => ws.getCell(r, c).border = bord);
          nombre(ws.getCell(r, 7), sem[i][1], FMT_QTE);
        }
      }
      /* Total Fcfa en bas du tableau des jours et du tableau des semaines */
      libTotal(ws.getCell(r, 1)); totalCell(ws.getCell(r, 2), tot);
      ws.mergeCells(r, 4, r, 6); libTotal(ws.getCell(r, 4)); [5, 6].forEach(c => ws.getCell(r, c).border = bord);
      totalCell(ws.getCell(r, 7), tot);
      r += 2;
      [[1,'Mois'],[2,'Quantité (m³)']].forEach(([c, t]) => { const x = ws.getCell(r, c); x.value = t; entete(x); });
      r++;
      mois.forEach(([k, q]) => {
        const a = ws.getCell(r, 1);
        a.value = k; a.alignment = {horizontal:'center'}; a.border = bord;
        nombre(ws.getCell(r, 2), q, FMT_QTE);
        r++;
      });
      libTotal(ws.getCell(r, 1)); totalCell(ws.getCell(r, 2), tot);
      r += 2;
    });
    feuilleRecap(wb, 'Par jour', 'Quantités vendues (m³) par jour', 'TableJour', 'Jour', d => d, 16);
    feuilleRecap(wb, 'Par semaine', 'Quantités vendues (m³) par semaine', 'TableSemaine', 'Semaine', cleSemaine, 40);
    feuilleRecap(wb, 'Par mois', 'Quantités vendues (m³) par mois', 'TableMois', 'Mois', d => d.slice(0, 7), 14);
    await telechargerXLSX(wb, `Rapport_Ventes_${today()}.xlsx`);
    msg('Fichier Excel téléchargé.', true);
  } catch (e) { console.error(e); msg('Erreur lors de la création du fichier Excel.'); }
});

/* ==================== VOYAGES ==================== */
let voyages = load('voyages');
$('vDate').value = today();

const MIN_LIGNES = 1;
const num = v => parseFloat(v) || 0;
function addRow(){
  const n = $('entryBody').rows.length + 1;
  $('entryBody').insertAdjacentHTML('beforeend', `<tr>
    <td class="n" data-label="Ligne">${n}</td>
    <td data-label="Désignation"><input type="text" class="e-design" placeholder="Désignation"></td>
    <td data-label="Client"><input type="text" class="e-client" placeholder="Client"></td>
    <td data-label="Vente (FCFA)"><input type="number" class="e-vente" min="0"></td>
    <td data-label="Gas-oil"><input type="number" class="e-gasoil" min="0"></td>
    <td data-label="Matériel"><input type="number" class="e-mat" min="0"></td>
    <td data-label="Dépenses"><input type="number" class="e-dep" min="0"></td>
    <td>${n > MIN_LIGNES ? '<button type="button" class="del" title="Retirer la ligne" onclick="this.closest(\'tr\').remove();renumber()">✖</button>' : ''}</td></tr>`);
  majCount();
}
function renumber(){ [...$('entryBody').rows].forEach((tr,i) => tr.querySelector('.n').textContent = i+1); majCount(); }
function filledRows(){ return [...$('entryBody').rows].filter(tr => tr.querySelector('.e-design').value.trim() !== ''); }
function majCount(){ const n = filledRows().length; $('vCount').value = n + ' ligne(s) remplie(s) – minimum ' + MIN_LIGNES; }
function initRows(){ $('entryBody').innerHTML = ''; for (let i = 0; i < MIN_LIGNES; i++) addRow(); }
initRows();
$('entryBody').addEventListener('input', majCount);
$('addRow').addEventListener('click', addRow);

$('addTrip').addEventListener('click', () => {
  const date = $('vDate').value;
  if (!date) return msg('Veuillez choisir une date.');
  document.querySelectorAll('#entryBody input').forEach(i => i.style.outline = '');
  const bad = (tr, sel) => { tr.querySelector(sel).style.outline = '2px solid #e74c3c'; };
  // ligne avec des montants mais sans désignation
  for (const tr of $('entryBody').rows) {
    const vide = !tr.querySelector('.e-design').value.trim();
    const aDesValeurs = ['.e-client','.e-vente','.e-gasoil','.e-mat','.e-dep'].some(c => tr.querySelector(c).value.trim() !== '');
    if (vide && aDesValeurs) { bad(tr, '.e-design'); return msg(`Ligne ${tr.querySelector('.n').textContent} : la désignation est manquante.`); }
  }
  const rows = filledRows();
  // chaque désignation doit avoir une vente et un matériel
  for (const tr of rows) {
    const n = tr.querySelector('.n').textContent;
    if (!(num(tr.querySelector('.e-vente').value) > 0)) { bad(tr, '.e-vente'); return msg(`Ligne ${n} : indiquez la vente (supérieure à 0).`); }
    if (tr.querySelector('.e-mat').value.trim() === '') { bad(tr, '.e-mat'); return msg(`Ligne ${n} : indiquez le matériel (0 si aucun).`); }
  }
  if (rows.length < MIN_LIGNES)
    return msg('Saisissez au moins 1 désignation pour cette date avant de valider.');
  const dejaCompte = voyages.some(v => v.date === date);
  rows.forEach((tr, i) => {
    const q = c => tr.querySelector(c).value;
    const vente = num(q('.e-vente'));
    let gasoil = num(q('.e-gasoil')), mat = num(q('.e-mat')), depense = num(q('.e-dep'));
    if ($('chargeUnique').checked && (i > 0 || dejaCompte)) { gasoil = 0; mat = 0; depense = 0; }
    voyages.push({ id: Date.now() + i, date, design: q('.e-design').trim(), client: q('.e-client').trim(),
      vente, gasoil, mat, depense, revenu: vente - (gasoil + mat + depense) });
  });
  save('voyages', voyages);
  initRows();
  renderVoyages();
  msg(`${rows.length} lignes enregistrées pour le ${date}.`, true);
});

function renderVoyages(){
  const t = {vente:0,gasoil:0,mat:0,depense:0,revenu:0};
  let html = '', last = null;
  voyages.forEach(v => {
    if (last !== null && last !== v.date) html += '<tr class="sep"><td colspan="9"></td></tr>';
    last = v.date;
    Object.keys(t).forEach(k => t[k] += v[k]);
    html += `<tr><td data-label="Date">${esc(v.date)}</td><td data-label="Désignation">${esc(v.design)}</td><td data-label="Client">${esc(v.client)}</td>
      <td data-label="Vente">${fmt(v.vente)}</td><td data-label="Gas-oil">${fmt(v.gasoil)}</td><td data-label="Matériel">${fmt(v.mat)}</td><td data-label="Dépenses">${fmt(v.depense)}</td>
      <td data-label="Revenu"><b class="${v.revenu >= 0 ? 'pos' : 'neg'}">${fmt(v.revenu)}</b></td>
      <td><button class="del" title="Supprimer" onclick="delVoyage(${v.id})">🗑</button></td></tr>`;
  });
  $('tripBody').innerHTML = html;
  $('tVente').textContent = fmt(t.vente); $('tGasoil').textContent = fmt(t.gasoil);
  $('tMat').textContent = fmt(t.mat); $('tDep').textContent = fmt(t.depense); $('tRev').textContent = fmt(t.revenu);
}
function delVoyage(id){ askConfirm('Supprimer ce voyage ?', () => { voyages = voyages.filter(x => x.id !== id); save('voyages', voyages); renderVoyages(); }); }
function exportVoyagesCSV(){
  downloadCSV([['Date','Désignation','Client','Vente','Gas-oil','Matériel','Dépenses','Revenu'],
    ...voyages.map(v => [v.date,v.design,v.client,v.vente,v.gasoil,v.mat,v.depense,v.revenu])],
    'ventes_kiosque.csv');
}

$('exportVoyages').addEventListener('click', async () => {
  if (!voyages.length) return msg('Aucun voyage à exporter.');
  if (typeof ExcelJS === 'undefined') { exportVoyagesCSV(); return msg('Bibliothèque Excel non chargée (connexion internet requise) : export CSV effectué à la place.'); }
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ETS-J624';
    feuilleTableau(wb, 'Voyages', 'ETS-J624 – Bilan des voyages (édité le ' + new Date().toLocaleDateString('fr-FR') + ')', 'TableVoyages', [
      {name:'Date', width:13, fmt:FMT_DATE, align:'center'},
      {name:'Désignation', width:26},
      {name:'Client', width:24},
      {name:'Vente (Fcfa)', width:15, fmt:FMT_MONTANT, total:true},
      {name:'Gas-oil', width:13, fmt:FMT_MONTANT, total:true},
      {name:'Matériel', width:13, fmt:FMT_MONTANT, total:true},
      {name:'Dépenses', width:13, fmt:FMT_MONTANT, total:true},
      {name:'Revenu (Fcfa)', width:16, fmt:FMT_MONTANT, total:true}
    ], voyages.map((v, i) => { const r = 4 + i;
      return [dateXL(v.date), v.design, v.client, v.vente, v.gasoil, v.mat, v.depense,
        {formula:`D${r}-(E${r}+F${r}+G${r})`, result:v.revenu}]; }));
    const j = {};
    voyages.forEach(v => { const o = j[v.date] = j[v.date] || {vente:0, gasoil:0, mat:0, depense:0};
      o.vente += v.vente; o.gasoil += v.gasoil; o.mat += v.mat; o.depense += v.depense; });
    feuilleTableau(wb, 'Bilan par jour', 'Bilan journalier des voyages', 'TableBilanJour', [
      {name:'Date', width:13, fmt:FMT_DATE, align:'center'},
      {name:'Vente (Fcfa)', width:15, fmt:FMT_MONTANT, total:true},
      {name:'Gas-oil', width:13, fmt:FMT_MONTANT, total:true},
      {name:'Matériel', width:13, fmt:FMT_MONTANT, total:true},
      {name:'Dépenses', width:13, fmt:FMT_MONTANT, total:true},
      {name:'Revenu (Fcfa)', width:16, fmt:FMT_MONTANT, total:true}
    ], Object.keys(j).sort().map((d, i) => { const o = j[d], r = 4 + i;
      return [dateXL(d), o.vente, o.gasoil, o.mat, o.depense,
        {formula:`B${r}-(C${r}+D${r}+E${r})`, result:o.vente - (o.gasoil + o.mat + o.depense)}]; }));
    await telechargerXLSX(wb, `Bilan_Voyages_${today()}.xlsx`);
    msg('Fichier Excel téléchargé.', true);
  } catch (e) { console.error(e); msg('Erreur lors de la création du fichier Excel.'); }
});

$('salesForm').addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); $('addVente').click(); } });
$('tripForm').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.target.tagName !== 'INPUT' || e.target.type === 'checkbox') return;
  e.preventDefault();
  const f = [...$('tripForm').querySelectorAll('input:not([readonly]):not([type=checkbox])')];
  const nxt = f[f.indexOf(e.target) + 1];
  if (nxt) nxt.focus();
});

renderVentes();
renderVoyages();
