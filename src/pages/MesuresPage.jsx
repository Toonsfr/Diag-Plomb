import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getMesuresByChantier, getChantier, getPiecesByChantier, updateMesure, bulkUpdateMesures, getSupportsByPiece, addMesure, getNextMesureNum, reclassifyMesuresByChantier, getNiveauxByChantier, deleteMesure, bulkDeleteMesures, addSupport } from '../services/storage'
import { classify, parseNumber } from '../services/fenx2Parser'

// MUI
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'

export default function MesuresPage(){
  const { chantierId } = useParams()
  const [mesures, setMesures] = useState([])
  const [chantier, setChantier] = useState(null)
  const [pieces, setPieces] = useState([])
  const [niveaux, setNiveaux] = useState([])
  const [selected, setSelected] = useState({})
  const [rangeInput, setRangeInput] = useState('')
  const [selectedPiece, setSelectedPiece] = useState('')
  const [supportsMap, setSupportsMap] = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const [newMes, setNewMes] = useState({})
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [sortBy, setSortBy] = useState('num')
  const [sortDir, setSortDir] = useState('asc')
  const [visibleColumns, setVisibleColumns] = useState(()=>{
    try{
      const raw = typeof window !== 'undefined' ? localStorage.getItem('mesures_visible_columns') : null
      return raw ? JSON.parse(raw) : { revetement:true, hauteur:true, classe:true, date:false, livetime:false }
    }catch(e){ return { revetement:true, hauteur:true, classe:true, date:false, livetime:false } }
  })
  const toggleVisibleColumn = (col)=>{
    setVisibleColumns(prev => {
      const next = { ...prev, [col]: !prev[col] }
      try{ if (typeof window !== 'undefined') localStorage.setItem('mesures_visible_columns', JSON.stringify(next)) }catch(e){}
      return next
    })
  }

  // auto-create bâti setting
  const [autoCreateBati, setAutoCreateBati] = useState(()=>{
    try{ const raw = typeof window !== 'undefined' ? localStorage.getItem('mesures_auto_create_bati') : null; return raw === null ? true : raw === 'true' }catch(e){ return true }
  })
  const toggleAutoCreateBati = ()=>{
    setAutoCreateBati(v=>{ const nv = !v; try{ localStorage.setItem('mesures_auto_create_bati', String(nv)) }catch(e){}; return nv })
  }

  // configurable lists for selects (persisted in localStorage)
  const [elementsList, setElementsList] = useState(()=>{
    try{
      const raw = typeof window !== 'undefined' ? localStorage.getItem('mesures_elements') : null
      return raw ? JSON.parse(raw) : ['Mur','Plafond','Porte','Fenêtre','Volet','Radiateur']
    }catch(e){ return ['Mur','Plafond','Porte','Fenêtre','Volet','Radiateur'] }
  })
  const [revetementsList, setRevetementsList] = useState(()=>{
    try{ const raw = typeof window !== 'undefined' ? localStorage.getItem('mesures_revetements') : null; return raw ? JSON.parse(raw) : ['Peinture','Enduit','Carrelage','PVC'] }catch(e){ return ['Peinture','Enduit','Carrelage','PVC'] }
  })
  const [substratsList, setSubstratsList] = useState(()=>{
    try{ const raw = typeof window !== 'undefined' ? localStorage.getItem('mesures_substrats') : null; return raw ? JSON.parse(raw) : ['Béton','Bois','Plâtre','Brique'] }catch(e){ return ['Béton','Bois','Plâtre','Brique'] }
  })
  const addToList = (key, value)=>{
    if (!value || !value.trim()) return
    const v = value.trim()
    try{
      if (key === 'elements'){
        if (!elementsList.includes(v)){
          const next = [...elementsList, v]
          setElementsList(next)
          localStorage.setItem('mesures_elements', JSON.stringify(next))
        }
      }
      if (key === 'revetements'){
        if (!revetementsList.includes(v)){
          const next = [...revetementsList, v]
          setRevetementsList(next)
          localStorage.setItem('mesures_revetements', JSON.stringify(next))
        }
      }
      if (key === 'substrats'){
        if (!substratsList.includes(v)){
          const next = [...substratsList, v]
          setSubstratsList(next)
          localStorage.setItem('mesures_substrats', JSON.stringify(next))
        }
      }
    }catch(e){ console.warn('addToList error', e) }
  }

  useEffect(()=>{ load() },[chantierId])

  const deriveEtatConservation = (m)=>{
    // m may have etat and degradation or etat_conservation
    const ec = m.etat_conservation
    if (ec) return ec
    const etat = (m.etat||'').toLowerCase()
    const degr = (m.degradation||'').toLowerCase()
    if (etat === 'non visible' || degr === 'non dégradé' || degr === 'aucune' || degr === 'non degrade' || degr === 'non dégradé') return 'Non visible'
    if (etat.includes("etat d'usage") || etat.includes('état dusage') || etat.includes('etat d\'usage') || etat.includes('état d\'usage')) return "État d'usage"
    if (degr && degr !== 'aucune' && degr !== 'non dégradé' && degr !== 'non degrade') return 'Dégradé'
    // default
    return 'Non visible'
  }

  const getClasseFromEtat = (etat)=>{
    if (!etat) return 'Classe 1'
    const norm = String(etat).trim().toLowerCase()
    if (norm === 'non visible' || norm === 'non dégradé') return 'Classe 1'
    if (norm.includes("etat d'usage") || norm.includes("etat dusage") || norm.includes('etat d\'usage') || norm.includes('état d\'usage')) return 'Classe 2'
    if (norm === 'dégradé' || norm === 'degrade' || norm.includes('dégrad')) return 'Classe 3'
    return 'Classe 1'
  }

  const duplicateMesure = async (m) =>{
    try{
      const next = await getNextMesureNum(chantierId)
      const dup = { ...m }
      delete dup.id
      dup.num = String(next)
      // ensure fields are normalized
      dup.chantierId = Number(chantierId)
      dup.Pb = dup.Pb || ''
      dup.precision = dup.precision || ''
      // derive etat and class
      // prefer explicit etat_conservation label if present, otherwise derive from legacy fields
      dup.etat_conservation = m.etat_conservation || deriveEtatConservation(m)
      dup.conservationClass = getClasseFromEtat(dup.etat_conservation)
      // also set classe (Pb class) if available
      dup.classe = dup.classe || classify(parseNumber(dup.Pb || ''), dup.precision)
      await addMesure(dup)
      load()
      alert('Mesure dupliquée')
    }catch(e){ console.error('duplicateMesure', e); alert('Duplication échouée') }
  }
  const load = async ()=>{
    // ensure measures are reclassified before loading to reflect any changes
    if (chantierId) {
      try{ await reclassifyMesuresByChantier(Number(chantierId)) } catch(e){ /* ignore */ }
    }
    setMesures(await getMesuresByChantier(chantierId))
    setChantier(await getChantier(chantierId))
    const ps = await getPiecesByChantier(chantierId)
    setPieces(ps)
    // load supports for pieces
    const sMap = {}
    await Promise.all(ps.map(async p=>{ sMap[p.id] = await getSupportsByPiece(p.id) }))
    setSupportsMap(sMap)
    // load niveaux
    const nv = await getNiveauxByChantier(chantierId)
    setNiveaux(nv)
    setSelected({})
  }

  const toggle = (id)=> setSelected(s=> ({...s, [id]: !s[id]}))

  const assignSelected = async ()=>{
    if (!selectedPiece) return alert('Choisir une pièce pour affectation')
    const ids = Object.keys(selected).filter(k=> selected[k]).map(k=> Number(k))
    if (ids.length === 0) return alert('Aucune mesure sélectionnée')
    const updates = ids.map(id=> ({id, changes: { pieceId: Number(selectedPiece) }}))
    await bulkUpdateMesures(updates)
    load()
  }

  const assignRange = async ()=>{
    if (!rangeInput || !selectedPiece) return alert('Saisir plage et choisir pièce')
    // parse formats like "197-210" or "197 à 210"
    const m = rangeInput.match(/(\d+)\s*(?:[-àto]+)\s*(\d+)/i)
    if (!m) return alert('Plage non reconnue. Ex: 197-210')
    const start = Number(m[1]), end = Number(m[2])
    const toUpdate = mesures.filter(ms=> {
      const n = Number(ms.num)
      return !isNaN(n) && n >= start && n <= end
    })
    if (toUpdate.length === 0) return alert('Aucune mesure dans la plage')
    const updates = toUpdate.map(ms=> ({id: ms.id, changes: { pieceId: Number(selectedPiece) }}))
    await bulkUpdateMesures(updates)
    setRangeInput('')
    load()
  }

  const assignSingle = async (id, pieceId) =>{
    await updateMesure(id, { pieceId: pieceId ? Number(pieceId) : null, supportId: null })
    load()
  }

  const assignSupport = async (id, supportId) =>{
    await updateMesure(id, { supportId: supportId ? Number(supportId) : null })
    load()
  }

  const saveNewMes = async ()=>{
    try{
      if (!chantierId) return alert('Sélectionner un chantier')
      // determine num
      let num = newMes.num && String(newMes.num).trim()
      if (!num){
        const next = await getNextMesureNum(chantierId)
        num = String(next)
      }

      const Pb_value = parseNumber(newMes.Pb)
      const classe = classify(Pb_value, newMes.precision)
      const etat_conservation = newMes.etat_conservation || deriveEtatConservation(newMes)
      // derive conservation class mapping
      let conservationClass = 'Classe 1'
      if (etat_conservation === 'Non visible' || etat_conservation === 'Non dégradé') conservationClass = 'Classe 1'
      else if (etat_conservation === "État d'usage") conservationClass = 'Classe 2'
      else if (etat_conservation === 'Dégradé') conservationClass = 'Classe 3'

      // Auto-increment named elements and create matching "Bâti X" support when relevant
      const autoElements = ['Porte','Fenêtre','Volet','Radiateur']
      let elementFinal = newMes.element || ''
      const baseMatch = (elementFinal || '').trim().match(/^(\D+?)\s*(\d+)?$/)
      const baseName = baseMatch ? baseMatch[1].trim() : elementFinal
      if (autoElements.includes(baseName)){
        // compute next index based on existing mesures for this chantier
        const existing = mesures.filter(ms => ms.element && String(ms.element).startsWith(baseName + ' '))
        let max = 0
        existing.forEach(ms => {
          const m = String(ms.element).match(/(\d+)$/)
          if (m) max = Math.max(max, Number(m[1]))
        })
        const nextIndex = max + 1 || 1
        elementFinal = `${baseName} ${nextIndex}`
      }

      const mesData = {
        chantierId: Number(chantierId),
        pieceId: newMes.pieceId ? Number(newMes.pieceId) : null,
        supportId: newMes.supportId ? Number(newMes.supportId) : null,
        num,
        numUd: newMes.numUd || '',
        Pb: newMes.Pb ? String(newMes.Pb) : '',
        Pb_value,
        precision: newMes.precision || '',
        date: newMes.date || '',
        livetime: newMes.livetime || '',
        point: newMes.point || '',
        observations: newMes.observations || '',
        zone: newMes.zone || '',
        element: elementFinal,
        substrat: newMes.substrat || '',
        revetement: newMes.revetement || '',
        etat_conservation,
        conservationClass,
        hauteur: newMes.hauteur || '',
        classe
      }

      // if we generated an element like "Porte N", create or attach a matching "Bâti N" support for the piece
      if (mesData.pieceId && elementFinal){
        const m = elementFinal.match(/^(\D+?)\s*(\d+)$/)
        if (m){
          const number = m[2]
          const frameName = `Bâti ${number}`
          try{
            const supports = await getSupportsByPiece(mesData.pieceId)
            const existing = supports.find(s => String(s.name).trim().toLowerCase() === frameName.toLowerCase())
            if (existing){
              mesData.supportId = existing.id
            } else {
              // create support
              try{
                const sid = await addSupport({ pieceId: mesData.pieceId, name: frameName })
                mesData.supportId = sid
                // refresh supportsMap for UI
                setSupportsMap(sm => ({ ...sm, [mesData.pieceId]: [...(sm[mesData.pieceId]||[]), { id: sid, name: frameName }] }))
              }catch(e){ console.warn('create support failed', e) }
            }
          }catch(e){ console.warn('getSupportsByPiece failed', e) }
        }
      }

      if (editingId) {
        await updateMesure(editingId, mesData)
        alert('Mesure mise à jour')
      } else {
        await addMesure(mesData)
        alert('Mesure ajoutée')
      }
      setShowAdd(false)
      setNewMes({})
      setEditingId(null)
      load()
    } catch(err){ console.error('saveNewMes error', err); alert('Erreur ajout/mise à jour mesure') }
  }

  const toggleSort = (col)=>{
    if (sortBy === col) setSortDir(d=> d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const sortedMesures = [...mesures].sort((a,b)=>{
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortBy === 'num'){
      const na = parseFloat(a?.num); const nb = parseFloat(b?.num)
      if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir
      return String(a?.num||'').localeCompare(String(b?.num||'')) * dir
    }
    if (sortBy === 'piece'){
      const pa = pieces.find(p=> p.id === a.pieceId)?.name || ''
      const pb = pieces.find(p=> p.id === b.pieceId)?.name || ''
      return String(pa).localeCompare(String(pb)) * dir
    }
    if (sortBy === 'Pb'){
      const pa = parseFloat(a.Pb); const pb = parseFloat(b.Pb)
      if (!isNaN(pa) && !isNaN(pb)) return (pa - pb) * dir
      return String(a.Pb||'').localeCompare(String(b.Pb||'')) * dir
    }
    if (sortBy === 'classe'){
      const ca = String(a.classe || classify(a.Pb_value, a.precision))
      const cb = String(b.classe || classify(b.Pb_value, b.precision))
      return ca.localeCompare(cb) * dir
    }
    return 0
  })

  return (
    <div>
      <h2>Mesures — {chantier?.name}</h2>

      <div style={{marginBottom:12}}>
        <Button variant="contained" onClick={async ()=>{
          // prefill next number for new measure
          setEditingId(null)
          try{
            const next = await getNextMesureNum(chantierId)
            setNewMes({ num: String(next) })
          } catch(e){ setNewMes({}) }
          setShowAdd(true)
        }}>+ Ajouter une mesure</Button>
      </div>

      <Dialog open={showAdd} onClose={()=>setShowAdd(false)} fullWidth maxWidth="md">
        <DialogTitle>Nouvelle mesure</DialogTitle>
        <DialogContent>
          <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:8}}>
            <TextField label="Numéro" value={newMes.num||''} onChange={e=>setNewMes({...newMes, num: e.target.value})} />
            <FormControl style={{minWidth:160}}>
              <InputLabel>Pièce</InputLabel>
              <Select value={newMes.pieceId||''} label="Pièce" onChange={e=>{ const val = e.target.value; setNewMes({...newMes, pieceId: val?Number(val):'' , supportId: ''}); }}>
                <MenuItem value="">-- Aucune --</MenuItem>
                {pieces.map(p=> <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl style={{minWidth:160}}>
              <InputLabel>Support</InputLabel>
              <Select value={newMes.supportId||''} label="Support" onChange={e=>setNewMes({...newMes, supportId: e.target.value?Number(e.target.value):''})}>
                <MenuItem value="">-- Aucun --</MenuItem>
                {(supportsMap[newMes.pieceId]||[]).map(s=> <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>

            <TextField label="Point de mesure" value={newMes.point||''} onChange={e=>setNewMes({...newMes, point: e.target.value})} />

            {/* Main quick fields: Pb, precision, etat de conservation, observations */}
            <TextField label="Pb" value={newMes.Pb||''} onChange={e=>setNewMes({...newMes, Pb: e.target.value})} />
            <TextField label="Précision" value={newMes.precision||''} onChange={e=>setNewMes({...newMes, precision: e.target.value})} />

            <FormControl style={{minWidth:220}}>
              <InputLabel>État de conservation</InputLabel>
              <Select value={newMes.etat_conservation||''} label="État de conservation" onChange={e=>setNewMes({...newMes, etat_conservation: e.target.value})}>
                <MenuItem value="">--</MenuItem>
                <MenuItem value="Non visible">Non visible</MenuItem>
                <MenuItem value="Non dégradé">Non dégradé</MenuItem>
                <MenuItem value="État d'usage">État d'usage</MenuItem>
                <MenuItem value="Dégradé">Dégradé</MenuItem>
              </Select>
            </FormControl>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <div style={{fontSize:12, color:'#444'}}>Classe :</div>
              <div style={{fontWeight:600}}>{getClasseFromEtat(newMes.etat_conservation || '')}</div>
            </div>
            <TextField label="Observations" value={newMes.observations||''} onChange={e=>setNewMes({...newMes, observations: e.target.value})} />

            <div style={{width:'100%'}}>
              <button onClick={()=>setShowMoreOptions(s=>!s)} style={{marginTop:8}}>{showMoreOptions ? '▲ Moins d\'options' : '▼ Plus d\'options'}</button>
              <button onClick={()=>{
                // prefill next num and open dialog for double mesure creation
                setEditingId(null)
                try{ getNextMesureNum(chantierId).then(n=> setNewMes(m=> ({ ...m, num: String(n) }))) }catch(e){}
              }} style={{marginLeft:12}}>⚡ Double mesure</button>
              <button onClick={async ()=>{
                // create two mesures now
                try{
                  if (!chantierId) return alert('Sélectionner un chantier')
                  const base = { ...newMes }
                  // compute two nums
                  const n1 = await getNextMesureNum(chantierId)
                  const n2 = await getNextMesureNum(chantierId)
                  const etat = base.etat_conservation || deriveEtatConservation(base)
                  const classeEtat = getClasseFromEtat(etat)
                  const mesCommon = {
                    chantierId: Number(chantierId),
                    pieceId: base.pieceId ? Number(base.pieceId) : null,
                    supportId: base.supportId ? Number(base.supportId) : null,
                    point: base.point || '',
                    observations: base.observations || '',
                    zone: base.zone || '',
                    element: base.element || '',
                    substrat: base.substrat || '',
                    revetement: base.revetement || '',
                    etat_conservation: etat,
                    conservationClass: classeEtat,
                    hauteur: base.hauteur || ''
                  }
                  // elements with suffixes
                  const elBase = (base.element || '').trim()
                  const el1 = elBase ? `${elBase} - Mesure 1` : ''
                  const el2 = elBase ? `${elBase} - Mesure 2` : ''
                  await addMesure({ ...mesCommon, num: String(n1), element: el1 })
                  await addMesure({ ...mesCommon, num: String(n2), element: el2 })
                  alert('Deux mesures créées')
                  setShowAdd(false); setNewMes({}); load()
                }catch(e){ console.error('double mesure', e); alert('Échec création double mesure') }
              }} style={{marginLeft:8}}>⚡ Créer les 2 mesures</button>
            </div>
 
            {showMoreOptions && (
              <>
                {/* métier dropdowns */}
                <FormControl style={{minWidth:160}}>
                  <InputLabel>Zone</InputLabel>
                  <Select value={newMes.zone||''} label="Zone" onChange={e=>setNewMes({...newMes, zone: e.target.value})}>
                    <MenuItem value="">--</MenuItem>
                    <MenuItem value="Zone 1">Zone 1</MenuItem>
                    <MenuItem value="Zone 2">Zone 2</MenuItem>
                    <MenuItem value="Zone 3">Zone 3</MenuItem>
                  </Select>
                </FormControl>
                <FormControl style={{minWidth:160}}>
                  <InputLabel>Élément</InputLabel>
                  <Select value={newMes.element||''} label="Élément" onChange={e=>{
                    const val = e.target.value
                    if (val === '__add__'){
                      const name = prompt('Ajouter nouvel élément:')
                      if (name) { addToList('elements', name); setNewMes({...newMes, element: name}) }
                    } else {
                      setNewMes({...newMes, element: val})
                    }
                  }}>
                    <MenuItem value="">--</MenuItem>
                    {elementsList.map(el => <MenuItem key={el} value={el}>{el}</MenuItem>)}
                    <MenuItem value="__add__">➕ Ajouter manuellement</MenuItem>
                  </Select>
                </FormControl>
                <FormControl style={{minWidth:160}}>
                  <InputLabel>Substrat</InputLabel>
                  <Select value={newMes.substrat||''} label="Substrat" onChange={e=>{
                    const val = e.target.value
                    if (val === '__add__'){
                      const name = prompt('Ajouter nouveau substrat:')
                      if (name) { addToList('substrats', name); setNewMes({...newMes, substrat: name}) }
                    } else setNewMes({...newMes, substrat: val})
                  }}>
                    <MenuItem value="">--</MenuItem>
                    {substratsList.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    <MenuItem value="__add__">➕ Ajouter manuellement</MenuItem>
                  </Select>
                </FormControl>
                <FormControl style={{minWidth:160}}>
                  <InputLabel>Revêtement</InputLabel>
                  <Select value={newMes.revetement||''} label="Revêtement" onChange={e=>{
                    const val = e.target.value
                    if (val === '__add__'){
                      const name = prompt('Ajouter nouveau revêtement:')
                      if (name) { addToList('revetements', name); setNewMes({...newMes, revetement: name}) }
                    } else setNewMes({...newMes, revetement: val})
                  }}>
                    <MenuItem value="">--</MenuItem>
                    {revetementsList.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                    <MenuItem value="__add__">➕ Ajouter manuellement</MenuItem>
                  </Select>
                </FormControl>
                <TextField label="Hauteur (m)" value={newMes.hauteur||''} onChange={e=>setNewMes({...newMes, hauteur: e.target.value})} />
                <TextField label="Date" value={newMes.date||''} onChange={e=>setNewMes({...newMes, date: e.target.value})} />
                <TextField label="Livetime" value={newMes.livetime||''} onChange={e=>setNewMes({...newMes, livetime: e.target.value})} />
              </>
            )}
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>{setShowAdd(false); setNewMes({})}}>Annuler</Button>
          <Button variant="contained" onClick={saveNewMes}>Sauver</Button>
        </DialogActions>
      </Dialog>

      <div style={{marginBottom:12}}>
        <label>Pièce pour affectation (multi): </label>
        <select value={selectedPiece} onChange={e=>setSelectedPiece(e.target.value)}>
          <option value="">-- Choisir pièce --</option>
          {pieces.map(p=> <option key={p.id} value={p.id}>{p.name} (UD:{p.numUd||'-'})</option>)}
        </select>
        <button onClick={assignSelected} style={{marginLeft:8}}>Affecter sélection</button>
        <button onClick={async ()=>{
          const ids = Object.keys(selected).filter(k=> selected[k]).map(k=> Number(k))
          if (ids.length===0) return alert('Aucune mesure sélectionnée')
          if (!confirm(`Supprimer ${ids.length} mesure(s) sélectionnée(s) ?`)) return
          try{ await bulkDeleteMesures(ids); setSelected({}); load() } catch(e){ console.error('bulk delete', e); alert('Erreur suppression') }
        }} style={{marginLeft:8}}>🗑 Supprimer la sélection</button>
        <div style={{marginTop:8}}>
          <input placeholder="197-210" value={rangeInput} onChange={e=>setRangeInput(e.target.value)} />
          <button onClick={assignRange} style={{marginLeft:8}}>Affecter plage</button>
        </div>
      </div>

      <div style={{marginBottom:8, border:'1px solid #ddd', padding:8, display:'inline-block'}}>
        <strong>⚙ Colonnes visibles</strong>
        <label style={{marginLeft:8}}><input type="checkbox" checked={!!visibleColumns.revetement} onChange={()=>toggleVisibleColumn('revetement')} /> Revêtement</label>
        <label style={{marginLeft:8}}><input type="checkbox" checked={!!visibleColumns.hauteur} onChange={()=>toggleVisibleColumn('hauteur')} /> Hauteur</label>
        <label style={{marginLeft:8}}><input type="checkbox" checked={!!visibleColumns.classe} onChange={()=>toggleVisibleColumn('classe')} /> Classe</label>
        <label style={{marginLeft:8}}><input type="checkbox" checked={!!visibleColumns.date} onChange={()=>toggleVisibleColumn('date')} /> Date</label>
        <label style={{marginLeft:8}}><input type="checkbox" checked={!!visibleColumns.livetime} onChange={()=>toggleVisibleColumn('livetime')} /> Livetime</label>
        <label style={{marginLeft:12}}><input type="checkbox" checked={!!autoCreateBati} onChange={toggleAutoCreateBati} /> Créer automatiquement le bâti</label>
      </div>

      <table border={1} cellPadding={6} style={{width:'100%'}}>
        <thead>
          <tr>
            <th></th>
            <th style={{cursor:'pointer'}} onClick={()=>toggleSort('num')}>N° Mesure {sortBy==='num' ? (sortDir==='asc' ? '▲' : '▼') : ''}</th>
            <th style={{cursor:'pointer'}} onClick={()=>toggleSort('piece')}>Pièce {sortBy==='piece' ? (sortDir==='asc' ? '▲' : '▼') : ''}</th>
            <th>Niveau</th>
            <th>Support</th>
            <th style={{cursor:'pointer'}} onClick={()=>toggleSort('Pb')}>Pb {sortBy==='Pb' ? (sortDir==='asc' ? '▲' : '▼') : ''}</th>
            <th>Précision</th>
            {visibleColumns.revetement && <th>Revêtement</th>}
            {visibleColumns.hauteur && <th>Hauteur</th>}
            {visibleColumns.date && <th>Date</th>}
            {visibleColumns.livetime && <th>Livetime</th>}
            <th style={{cursor:'pointer'}} onClick={()=>toggleSort('classe')}>Classe {sortBy==='classe' ? (sortDir==='asc' ? '▲' : '▼') : ''}</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {sortedMesures.map(m=> (
            <tr key={m.id}>
              <td><input type="checkbox" checked={!!selected[m.id]} onChange={()=>toggle(m.id)} /></td>
              <td>{m.num}</td>
              <td>{pieces.find(p=> p.id === m.pieceId)?.name || '-'}</td>
              <td>{niveaux.find(n=> n.id === pieces.find(p=> p.id === m.pieceId)?.niveauId)?.name || '-'}</td>
              <td>{(supportsMap[m.pieceId]||[]).find(s=> s.id === m.supportId)?.name || '-'}</td>
              <td>{m.Pb}</td>
              <td>{m.precision}</td>
              {visibleColumns.revetement && <td>{m.revetement || '-'}</td>}
              {visibleColumns.hauteur && <td>{m.hauteur || '-'}</td>}
              {visibleColumns.date && <td>{m.date}</td>}
              {visibleColumns.livetime && <td>{m.livetime}</td>}
              <td>{m.classe || classify(m.Pb_value, m.precision)}</td>
              <td>
                <div>
                  <select defaultValue={m.pieceId || ''} onChange={(e)=>assignSingle(m.id, e.target.value)}>
                    <option value="">-- Aucun --</option>
                    {pieces.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <div style={{marginTop:6}}>
                    <select defaultValue={m.supportId || ''} onChange={(e)=>assignSupport(m.id, e.target.value)}>
                      <option value="">-- Aucun support --</option>
                      {(supportsMap[m.pieceId]||[]).map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div style={{marginTop:8}}>
                    <button onClick={async ()=>{
                      // open edit dialog
                      setEditingId(m.id)
                      // prefill fields
                      setNewMes({
                        num: m.num,
                        pieceId: m.pieceId || '',
                        supportId: m.supportId || '',
                        numUd: m.numUd || '',
                        Pb: m.Pb || '',
                        precision: m.precision || '',
                        date: m.date || '',
                        livetime: m.livetime || '',
                        point: m.point || '',
                        observations: m.observations || '',
                        zone: m.zone || '',
                        element: m.element || '',
                        substrat: m.substrat || '',
                        revetement: m.revetement || '',
                        etat_conservation: m.etat_conservation || deriveEtatConservation(m),
                        hauteur: m.hauteur || ''
                      })
                      setShowAdd(true)
                      }}>✏ Modifier</button>

                      <button onClick={async ()=>{
                      if (!confirm(`Supprimer la mesure ${m.num} ?`)) return
                      try{ await deleteMesure(m.id); load() } catch(e){ console.error('deleteMesure', e); alert('Erreur suppression') }
                      }} style={{marginLeft:8}}>🗑 Supprimer</button>

                      <button onClick={async ()=>{ await duplicateMesure(m) }} style={{marginLeft:8}}>⎘ Dupliquer</button>

                    <button onClick={async ()=>{
                      if (!confirm(`Supprimer la mesure ${m.num} ?`)) return
                      try{ await deleteMesure(m.id); load() } catch(e){ console.error('deleteMesure', e); alert('Erreur suppression') }
                    }} style={{marginLeft:8}}>🗑 Supprimer</button>
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
