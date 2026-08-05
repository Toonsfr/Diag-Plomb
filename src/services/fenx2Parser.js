// Simple FenX2 parser: extract expected fields and normalize values

export function parseRows(rows){
  const mesures = []
  for (const r of rows){
    const num = extract(r, ['num','NUM','Num'])
    const numUd = extract(r, ['numUd','num_ud','NUMUD','numUD','num_ud'])
    const PbRaw = extract(r, ['Pb','pb','PB'])
    const precisionRaw = extract(r, ['précision','precision','Prec','PRÉCISION','precision'])
    const etatConservationRaw = extract(r, ['etat_conservation','Etat de conservation','etat','Etat']) || ''
    const degradationRaw = extract(r, ['degradation','Dégradation']) || ''
    const date = extract(r, ['date','Date']) || ''
    const livetime = extract(r, ['livetime','liveTime','livetime']) || ''
    const Pb = parseNumber(PbRaw)
    const precision = precisionRaw ? String(precisionRaw) : ''
    const classe = classify(Pb, etatConservationRaw || degradationRaw)
    // keep compatibility: add new métier fields with empty defaults
    mesures.push({ num: num ? String(num) : '', numUd: numUd ? String(numUd) : '', Pb: PbRaw ? String(PbRaw) : '', Pb_value: Pb, precision, date, livetime, classe, pieceId: null, zone:'', element:'', substrat:'', revetement:'', etat: etatConservationRaw, degradation: degradationRaw, hauteur:'', point: '' })
  }
  return mesures
}

function extract(obj, keys){
  for (const k of keys){
    if (Object.prototype.hasOwnProperty.call(obj,k) && obj[k] !== undefined && obj[k] !== null) return obj[k]
  }
  // try case-insensitive
  for (const key of Object.keys(obj)){
    if (keys.map(k=>String(k).toLowerCase()).includes(String(key).toLowerCase())) return obj[key]
  }
  return undefined
}

export function parseNumber(v){
  if (v === undefined || v === null) return null
  const s = String(v).replace(',', '.').replace(/[^0-9.-]/g, '').trim()
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function normalizeEtatConservation(etatConservation){
  const norm = String(etatConservation || '').trim().toLowerCase()
  if (!norm) return ''
  if (norm === 'non visible' || norm === 'non visible ' || norm === 'non visible.' || norm === 'non visible/aucun') return 'Non visible'
  if (norm === 'non dégradé' || norm === 'non degrade' || norm === 'non dégradée') return 'Non dégradé'
  if (norm.includes("etat d'usage") || norm.includes('état d\'usage') || norm.includes('etat dusage') || norm.includes('état dusage')) return "État d'usage"
  if (norm === 'dégradé' || norm === 'degrade' || norm.includes('dégrad')) return 'Dégradé'
  return etatConservation
}

// Classification rules (CREP):
// - Pb < 1 mg/cm² => Classe 0
// - Pb >= 1 and state in {Non visible, Non dégradé} => Classe 1
// - Pb >= 1 and state = État d'usage => Classe 2
// - Pb >= 1 and state = Dégradé => Classe 3
// - if state is missing, default to Classe 1 when Pb >= 1
export function classify(PbValue, etatConservation){
  if (PbValue === null || PbValue === undefined) return 'Classe 0'
  const n = Number(PbValue)
  if (isNaN(n) || n < 1) return 'Classe 0'
  const etat = normalizeEtatConservation(etatConservation)
  if (etat === 'Non visible' || etat === 'Non dégradé' || etat === '') return 'Classe 1'
  if (etat === "État d'usage") return 'Classe 2'
  if (etat === 'Dégradé') return 'Classe 3'
  return 'Classe 1'
}

// Default export mirrors the named exports
export default { parseRows, classify, parseNumber }
