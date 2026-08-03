import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getChantiers } from '../services/storage'

export default function PlansIndexPage(){
  const [chantiers, setChantiers] = useState([])
  useEffect(()=>{ (async ()=> setChantiers(await getChantiers({filter:'active'})))() },[])
  return (
    <div>
      <h2>Plans - Sélectionner un chantier</h2>
      <ul>
        {chantiers.map(c=> (
          <li key={c.id} style={{marginBottom:8}}>
            <strong>{c.name}</strong>
            <div style={{marginTop:4}}>
              <Link to={`/plans/${c.id}`}>📐 Plan</Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
