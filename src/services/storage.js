import { db } from './db'
import { parseNumber, classify } from './fenx2Parser'

// Chantiers
export const addChantier = async (c) => {
  // create chantier and default niveaux (RDC, R+1, R+2, Sous-sol)
  return db.transaction('rw', 'chantiers', 'niveaux', async ()=>{
    const obj = {...c, status: c.status || 'active'}
    const id = await db.chantiers.add(obj)
    const defaults = ['RDC','R+1','R+2','Sous-sol']
    await db.niveaux.bulkAdd(defaults.map(name=> ({ chantierId: id, name })))
    return id
  })
}
export const getChantiers = async (opts = { filter: 'active', sortBy: 'date', sortDir: 'desc' }) => {
  // filter: 'all'|'active'|'archived'|'deleted'
  const all = await db.chantiers.toArray()
  let filtered = all
  if (opts.filter === 'active') filtered = all.filter(c => c && (c.status === undefined || c.status === 'active'))
  else if (opts.filter === 'archived') filtered = all.filter(c => c && c.status === 'archived')
  else if (opts.filter === 'deleted') filtered = all.filter(c => c && c.status === 'deleted')
  // else 'all' -> keep all
  // sorting
  const sortBy = opts.sortBy || 'date'
  const dir = (opts.sortDir || 'desc') === 'asc' ? 1 : -1
  filtered.sort((a, b) => {
    if (sortBy === 'name') {
      const na = String(a?.name || '')
      const nb = String(b?.name || '')
      return na.localeCompare(nb) * dir
    }
    // default: date
    const da = a && a.date ? new Date(a.date).getTime() : 0
    const dbt = b && b.date ? new Date(b.date).getTime() : 0
    return (da - dbt) * dir
  })
  return filtered
}
export const getChantier = async (id) => db.chantiers.get(Number(id))
export const setChantierStatus = async (id, status) => db.chantiers.update(Number(id), { status })
export const archiveChantier = async (id) => setChantierStatus(id, 'archived')
export const deleteChantier = async (id) => setChantierStatus(id, 'deleted')
export const restoreChantier = async (id) => setChantierStatus(id, 'active')
export const searchChantiers = async (q, opts = { filter: 'active' }) => {
  if (!q || !q.trim()) return getChantiers(opts)
  const s = q.trim().toLowerCase()
  const all = await db.chantiers.toArray()
  const filtered = all.filter(c=> String(c.name||'').toLowerCase().includes(s) || String(c.client||'').toLowerCase().includes(s) || String(c.address||'').toLowerCase().includes(s))
  if (opts.filter === 'active') return filtered.filter(c => c && (c.status === undefined || c.status === 'active'))
  if (opts.filter === 'archived') return filtered.filter(c => c && c.status === 'archived')
  if (opts.filter === 'deleted') return filtered.filter(c => c && c.status === 'deleted')
  return filtered
}

// Pieces
export const addPiece = async (p) => db.pieces.add(p)
export const addPieceWithSupports = async (p, createSupports = true) => {
  if (!createSupports) return db.pieces.add(p)
  return db.transaction('rw', 'pieces', 'supports', async ()=>{
    const id = await db.pieces.add(p)
    const defaults = ['Mur A','Mur B','Mur C','Mur D','Plafond']
    await db.supports.bulkAdd(defaults.map(name=> ({ pieceId: id, name })))
    return id
  })
}
export const getPiecesByChantier = async (chantierId) => {
  const arr = await db.pieces.where('chantierId').equals(Number(chantierId)).toArray()
  // sort by niveauId then name
  arr.sort((a,b)=>{
    const na = a.niveauId || 0, nb = b.niveauId || 0
    if (na !== nb) return na - nb
    return String(a.name||'').localeCompare(String(b.name||''))
  })
  return arr
}
export const getPiece = async (id) => db.pieces.get(Number(id))
export const updatePiece = async (id, changes) => db.pieces.update(Number(id), changes)
export const deletePiece = async (id) => db.pieces.delete(Number(id))

// supports
export const addSupport = async (s) => db.supports.add(s)
export const getSupportsByPiece = async (pieceId) => db.supports.where('pieceId').equals(Number(pieceId)).toArray()
export const getSupport = async (id) => db.supports.get(Number(id))
export const updateSupport = async (id, changes) => db.supports.update(Number(id), changes)
export const deleteSupport = async (id) => db.supports.delete(Number(id))

// helper: get all supports for a chantier (pieces list required)
export const getSupportsByChantier = async (chantierId) => {
  const pieces = await getPiecesByChantier(chantierId)
  const ids = pieces.map(p=> p.id)
  if (ids.length === 0) return []
  return db.supports.where('pieceId').anyOf(ids).toArray()
}

// niveaux
export const addNiveau = async (n) => db.niveaux.add(n)
export const getNiveauxByChantier = async (chantierId) => db.niveaux.where('chantierId').equals(Number(chantierId)).sortBy('name')
export const getNiveau = async (id) => db.niveaux.get(Number(id))
export const updateNiveau = async (id, changes) => db.niveaux.update(Number(id), changes)
export const deleteNiveau = async (id) => db.niveaux.delete(Number(id))

// Plan files (images / pdf)
export const addPlanFile = async (fileObj) => db.planFiles.add({ ...fileObj, createdAt: new Date().toISOString() })
export const getPlanFilesByChantier = async (chantierId) => db.planFiles.where('chantierId').equals(Number(chantierId)).reverse().sortBy('createdAt')
export const deletePlanFile = async (id) => db.planFiles.delete(Number(id))
export const updatePlanFile = async (id, changes) => db.planFiles.update(Number(id), changes)

// backups / offline export-import
export const addBackup = async (chantierId, exportObj) => {
  const payload = { chantierId: Number(chantierId), createdAt: new Date().toISOString(), data: exportObj }
  return db.backups.add(payload)
}
export const getBackupsByChantier = async (chantierId) => db.backups.where('chantierId').equals(Number(chantierId)).reverse().sortBy('createdAt')
export const getLastBackup = async (chantierId) => {
  const arr = await getBackupsByChantier(chantierId)
  return (arr && arr.length) ? arr[0] : null
}

export const exportChantierAsObject = async (chantierId) => {
  const chantier = await getChantier(chantierId)
  if (!chantier) throw new Error('Chantier introuvable')
  const niveaux = await getNiveauxByChantier(chantierId)
  const pieces = await getPiecesByChantier(chantierId)
  const supports = await getSupportsByChantier(chantierId)
  const mesures = await getMesuresByChantier(chantierId)
  const plans = await getPlanFilesByChantier(chantierId)
  return { meta: { exportedAt: new Date().toISOString(), app: 'Diag-Plomb', version: 6 }, chantier, niveaux, pieces, supports, mesures, plans }
}

export const exportChantierJSONDownload = async (chantierId) => {
  const obj = await exportChantierAsObject(chantierId)
  // save backup in DB
  try{ await addBackup(chantierId, obj) } catch(e){ console.warn('backup save failed', e) }
  const text = JSON.stringify(obj, null, 2)
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const name = (obj.chantier && obj.chantier.name) ? obj.chantier.name.replace(/[^a-z0-9\-]/gi,'_') : `chantier_${chantierId}`
  a.download = `${name}_backup_${new Date().toISOString().replace(/[:.]/g,'-')}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return true
}

export const importChantierFromObject = async (obj) => {
  // create new chantier and insert related entities, mapping old ids to new ids
  const c = obj.chantier
  const newChantierId = await addChantier({ name: c.name + ' (import)', client: c.client, address: c.address, date: c.date })
  const niveauMap = {}
  if (Array.isArray(obj.niveaux)){
    for (const n of obj.niveaux){
      const nid = await addNiveau({ chantierId: newChantierId, name: n.name })
      niveauMap[n.id] = nid
    }
  }
  const pieceMap = {}
  if (Array.isArray(obj.pieces)){
    for (const p of obj.pieces){
      const toInsert = { chantierId: newChantierId, name: p.name, numUd: p.numUd || '' }
      if (p.niveauId && niveauMap[p.niveauId]) toInsert.niveauId = niveauMap[p.niveauId]
      const pid = await addPiece(toInsert)
      pieceMap[p.id] = pid
    }
  }
  const supportMap = {}
  if (Array.isArray(obj.supports)){
    for (const s of obj.supports){
      const origPid = s.pieceId
      const newPid = pieceMap[origPid]
      if (!newPid) continue
      const sid = await addSupport({ pieceId: newPid, name: s.name })
      supportMap[s.id] = sid
    }
  }
  if (Array.isArray(obj.mesures)){
    for (const m of obj.mesures){
      const toInsert = { ...m }
      delete toInsert.id
      toInsert.chantierId = newChantierId
      if (m.pieceId && pieceMap[m.pieceId]) toInsert.pieceId = pieceMap[m.pieceId]
      else toInsert.pieceId = null
      if (m.supportId && supportMap[m.supportId]) toInsert.supportId = supportMap[m.supportId]
      else toInsert.supportId = null
      try{ await addMesure(toInsert) } catch(e){ console.warn('addMesure failed', e) }
    }
  }
  if (Array.isArray(obj.plans)){
    for (const p of obj.plans){
      const plan = { chantierId: newChantierId, name: p.name, type: p.type, dataUrl: p.dataUrl }
      try{ await addPlanFile(plan) } catch(e){ console.warn('addPlanFile failed', e) }
    }
  }
  return newChantierId
}

export const importChantierJSONFromFile = async (file) => {
  return new Promise((resolve, reject)=>{
    const r = new FileReader()
    r.onload = async (ev)=>{
      try{
        const obj = JSON.parse(ev.target.result)
        const id = await importChantierFromObject(obj)
        resolve(id)
      } catch(err){ reject(err) }
    }
    r.onerror = (e)=> reject(e)
    r.readAsText(file)
  })
}

// autosave (silent: save only to IndexedDB backups, no automatic download)
let _autoSaveTimer = null
export const startAutoSave = (chantierId, intervalMs = 60000) => {
  stopAutoSave()
  if (!chantierId) return
  _autoSaveTimer = setInterval(async ()=>{
    try{
      // assemble export object and save as backup only
      const obj = await exportChantierAsObject(chantierId)
      await addBackup(chantierId, obj)
    } catch(e){ console.warn('autosave failed', e) }
  }, intervalMs)
}
export const stopAutoSave = ()=>{ if (_autoSaveTimer){ clearInterval(_autoSaveTimer); _autoSaveTimer = null } }

// mesures
export const addMesures = async (mesArray) => db.mesures.bulkAdd(mesArray)
export const addMesure = async (m) => db.mesures.add(m)
export const getNextMesureNum = async (chantierId) => {
  const all = await db.mesures.where('chantierId').equals(Number(chantierId)).toArray()
  let max = 0
  for (const m of all){
    const n = Number(m.num)
    if (!isNaN(n) && n > max) max = n
  }
  return max + 1
}
export const getMesuresByChantier = async (chantierId) => {
  const arr = await db.mesures.where('chantierId').equals(Number(chantierId)).toArray()
  arr.sort((a,b)=>{
    const na = parseFloat(a?.num)
    const nb = parseFloat(b?.num)
    if (!isNaN(na) && !isNaN(nb)) return na - nb
    if (!isNaN(na)) return -1
    if (!isNaN(nb)) return 1
    return String(a?.num||'').localeCompare(String(b?.num||''))
  })
  return arr
}
export const getMesure = async (id) => db.mesures.get(Number(id))
export const updateMesure = async (id, changes) => db.mesures.update(Number(id), changes)
export const deleteMesure = async (id) => db.mesures.delete(Number(id))
export const bulkDeleteMesures = async (ids) => Promise.all(ids.map(id => deleteMesure(id)))
export const bulkUpdateMesures = async (items) => {
  // items: [{id, changes}]
  return Promise.all(items.map(it => updateMesure(it.id, it.changes)))
}

export const reclassifyMesuresByChantier = async (chantierId) => {
  const arr = await db.mesures.where('chantierId').equals(Number(chantierId)).toArray()
  const updates = []
  for (const m of arr){
    const Pb_value = parseNumber(m.Pb)
    const classe = classify(Pb_value, m.precision)
    // only update if different
    if (m.Pb_value !== Pb_value || m.classe !== classe){
      updates.push({ id: m.id, changes: { Pb_value, classe } })
    }
  }
  if (updates.length) await bulkUpdateMesures(updates)
  return updates.length
}

export const clearAll = async () => {
  await db.chantiers.clear(); await db.pieces.clear(); await db.mesures.clear();
}
