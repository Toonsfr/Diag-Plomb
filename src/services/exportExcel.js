import * as XLSX from 'xlsx'
import { getChantiers, getMesuresByChantier, getPiecesByChantier, getSupportsByChantier, getNiveauxByChantier } from './storage'

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

async function buildRowsForChantier(chantierId){
  const mesures = await getMesuresByChantier(chantierId)
  const pieces = await getPiecesByChantier(chantierId)
  const supports = await getSupportsByChantier(chantierId)
  const niveaux = await getNiveauxByChantier(chantierId)
  const pieceMap = new Map((pieces || []).map(p => [p.id, p.name]))
  const supportMap = new Map((supports || []).map(s => [s.id, s.name]))
  const niveauMap = new Map((niveaux || []).map(n => [n.id, n.name]))
  const rows = []
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
      "Résultat": (m.classe !== undefined ? m.classe : (Number(m.Pb) < 1 ? 0 : 1)),
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
