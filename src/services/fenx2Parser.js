// Simple FenX2 parser: extract expected fields and normalize values

export function parseRows(rows){
  const mesures = []
  for (const r of rows){
    const num = extract(r, ['num','NUM','Num'])
    const numUd = extract(r, ['numUd','num_ud','NUMUD','numUD','num_ud'])
    const PbRaw = extract(r, ['Pb','pb','PB'])
    const precisionRaw = extract(r, ['précision','precision','Prec','PRÉCISION','precision'])
    const date = extract(r, ['date','Date']) || ''
    const livetime = extract(r, ['livetime','liveTime','livetime']) || ''
    const Pb = parseNumber(PbRaw)
    const precision = precisionRaw ? String(precisionRaw) : ''
    const classe = classify(Pb, precision)
    // keep compatibility: add new métier fields with empty defaults
    mesures.push({ num: num ? String(num) : '', numUd: numUd ? String(numUd) : '', Pb: PbRaw ? String(PbRaw) : '', Pb_value: Pb, precision, date, livetime, classe, pieceId: null, zone:'', element:'', substrat:'', revetement:'', etat:'', degradation:'', hauteur:'', point: '' })
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

// Classification rules (configurable):
// - missing Pb -> Classe 1
// - Pb < 1 -> Classe 1
// - 1 <= Pb < 5 -> Classe 1
// - 5 <= Pb < 50 -> Classe 2
// - >=50 -> Classe 3
export function classify(PbValue, precision){
  if (PbValue === null || PbValue === undefined) return 'Classe 1'
  const n = Number(PbValue)
  if (isNaN(n)) return 'Classe 1'
  if (n < 5) return 'Classe 1'
  if (n < 50) return 'Classe 2'
  return 'Classe 3'
}

// Default export mirrors the named exports
export default { parseRows, classify, parseNumber }
