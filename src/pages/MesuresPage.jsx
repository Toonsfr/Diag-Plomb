import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getMesuresByChantier, getChantier, getPiecesByChantier, updateMesure, bulkUpdateMesures, getSupportsByPiece, addMesure, getNextMesureNum, reclassifyMesuresByChantier, getNiveauxByChantier, deleteMesure, bulkDeleteMesures } from '../services/storage'
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
  const [editingId, setEditingId] = useState(null)
  const [sortBy, setSortBy] = useState('num')
  const [sortDir, setSortDir] = useState('asc')

  useEffect(()=>{ load() },[chantierId])
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
        element: newMes.element || '',
        substrat: newMes.substrat || '',
        revetement: newMes.revetement || '',
        etat: newMes.etat || '',
        degradation: newMes.degradation || '',
        hauteur: newMes.hauteur || '',
        classe
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
              <Select value={newMes.element||''} label="Élément" onChange={e=>setNewMes({...newMes, element: e.target.value})}>
                <MenuItem value="">--</MenuItem>
                <MenuItem value="Mur">Mur</MenuItem>
                <MenuItem value="Plafond">Plafond</MenuItem>
                <MenuItem value="Sol">Sol</MenuItem>
                <MenuItem value="Fenêtre">Fenêtre</MenuItem>
                <MenuItem value="Porte">Porte</MenuItem>
              </Select>
            </FormControl>
            <FormControl style={{minWidth:160}}>
              <InputLabel>Substrat</InputLabel>
              <Select value={newMes.substrat||''} label="Substrat" onChange={e=>setNewMes({...newMes, substrat: e.target.value})}>
                <MenuItem value="">--</MenuItem>
                <MenuItem value="Béton">Béton</MenuItem>
                <MenuItem value="Bois">Bois</MenuItem>
                <MenuItem value="Plâtre">Plâtre</MenuItem>
                <MenuItem value="Brique">Brique</MenuItem>
              </Select>
            </FormControl>
            <FormControl style={{minWidth:160}}>
              <InputLabel>Revêtement</InputLabel>
              <Select value={newMes.revetement||''} label="Revêtement" onChange={e=>setNewMes({...newMes, revetement: e.target.value})}>
                <MenuItem value="">--</MenuItem>
                <MenuItem value="Peinture">Peinture</MenuItem>
                <MenuItem value="Enduit">Enduit</MenuItem>
                <MenuItem value="Carrelage">Carrelage</MenuItem>
                <MenuItem value="PVC">PVC</MenuItem>
              </Select>
            </FormControl>
            <FormControl style={{minWidth:160}}>
              <InputLabel>État</InputLabel>
              <Select value={newMes.etat||''} label="État" onChange={e=>setNewMes({...newMes, etat: e.target.value})}>
                <MenuItem value="">--</MenuItem>
                <MenuItem value="Bon">Bon</MenuItem>
                <MenuItem value="Moyen">Moyen</MenuItem>
                <MenuItem value="Mauvais">Mauvais</MenuItem>
              </Select>
            </FormControl>
            <FormControl style={{minWidth:160}}>
              <InputLabel>Dégradation</InputLabel>
              <Select value={newMes.degradation||''} label="Dégradation" onChange={e=>setNewMes({...newMes, degradation: e.target.value})}>
                <MenuItem value="">--</MenuItem>
                <MenuItem value="Aucune">Aucune</MenuItem>
                <MenuItem value="Faible">Faible</MenuItem>
                <MenuItem value="Modérée">Modérée</MenuItem>
                <MenuItem value="Sévère">Sévère</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Hauteur (m)" value={newMes.hauteur||''} onChange={e=>setNewMes({...newMes, hauteur: e.target.value})} />

            <TextField label="Pb" value={newMes.Pb||''} onChange={e=>setNewMes({...newMes, Pb: e.target.value})} />
            <TextField label="Précision" value={newMes.precision||''} onChange={e=>setNewMes({...newMes, precision: e.target.value})} />
            <TextField label="Date" value={newMes.date||''} onChange={e=>setNewMes({...newMes, date: e.target.value})} />
            <TextField label="Livetime" value={newMes.livetime||''} onChange={e=>setNewMes({...newMes, livetime: e.target.value})} />
            <TextField label="Observations" value={newMes.observations||''} onChange={e=>setNewMes({...newMes, observations: e.target.value})} />
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
            <th>Date</th>
            <th>Livetime</th>
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
              <td>{m.date}</td>
              <td>{m.livetime}</td>
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
                        etat: m.etat || '',
                        degradation: m.degradation || '',
                        hauteur: m.hauteur || ''
                      })
                      setShowAdd(true)
                    }}>✏ Modifier</button>

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
