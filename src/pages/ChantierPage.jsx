import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getChantier, addPiece, getPiecesByChantier } from '../services/storage'

export default function ChantierPage(){
  const { id } = useParams()
  const [chantier, setChantier] = useState(null)
  const [pieces, setPieces] = useState([])
  const [name, setName] = useState('')
  useEffect(()=>{ load() },[id])
  const load = async ()=>{
    setChantier(await getChantier(id))
    setPieces(await getPiecesByChantier(id))
  }
  const add = async ()=>{
    if (!name) return
    await addPiece({chantierId:Number(id), name, numUd: ''})
    setName('')
    load()
  }
  if (!chantier) return <div>Chargement...</div>
  return (
    <div>
      <h2>{chantier.name}</h2>
      <div>
        <h3>Pièces / UD</h3>
        <div>
          <input placeholder="Nom pièce/UD" value={name} onChange={e=>setName(e.target.value)} />
          <button onClick={add}>Ajouter</button>
        </div>
        <ul>
          {pieces.map(p=> <li key={p.id}>{p.name} (UD: {p.numUd || '-'})</li>)}
        </ul>
        <div style={{marginTop:12}}>
          <Link to={`/mesures/${id}`}><button>Voir mesures</button></Link>
        </div>
      </div>
    </div>
  )
}
