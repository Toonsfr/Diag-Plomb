import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getChantier, getPiecesByChantier, addPiece, updatePiece, deletePiece } from '../services/storage'

export default function PiecesPage(){
  const { chantierId } = useParams()
  const [chantier, setChantier] = useState(null)
  const [pieces, setPieces] = useState([])
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(null)
  const [ud, setUd] = useState('')

  useEffect(()=>{ load() },[chantierId])
  const load = async ()=>{
    if (!chantierId) return
    setChantier(await getChantier(chantierId))
    setPieces(await getPiecesByChantier(chantierId))
  }

  const add = async ()=>{
    if (!name) return
    await addPiece({chantierId:Number(chantierId), name, numUd: ud||''})
    setName(''); setUd('')
    load()
  }
  const startEdit = (p)=>{ setEditing(p.id); setName(p.name); setUd(p.numUd||'') }
  const saveEdit = async ()=>{ await updatePiece(editing, {name, numUd: ud}); setEditing(null); setName(''); setUd(''); load() }
  const remove = async (id)=>{ if (!confirm('Supprimer cette pièce ?')) return; await deletePiece(id); load() }

  if (!chantier) return <div>Chargement chantier...</div>
  return (
    <div>
      <h2>Pièces / UD — {chantier.name}</h2>
      <div style={{marginBottom:12}}>
        <input placeholder="Nom pièce" value={name} onChange={e=>setName(e.target.value)} />
        <input placeholder="UD (numUd)" value={ud} onChange={e=>setUd(e.target.value)} style={{marginLeft:8}} />
        {editing ? (<><button onClick={saveEdit}>Sauver</button><button onClick={()=>{setEditing(null);setName('');setUd('')}}>Annuler</button></>) : (<button onClick={add}>Ajouter</button>)}
      </div>
      <table border={1} cellPadding={6}>
        <thead><tr><th>ID</th><th>Nom</th><th>UD</th><th>Actions</th></tr></thead>
        <tbody>
          {pieces.map(p=> (
            <tr key={p.id}><td>{p.id}</td><td>{p.name}</td><td>{p.numUd||'-'}</td><td>
              <button onClick={()=>startEdit(p)}>Éditer</button>
              <button onClick={()=>remove(p.id)} style={{marginLeft:8}}>Supprimer</button>
            </td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
