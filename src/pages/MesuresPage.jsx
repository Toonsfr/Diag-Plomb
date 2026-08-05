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
  const [quickEditMode, setQuickEditMode] = useState(false)
  const [inlineEdits, setInlineEdits] = useState({})
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
  const [showListDialog, setShowListDialog] = useState(false)
  const [listDialogKey, setListDialogKey] = useState('')
  const [listDialogValue, setListDialogValue] = useState('')
  const [listDialogField, setListDialogField] = useState('') // which newMes field to set after add

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

  const getClasseFromValues = (pbValue, etat)=> classify(pbValue, etat)

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
      dup.etat_conservation = m.etat_conservation || deriveEtatConservation(m)
      dup.conservationClass = getClasseFromValues(parseNumber(dup.Pb || ''), dup.etat_conservation)
      dup.classe = dup.classe || getClasseFromValues(parseNumber(dup.Pb || ''), dup.etat_conservation)
      
      // Check if element is Porte/Fenêtre/Volet and auto-bâti enabled
      const autoElements = ['Porte','Fenêtre','Volet']
      const elementBase = (dup.element || '').trim().match(/^(\D+?)\s*(\d+)?$/)
      const baseName = elementBase ? elementBase[1].trim() : ''
      
      if (autoElements.includes(baseName) && autoCreateBati && dup.pieceId){
        // Create two mesures instead of one
        const n1 = await getNextMesureNum(chantierId)
        const n2 = await getNextMesureNum(chantierId)
        
        // Get current max index to increment
        const existing = mesures.filter(ms => ms.element && String(ms.element).startsWith(baseName + ' '))
        let max = 0
        existing.forEach(ms => {
          const mMatch = String(ms.element).match(/(\d+)$/)
          if (mMatch) max = Math.max(max, Number(mMatch[1]))
        })
        const nextIndex = max + 1 || 1
        
        const el1Name = `${baseName} ${nextIndex}`
        const frameNum = nextIndex
        const frameName = baseName.toLowerCase() === 'porte' ? `Bâti ${frameNum}` : `Bâti ${baseName.toLowerCase()} ${frameNum}`
        
        // Create supports
        let supportId1 = null; let supportId2 = null
        try{
          const supports = await getSupportsByPiece(dup.pieceId)
          
          let sup1 = supports.find(s => String(s.name).trim().toLowerCase() === el1Name.toLowerCase())
          if (sup1) supportId1 = sup1.id
          else {
            try{ supportId1 = await addSupport({ pieceId: dup.pieceId, name: el1Name }) }catch(e){ console.warn('create support 1 failed', e) }
          }
          
          let sup2 = supports.find(s => String(s.name).trim().toLowerCase() === frameName.toLowerCase())
          if (sup2) supportId2 = sup2.id
          else {
            try{ supportId2 = await addSupport({ pieceId: dup.pieceId, name: frameName }) }catch(e){ console.warn('create support 2 failed', e) }
          }
        }catch(e){ console.warn('getSupportsByPiece duplicate failed', e) }
        
        const mes1 = { ...dup, num: String(n1), element: el1Name, supportId: supportId1 }
        const mes2 = { ...dup, num: String(n2), element: frameName, supportId: supportId2 }
        
        await addMesure(mes1)
        await addMesure(mes2)
        alert(`Deux mesures dupliquées : ${el1Name} et ${frameName}`)
      } else {
        // Single duplicate
        await addMesure(dup)
        alert('Mesure dupliquée')
      }
      
      load()
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

  const getInlineValue = (m, field) => {
    const edited = inlineEdits[m.id]
    if (edited && Object.prototype.hasOwnProperty.call(edited, field)) return edited[field]
    if (field === 'repere') return m.point || m.zone || ''
    return m[field] || ''
  }

  const setInlineValue = (id, field, value) => {
    setInlineEdits(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }))
  }

  const saveQuickFields = async (m, partial) => {
    const changes = { ...partial }
    const nextPbRaw = Object.prototype.hasOwnProperty.call(changes, 'Pb') ? changes.Pb : m.Pb
    const nextEtat = m.etat_conservation || m.etat || m.degradation
    const nextPbValue = parseNumber(nextPbRaw)
    const nextClasse = getClasseFromValues(nextPbValue, nextEtat)
    if (Object.prototype.hasOwnProperty.call(changes, 'Pb')) changes.Pb_value = nextPbValue
    if (Object.prototype.hasOwnProperty.call(changes, 'Pb') || Object.prototype.hasOwnProperty.call(changes, 'precision')) {
      changes.classe = nextClasse
      changes.conservationClass = nextClasse
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'repere')) {
      changes.point = changes.repere
      changes.zone = changes.repere
      delete changes.repere
    }
    await updateMesure(m.id, changes)
    setMesures(prev => prev.map(x => x.id === m.id ? { ...x, ...changes } : x))
  }

  const quickPromptEdit = async (m, field, label) => {
    const current = getInlineValue(m, field)
    const next = prompt(`${label}`, current)
    if (next === null) return
    await saveQuickFields(m, { [field]: next })
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
      const classe = getClasseFromValues(Pb_value, newMes.etat_conservation)
      const etat_conservation = newMes.etat_conservation || deriveEtatConservation(newMes)
      // derive conservation class mapping
      let conservationClass = getClasseFromValues(Pb_value, etat_conservation)

      // Auto-increment named elements
      const autoElements = ['Porte','Fenêtre','Volet']
      let elementFinal = newMes.element || ''
      const baseMatch = (elementFinal || '').trim().match(/^(\D+?)\s*(\d+)?$/)
      const baseName = baseMatch ? baseMatch[1].trim() : elementFinal
      let shouldCreateDualMesure = false
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
        shouldCreateDualMesure = true
      }

      // base mesure data (shared)
      const mesDataBase = {
        chantierId: Number(chantierId),
        pieceId: newMes.pieceId ? Number(newMes.pieceId) : null,
        numUd: newMes.numUd || '',
        // Pb and precision left empty for dual mesures
        date: newMes.date || '',
        livetime: newMes.livetime || '',
        point: newMes.point || '',
        observations: newMes.observations || '',
        zone: newMes.zone || '',
        substrat: newMes.substrat || '',
        revetement: newMes.revetement || '',
        etat_conservation,
        conservationClass,
        hauteur: newMes.hauteur || ''
      }

      // Handle creation: single or dual
      if (shouldCreateDualMesure && !editingId && autoCreateBati){
        // Create TWO mesures: one for the element, one for the frame
        const n1 = await getNextMesureNum(chantierId)
        const n2 = await getNextMesureNum(chantierId)
        
        // Create supports
        let supportId1 = null; let supportId2 = null
        if (mesDataBase.pieceId){
          try{
            const supports = await getSupportsByPiece(mesDataBase.pieceId)
            // support for element (e.g., "Porte 1")
            let sup1 = supports.find(s => String(s.name).trim().toLowerCase() === elementFinal.toLowerCase())
            if (sup1) supportId1 = sup1.id
            else {
              try{
                supportId1 = await addSupport({ pieceId: mesDataBase.pieceId, name: elementFinal })
              }catch(e){ console.warn('create support 1 failed', e) }
            }
            
            // support for frame (e.g., "Bâti 1" or "Bâti fenêtre 1")
            const frameNum = elementFinal.match(/(\d+)$/)? elementFinal.match(/(\d+)$/)[1] : '1'
            const elementNameLower = baseName.toLowerCase()
            const frameName = elementNameLower === 'porte' ? `Bâti ${frameNum}` : `Bâti ${elementNameLower} ${frameNum}`
            
            let sup2 = supports.find(s => String(s.name).trim().toLowerCase() === frameName.toLowerCase())
            if (sup2) supportId2 = sup2.id
            else {
              try{
                supportId2 = await addSupport({ pieceId: mesDataBase.pieceId, name: frameName })
              }catch(e){ console.warn('create support 2 failed', e) }
            }
          }catch(e){ console.warn('getSupportsByPiece failed', e) }
        }

        // Mesure 1: Element
        const mes1Data = {
          ...mesDataBase,
          num: String(n1),
          Pb: newMes.Pb ? String(newMes.Pb) : '',
          Pb_value,
          precision: newMes.precision || '',
          element: elementFinal,
          supportId: supportId1,
          classe
        }
        
        // Mesure 2: Frame (Bâti) - leave Pb and precision empty
        const frameNum = elementFinal.match(/(\d+)$/)? elementFinal.match(/(\d+)$/)[1] : '1'
        const frameName = baseName.toLowerCase() === 'porte' ? `Bâti ${frameNum}` : `Bâti ${baseName.toLowerCase()} ${frameNum}`
        const mes2Data = {
          ...mesDataBase,
          num: String(n2),
          Pb: '', // empty
          Pb_value: 0,
          precision: '', // empty
          element: frameName,
          supportId: supportId2,
          classe: 'Classe 1' // default
        }

        await addMesure(mes1Data)
        await addMesure(mes2Data)
        alert(`Deux mesures créées : ${elementFinal} et ${frameName}`)
        
        // refresh UI
        setSupportsMap(sm => {
          const newMap = { ...sm, [mesDataBase.pieceId]: [...(sm[mesDataBase.pieceId]||[])] }
          if (supportId1) newMap[mesDataBase.pieceId].push({ id: supportId1, name: elementFinal })
          if (supportId2) newMap[mesDataBase.pieceId].push({ id: supportId2, name: frameName })
          return newMap
        })
      } else {
        // Single mesure creation or edit
        const mesData = {
          ...mesDataBase,
          num,
          Pb: newMes.Pb ? String(newMes.Pb) : '',
          Pb_value,
          precision: newMes.precision || '',
          element: elementFinal,
          supportId: newMes.supportId ? Number(newMes.supportId) : null,
          classe
        }

        if (editingId) {
          await updateMesure(editingId, mesData)
          alert('Mesure mise à jour')
        } else {
          await addMesure(mesData)
          alert('Mesure ajoutée')
        }
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
      const ca = String(a.classe || getClasseFromValues(a.Pb_value, a.etat_conservation || a.etat || a.degradation))
      const cb = String(b.classe || getClasseFromValues(b.Pb_value, b.etat_conservation || b.etat || b.degradation))
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
        <DialogTitle>Nouvelle mesure — Formulaire terrain v2</DialogTitle>
        <DialogContent>
          <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:8}}>
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

            <TextField label="📍 Repère plan" value={newMes.point||''} onChange={e=>setNewMes({...newMes, point: e.target.value, zone: e.target.value})} />

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
            <div style={{display:'grid', gap:4, padding:'6px 0'}}>
              <div><strong>Pb =</strong> {newMes.Pb || '-'}</div>
              <div><strong>Etat de conservation =</strong> {newMes.etat_conservation || '-'}</div>
              <div style={{fontWeight:600}}><strong>Classe calculée =</strong> {getClasseFromValues(parseNumber(newMes.Pb), newMes.etat_conservation || '')}</div>
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
                  const classeEtat = getClasseFromValues(parseNumber(base.Pb), etat)
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
                <Dialog open={showListDialog} onClose={()=>setShowListDialog(false)}>
                  <DialogTitle>Ajouter manuellement</DialogTitle>
                  <DialogContent>
                    <TextField autoFocus label="Valeur" fullWidth value={listDialogValue} onChange={e=>setListDialogValue(e.target.value)} />
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={()=>setShowListDialog(false)}>Annuler</Button>
                    <Button onClick={()=>{
                      // save to proper list
                      if (listDialogKey === 'elements') addToList('elements', listDialogValue)
                      if (listDialogKey === 'revetements') addToList('revetements', listDialogValue)
                      if (listDialogKey === 'substrats') addToList('substrats', listDialogValue)
                      // set field in newMes
                      if (listDialogField) setNewMes(n=> ({...n, [listDialogField]: listDialogValue}))
                      setShowListDialog(false)
                    }}>Ajouter</Button>
                  </DialogActions>
                </Dialog>
                <FormControl style={{minWidth:160}}>
                  <InputLabel>Élément</InputLabel>
                  <Select value={newMes.element||''} label="Élément" onChange={e=>{
                    const val = e.target.value
                    if (val === '__add__'){
                      setListDialogKey('elements')
                      setListDialogField('element')
                      setListDialogValue('')
                      setShowListDialog(true)
                    } else setNewMes({...newMes, element: val})
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
                      setListDialogKey('substrats')
                      setListDialogField('substrat')
                      setListDialogValue('')
                      setShowListDialog(true)
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
                      setListDialogKey('revetements')
                      setListDialogField('revetement')
                      setListDialogValue('')
                      setShowListDialog(true)
                    } else setNewMes({...newMes, revetement: val})
                  }}>
                    <MenuItem value="">--</MenuItem>
                    {revetementsList.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                    <MenuItem value="__add__">➕ Ajouter manuellement</MenuItem>
                  </Select>
                </FormControl>
                <TextField label="Hauteur (m)" value={newMes.hauteur||''} onChange={e=>setNewMes({...newMes, hauteur: e.target.value})} />
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
        <label style={{marginLeft:12}}><input type="checkbox" checked={!!quickEditMode} onChange={()=>setQuickEditMode(v=>!v)} /> Mode édition rapide</label>
      </div>

      <table border={1} cellPadding={6} style={{width:'100%'}}>
        <thead>
          <tr>
            <th></th>
            <th style={{cursor:'pointer'}} onClick={()=>toggleSort('num')}>N° Mesure {sortBy==='num' ? (sortDir==='asc' ? '▲' : '▼') : ''}</th>
            <th style={{cursor:'pointer'}} onClick={()=>toggleSort('piece')}>Pièce {sortBy==='piece' ? (sortDir==='asc' ? '▲' : '▼') : ''}</th>
            <th>Niveau</th>
            <th>Support</th>
            <th>Repère plan</th>
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
              <td>
                {quickEditMode ? (
                  <input
                    style={{width:90}}
                    value={getInlineValue(m, 'repere')}
                    onChange={e=>setInlineValue(m.id, 'repere', e.target.value)}
                    onBlur={async ()=>{ await saveQuickFields(m, { repere: getInlineValue(m, 'repere') }) }}
                  />
                ) : (m.point || m.zone || '-')}
              </td>
              <td>
                {quickEditMode ? (
                  <input
                    style={{width:70}}
                    value={getInlineValue(m, 'Pb')}
                    onChange={e=>setInlineValue(m.id, 'Pb', e.target.value)}
                    onBlur={async ()=>{ await saveQuickFields(m, { Pb: getInlineValue(m, 'Pb') }) }}
                  />
                ) : m.Pb}
              </td>
              <td>
                {quickEditMode ? (
                  <input
                    style={{width:70}}
                    value={getInlineValue(m, 'precision')}
                    onChange={e=>setInlineValue(m.id, 'precision', e.target.value)}
                    onBlur={async ()=>{ await saveQuickFields(m, { precision: getInlineValue(m, 'precision') }) }}
                  />
                ) : m.precision}
              </td>
              {visibleColumns.revetement && <td>{m.revetement || '-'}</td>}
              {visibleColumns.hauteur && (
                <td>
                  {quickEditMode ? (
                    <input
                      style={{width:90}}
                      value={getInlineValue(m, 'hauteur')}
                      onChange={e=>setInlineValue(m.id, 'hauteur', e.target.value)}
                      onBlur={async ()=>{ await saveQuickFields(m, { hauteur: getInlineValue(m, 'hauteur') }) }}
                    />
                  ) : (m.hauteur || '-')}
                </td>
              )}
              {visibleColumns.date && <td>{m.date}</td>}
              {visibleColumns.livetime && <td>{m.livetime}</td>}
              <td>{getClasseFromValues(m.Pb_value, m.etat_conservation || m.etat || m.degradation)}</td>
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
                    <button onClick={async ()=>{ await quickPromptEdit(m, 'repere', '📍 Repère plan') }}>📍 Repère</button>
                    <button onClick={async ()=>{ await quickPromptEdit(m, 'hauteur', '📏 Hauteur') }} style={{marginLeft:8}}>📏 Hauteur</button>
                    <button onClick={async ()=>{ await quickPromptEdit(m, 'Pb', '🧪 Mesure Pb') }} style={{marginLeft:8}}>🧪 Mesure Pb</button>
                    <button onClick={async ()=>{ await quickPromptEdit(m, 'precision', '🎯 Précision') }} style={{marginLeft:8}}>🎯 Précision</button>
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
