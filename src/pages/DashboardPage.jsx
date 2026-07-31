import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getChantiers, addChantier } from '../services/storage'

export default function DashboardPage(){
  const [chantiers, setChantiers] = useState([])
  const [name, setName] = useState('')
  useEffect(()=>{ load() },[])
  const load = async()=> setChantiers(await getChantiers())
  const create = async ()=>{
    if (!name) return
    await addChantier({name, client:'', address:'', date: new Date().toISOString().slice(0,10)})
    setName('')
    load()
  }
  return (
    <div>
      <h2>Chantiers</h2>
      <div style={{marginBottom:12}}>
        <input placeholder="Nom du chantier" value={name} onChange={e=>setName(e.target.value)} />
        <button onClick={create}>Créer</button>
      </div>
      <ul>
        {chantiers.map(c=> (
          <li key={c.id}><Link to={`/pieces/${c.id}`}>{c.name || `Chantier ${c.id}`}</Link> — <Link to={`/mesures/${c.id}`}>Mesures</Link></li>
        ))}
      </ul>
    </div>
  )
}
