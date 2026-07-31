import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getMesuresByChantier, getChantier, getPiecesByChantier, updateMesure, bulkUpdateMesures } from '../services/storage'
import { classify } from '../services/fenx2Parser'

export default function MesuresPage(){
  const { chantierId } = useParams()
  const [mesures, setMesures] = useState([])
  const [chantier, setChantier] = useState(null)
  const [pieces, setPieces] = useState([])
  const [selected, setSelected] = useState({})
  const [rangeInput, setRangeInput] = useState('')
  const [selectedPiece, setSelectedPiece] = useState('')

  useEffect(()=>{ load() },[chantierId])
  const load = async ()=>{
    setMesures(await getMesuresByChantier(chantierId))
    setChantier(await getChantier(chantierId))
    setPieces(await getPiecesByChantier(chantierId))
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
    await updateMesure(id, { pieceId: pieceId ? Number(pieceId) : null })
    load()
  }

  return (
    <div>
      <h2>Mesures — {chantier?.name}</h2>

      <div style={{marginBottom:12}}>
        <label>Pièce pour affectation (multi): </label>
        <select value={selectedPiece} onChange={e=>setSelectedPiece(e.target.value)}>
          <option value="">-- Choisir pièce --</option>
          {pieces.map(p=> <option key={p.id} value={p.id}>{p.name} (UD:{p.numUd||'-'})</option>)}
        </select>
        <button onClick={assignSelected} style={{marginLeft:8}}>Affecter sélection</button>
        <div style={{marginTop:8}}>
          <input placeholder="197-210" value={rangeInput} onChange={e=>setRangeInput(e.target.value)} />
          <button onClick={assignRange} style={{marginLeft:8}}>Affecter plage</button>
        </div>
      </div>

      <table border={1} cellPadding={6} style={{width:'100%'}}>
        <thead>
          <tr><th></th><th>N° Mesure</th><th>Pièce</th><th>Pb</th><th>Précision</th><th>Date</th><th>Livetime</th><th>Classe</th><th>Action</th></tr>
        </thead>
        <tbody>
          {mesures.map(m=> (
            <tr key={m.id}>
              <td><input type="checkbox" checked={!!selected[m.id]} onChange={()=>toggle(m.id)} /></td>
              <td>{m.num}</td>
              <td>{pieces.find(p=> p.id === m.pieceId)?.name || '-'}</td>
              <td>{m.Pb}</td>
              <td>{m.precision}</td>
              <td>{m.date}</td>
              <td>{m.livetime}</td>
              <td>{m.classe || classify(m.Pb_value, m.precision)}</td>
              <td>
                <select defaultValue={m.pieceId || ''} onChange={(e)=>assignSingle(m.id, e.target.value)}>
                  <option value="">-- Aucun --</option>
                  {pieces.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
