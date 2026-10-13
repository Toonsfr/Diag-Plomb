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
    const allowed = ['Classe 0', 'Classe 1', 'Classe 2', 'Classe 3']
    const direct = String(m?.classe || '').trim()
    if (allowed.includes(direct)) return direct
    const computed = classify(parseNumber(m?.Pb), m?.etat_conservation || m?.etat || m?.degradation)
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

// Mapping métier des niveaux
export const NIVEAU_METIER_MAP = {
  'RDC': 'Rez de chaussée',
  'R+1': '1er étage',
  'R+2': '2ème étage',
  'R-1': 'Sous-sol'
}

export function niveauMetier(name){
  const raw = String(name || '').trim()
  if (!raw) return ''
  const key = raw.toUpperCase().replace(/\s+/g, '')
  return NIVEAU_METIER_MAP[key] || raw
}

// L'export reprend tel quel l'état de conservation et la classe de l'application
export const ETAT_CONSERVATION_MAP = [
  { app: 'Non visible', export: 'Non visible', classement: 'Classe 1 (Pb ≥ 1) / Classe 0 (Pb < 1)' },
  { app: 'Non dégradé', export: 'Non dégradé', classement: 'Classe 1 (Pb ≥ 1) / Classe 0 (Pb < 1)' },
  { app: "État d'usage", export: "État d'usage", classement: 'Classe 2 (Pb ≥ 1) / Classe 0 (Pb < 1)' },
  { app: 'Dégradé', export: 'Dégradé', classement: 'Classe 3 (Pb ≥ 1) / Classe 0 (Pb < 1)' }
]

async function buildLogicielMetierRowsForChantier(chantierId){
  const mesures = await getMesuresByChantier(chantierId)
  const pieces = await getPiecesByChantier(chantierId)
  const supports = await getSupportsByChantier(chantierId)
  const niveaux = await getNiveauxByChantier(chantierId)
  const pieceMap = new Map((pieces || []).map(p => [p.id, p]))
  const supportMap = new Map((supports || []).map(s => [s.id, s.name]))
  const niveauMap = new Map((niveaux || []).map(n => [n.id, n.name]))

  const norm = (v) => String(v || '').trim().toLowerCase()
  const strip = (v) => norm(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  const formatPiece = (piece) => {
    if (!piece) return ''
    const level = niveauMetier(niveauMap.get(piece.niveauId) || '')
    return level ? `${level} - ${piece.name || ''}`.trim() : (piece.name || '')
  }

  const normalizeNomUD = (element) => {
    const e = strip(element)
    if (!e) return ''
    if (e.startsWith('mur')) return 'Murs'
    if (e.startsWith('porte')) return 'Huisseries'
    if (e.startsWith('bati')) return 'Huisseries'
    if (e.startsWith('fenetre')) return 'Huisseries'
    if (e.startsWith('volet')) return 'Huisseries'
    if (e.startsWith('sol')) return 'Sol'
    if (e.startsWith('plafond')) return 'Plafonds'
    return ''
  }

  const normalizePartieMesuree = (element) => {
    const e = strip(element)
    if (!e) return ''
    if (e.startsWith('mur')) return 'Murs'
    if (e.startsWith('porte')) return 'Porte'
    if (e.startsWith('bati')) return 'Bâti'
    if (e.startsWith('fenetre')) return 'Fenêtre'
    if (e.startsWith('volet')) return 'Volet'
    return element || ''
  }

  const rows = []
  let idx = 0
  for (const m of mesures){
    const piece = pieceMap.get(m.pieceId)
    const pieceFormatted = formatPiece(piece)
    const pbRaw = m.Pb === null || m.Pb === undefined ? '' : String(m.Pb)
    const hasPb = pbRaw !== ''
    const mesureDlb = hasPb ? pbRaw : '-1'
    // Valeurs saisies/affichées dans l'application, sans recalcul
    const classe = m.classe || m.conservationClass || ''
    const etatUnite = m.etat_conservation || m.etat || ''
    const element = String(m.element || '')
    const hasMeasure = hasPb && String(parseNumber(m.Pb)) !== 'NaN'
    rows.push({
      'id_classement_champs': String(idx++).padStart(5, '0'),
      'CelfComposant': `crep-${chantierId}-${m.id || idx}-${Date.now()}`,
      'Num_mesure': m.num || '',
      'Piece': pieceFormatted,
      'Repere_plan': m.zone || m.point || '',
      'Num_UD': m.numUd || '',
      'Nom_UD': normalizeNomUD(element),
      'Substrat': m.substrat || '',
      'Revetement_apparent': m.revetement || '',
      'Hauteur': m.hauteur || '',
      'Mesure': hasMeasure ? pbRaw : '',
      'Mesure_dlb': mesureDlb,
      'Etat_unite': etatUnite,
      'Type_degradation': m.degradation || '',
      'Classement': classe,
      'Degradation_du_bati': m.degradation || '',
      'Raison_non_mesure': '',
      'Precision_de_la_mesure': m.precision || '',
      'Nature_degradation': m.observations || '',
      'Partie_mesuree': normalizePartieMesuree(element),
      'PourcentDegradation': '',
      'EstURTemoin': 'False',
      'ClefComposantURTemoin': ''
    })
  }

  return rows
}
