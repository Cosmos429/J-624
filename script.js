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
  $('unitPrice').value = p ? fmt(p[$('unite').value]) + ' Fcfa' : '';
}
$('product').addEventListener('change', majPrix);
$('unite').addEventListener('change', majPrix);

$('addVente').addEventListener('click', () => {
  if (!$('product').value || !$('client').value.trim() || !(parseFloat($('quantity').value) > 0) || !$('sdate').value)
    return msg('Veuillez remplir tous les champs (produit, quantité, client, date).');
  const produit = $('product').value, unite = $('unite').value;
  const qte = parseFloat($('quantity').value);
  const prix = TARIFS[produit][unite];
  ventes.push({
    id: Date.now(), date: $('sdate').value, produit, unite, qte, prix,
    client: $('client').value.trim(), total: prix * qte, paye: $('paye').checked
  });
  save('ventes', ventes);
  $('client').value = ''; $('quantity').value = 1; $('paye').checked = true;
  renderVentes();
  msg('Vente ajoutée.', true);
});

function renderVentes(){
  let paid = 0, pending = 0;
  $('salesTable').innerHTML = ventes.map(v => {
    v.paye ? paid += v.total : pending += v.total;
    return `<tr>
      <td data-label="Date">${esc(v.date)}</td><td data-label="Produit">${esc(v.produit)}</td><td data-label="Quantité">${v.qte} ${esc(uniteDe(v))}</td>
      <td data-label="Prix unitaire">${fmt(v.prix)}</td><td data-label="Client">${esc(v.client)}</td><td data-label="Total">${fmt(v.total)}</td>
      <td data-label="Statut"><button type="button" class="status-btn ${v.paye ? 'status-paid' : 'status-pending'}" onclick="toggleVente(${v.id})">${v.paye ? 'Payé' : 'Non payé'}</button></td>
      <td><button class="del" title="Supprimer" onclick="delVente(${v.id})">🗑</button></td></tr>`;
  }).join('');
  $('totalPaid').textContent = fmt(paid);
  $('totalPending').textContent = fmt(pending);
  $('totalAmount').textContent = fmt(paid + pending);
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
function ligneTotaux(k, o){ return [k, ...CATEGORIES.map(c => dec(o.c[c] || 0))]; }
function totauxPar(cleFn, titre, colonne){
  const m = {};
  ventes.forEach(v => {
    const k = cleFn(v.date);
    m[k] = m[k] || {q: 0, n: 0, c: {}};
    m[k].q += v.qte; m[k].n++;
    m[k].c[v.produit] = (m[k].c[v.produit] || 0) + v.qte;
  });
  return [[''], [titre], [colonne, ...CATEGORIES],
    ...Object.keys(m).sort().map(k => ligneTotaux(k, m[k]))];
}
function exportVentesCSV(){
  const general = {q: 0, n: ventes.length, c: {}};
  ventes.forEach(v => { general.q += v.qte; general.c[v.produit] = (general.c[v.produit] || 0) + v.qte; });
  downloadCSV([['Date','Produit','Quantité','Unité','Prix Unitaire','Client','Total','Statut'],
    ...ventes.map(v => [v.date,v.produit,dec(v.qte),uniteDe(v),v.prix,v.client,v.total,v.paye?'Payé':'Non payé']),
    ...totauxPar(d => d, 'TOTAL PAR JOUR', 'Jour'),
    ...totauxPar(cleSemaine, 'TOTAL PAR SEMAINE', 'Semaine'),
    ...totauxPar(d => d.slice(0, 7), 'TOTAL PAR MOIS', 'Mois'),
    ...CATS_BAS.flatMap(cat => [[''], ['QUANTITÉ VENDUE – ' + cat], ['Jour', 'Quantité'],
      ...qteParCategorie(cat, d => d).map(([k, q]) => [k, dec(q)]),
      [''], ['Semaine', 'Quantité'],
      ...qteParCategorie(cat, cleSemaine).map(([k, q]) => [k, dec(q)])])
    ],
    `Rapport_Ventes_${today()}.csv`);
}

/* Quantité vendue d'une catégorie, regroupée par période (sans totaliser) */
const CATS_BAS = ['Gravier 5-25', 'Gravier 5-15', 'Sable'];
function qteParCategorie(cat, cleFn){
  const m = {};
  ventes.forEach(v => { if (v.produit === cat) { const k = cleFn(v.date); m[k] = (m[k] || 0) + v.qte; } });
  return Object.keys(m).sort().map(k => [k, Math.round(m[k] * 10) / 10]);
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

/* Quantités vendues par catégorie et par période (sans totalisation) */
function feuilleRecap(wb, feuille, titre, nomTable, colonne, cleFn, largeur){
  const m = {};
  ventes.forEach(v => {
    const k = cleFn(v.date);
    m[k] = m[k] || {};
    m[k][v.produit] = (m[k][v.produit] || 0) + v.qte;
  });
  const lignes = Object.keys(m).sort().map(k => [k, ...CATEGORIES.map(c => arr1(m[k][c] || 0))]);
  feuilleTableau(wb, feuille, titre, nomTable, [
    {name:colonne, width:largeur},
    ...CATEGORIES.map(c => ({name:c, width:16, fmt:FMT_QTE}))
  ], lignes, true);
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
      {formula:`C${4 + i}*E${4 + i}`, result:v.total}, v.paye ? 'Payé' : 'Non payé']));
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
    /* Bas de la feuille : quantité vendue par catégorie, par jour et par semaine */
    const bord = {top:BORD, left:BORD, bottom:BORD, right:BORD};
    const entete = c => { c.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FF2C3E50'}};
      c.font = {bold:true, color:{argb:'FFFFFFFF'}}; c.alignment = {horizontal:'center'}; };
    let r = r0 + 4;
    CATS_BAS.forEach(cat => {
      const jours = qteParCategorie(cat, d => d), sem = qteParCategorie(cat, cleSemaine);
      ws.mergeCells(r, 1, r, 7);
      const tt = ws.getCell(r, 1);
      tt.value = 'Quantité vendue – ' + cat;
      tt.font = {bold:true, size:12, color:{argb:'FFFFFFFF'}};
      tt.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FF2980B9'}};
      r++;
      ws.mergeCells(r, 4, r, 6);
      ws.getCell(r, 1).value = 'Jour'; ws.getCell(r, 2).value = 'Quantité';
      ws.getCell(r, 4).value = 'Semaine'; ws.getCell(r, 7).value = 'Quantité';
      [1, 2, 4, 5, 6, 7].forEach(c => { const x = ws.getCell(r, c); entete(x); x.border = bord; });
      r++;
      const n = Math.max(jours.length, sem.length);
      for (let i = 0; i < n; i++, r++) {
        if (jours[i]) {
          const a = ws.getCell(r, 1), b = ws.getCell(r, 2);
          a.value = dateXL(jours[i][0]); a.numFmt = FMT_DATE; a.alignment = {horizontal:'center'};
          b.value = jours[i][1]; b.numFmt = FMT_QTE; b.alignment = {horizontal:'right'};
          a.border = bord; b.border = bord;
        }
        if (sem[i]) {
          ws.mergeCells(r, 4, r, 6);
          const a = ws.getCell(r, 4), b = ws.getCell(r, 7);
          a.value = sem[i][0]; a.alignment = {horizontal:'left'};
          b.value = sem[i][1]; b.numFmt = FMT_QTE; b.alignment = {horizontal:'right'};
          [4, 5, 6, 7].forEach(c => ws.getCell(r, c).border = bord);
        }
      }
      r++;
    });
    feuilleRecap(wb, 'Par jour', 'Total des quantités par jour', 'TableJour', 'Jour', d => d, 16);
    feuilleRecap(wb, 'Par semaine', 'Total des quantités par semaine', 'TableSemaine', 'Semaine', cleSemaine, 40);
    feuilleRecap(wb, 'Par mois', 'Total des quantités par mois', 'TableMois', 'Mois', d => d.slice(0, 7), 14);
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
