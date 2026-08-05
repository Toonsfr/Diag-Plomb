import * as XLSX from 'xlsx'
import { getChantiers, getMesuresByChantier, getPiecesByChantier, getSupportsByChantier, getNiveauxByChantier } from './storage'
import { classify, parseNumber } from './fenx2Parser'

export async function exportAllMesures(){
  try {
    const chantiers = await getChantiers()
    const rows = []
    for (const c of chantiers){
      const part = await buildRowsForChantier(c.id)
      rows.push(...part)
    }

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'mesures')
    const filename = `diag-plomb-export-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.xlsx`
    console.log('Export: writing file', filename, 'rows:', rows.length)
    XLSX.writeFile(wb, filename)
    return filename
  } catch (err){
    console.error('exportAllMesures error', err)
    throw err
  }
}

// Build rows for a single chantier (niveau/piece/supports/measures)
export async function exportChantier(chantierId){
  try {
    const rows = await buildRowsForChantier(chantierId)
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'mesures')
    const filename = `diag-plomb-export-chantier-${chantierId}-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.xlsx`
    console.log('Export: writing file', filename, 'rows:', rows.length)
    XLSX.writeFile(wb, filename)
    return filename
  } catch (err){
    console.error('exportChantier error', err)
    throw err
  }
}

export async function exportLogicielMetierAll(){
  try {
    const chantiers = await getChantiers()
    const rows = []
    for (const c of chantiers){
      const part = await buildLogicielMetierRowsForChantier(c.id)
      rows.push(...part)
    }

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'logiciel_metier')
    const filename = `diag-plomb-export-metier-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.xlsx`
    console.log('Export métier: writing file', filename, 'rows:', rows.length)
    XLSX.writeFile(wb, filename)
    return filename
  } catch (err){
    console.error('exportLogicielMetierAll error', err)
    throw err
  }
}

export async function exportLogicielMetierChantier(chantierId){
  try {
    const rows = await buildLogicielMetierRowsForChantier(chantierId)
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'logiciel_metier')
    const filename = `diag-plomb-export-metier-chantier-${chantierId}-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.xlsx`
    console.log('Export métier: writing file', filename, 'rows:', rows.length)
    XLSX.writeFile(wb, filename)
    return filename
  } catch (err){
    console.error('exportLogicielMetierChantier error', err)
    throw err
  }
}

async function buildRowsForChantier(chantierId){
  const mesures = await getMesuresByChantier(chantierId)
  const pieces = await getPiecesByChantier(chantierId)
  const supports = await getSupportsByChantier(chantierId)
  const niveaux = await getNiveauxByChantier(chantierId)
  const pieceMap = new Map((pieces || []).map(p => [p.id, p.name]))
  const supportMap = new Map((supports || []).map(s => [s.id, s.name]))
  const niveauMap = new Map((niveaux || []).map(n => [n.id, n.name]))
  const rows = []
  const normalizeClasse = (m) => {
    const allowed = ['Classe 1', 'Classe 2', 'Classe 3']
    const direct = String(m?.classe || '').trim()
    if (allowed.includes(direct)) return direct
    const computed = classify(parseNumber(m?.Pb), m?.precision)
    if (allowed.includes(computed)) return computed
    return 'Classe 1'
  }
  for (const m of mesures){
    const piece = pieces.find(p=> p.id === m.pieceId)
    const niveauName = piece ? (niveauMap.get(piece.niveauId) || '') : ''
    rows.push({
      "N° Mesure": m.num,
      "N° Ud": m.numUd || '',
      "Localisation": (niveauName ? niveauName + ' / ' : '') + (pieceMap.get(m.pieceId) || ''),
      "Zone": m.zone || '',
      "Elément": m.element || '',
      "Substrat": m.substrat || '',
      "Revêtement": m.revetement || '',
      "Etat": m.etat || '',
      "Dégradation": m.degradation || '',
      "Résultat": normalizeClasse(m),
      "Pb": m.Pb,
      "Précision": m.precision,
      "Hauteur": m.hauteur || '',
      "Date": m.date,
      "Observations": m.observations || '',
      "Livetime": m.livetime
    })
  }
  return rows
}

async function buildLogicielMetierRowsForChantier(chantierId){
  const mesures = await getMesuresByChantier(chantierId)
  const pieces = await getPiecesByChantier(chantierId)
  const supports = await getSupportsByChantier(chantierId)
  const pieceMap = new Map((pieces || []).map(p => [p.id, p]))
  const supportMap = new Map((supports || []).map(s => [s.id, s.name]))

  const normalizeClasse = (m) => {
    const allowed = ['Classe 1', 'Classe 2', 'Classe 3']
    const direct = String(m?.classe || '').trim()
    if (allowed.includes(direct)) return direct
    const computed = classify(parseNumber(m?.Pb), m?.precision)
    if (allowed.includes(computed)) return computed
    return 'Classe 1'
  }

  const normalizeEtat = (m) => {
    const allowed = ['Non visible', 'Non dégradé', "État d'usage", 'Dégradé']
    const direct = String(m?.etat_conservation || '').trim()
    if (allowed.includes(direct)) return direct
    if (String(m?.etat || '').trim()) return String(m.etat).trim()
    if (m?.degradation) return String(m.degradation).trim()
    return 'Non visible'
  }

  const rows = []
  for (const m of mesures){
    const piece = pieceMap.get(m.pieceId)
    const supportName = supportMap.get(m.supportId) || ''
    rows.push({
      'Pièce': piece?.name || '',
      'Nom UD': m.numUd || '',
      'Partie mesurée': m.point || m.zone || m.element || '',
      'Elément': m.element || '',
      'Support': supportName,
      'Substrat': m.substrat || '',
      'Revêtement apparent': m.revetement || '',
      'Hauteur': m.hauteur || '',
      'Mesure (Pb)': m.Pb || '',
      'Précision': m.precision || '',
      'Etat de conservation': normalizeEtat(m),
      'Classe': normalizeClasse(m),
      'Observations': m.observations || ''
    })
  }

  return rows.map(r => {
    const ordered = {
      'Pièce': r['Pièce'],
      'Nom UD': r['Nom UD'],
      'Partie mesurée': r['Partie mesurée'],
      'Elément': r['Elément'],
      'Support': r['Support'],
      'Substrat': r['Substrat'],
      'Revêtement apparent': r['Revêtement apparent'],
      'Hauteur': r['Hauteur'],
      'Mesure (Pb)': r['Mesure (Pb)'],
      'Précision': r['Précision'],
      'Etat de conservation': r['Etat de conservation'],
      'Classe': r['Classe'],
      'Observations': r['Observations']
    }
    return ordered
  })
}
