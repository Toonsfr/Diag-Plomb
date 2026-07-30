import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getMesuresByChantier, getChantier } from '../services/storage'

export default function MesuresPage(){
  const { chantierId } = useParams()
  const [mesures, setMesures] = useState([])
  const [chantier, setChantier] = useState(null)
  useEffect(()=>{ load() },[chantierId])
  const load = async ()=>{
    setMesures(await getMesuresByChantier(chantierId))
    setChantier(await getChantier(chantierId))
  }
  return (
    <div>
      <h2>Mesures — {chantier?.name}</h2>
      <table border={1} cellPadding={6}>
        <thead>
          <tr><th>ID</th><th>num</th><th>numUd</th><th>Pb</th><th>precision</th><th>date</th><th>livetime</th></tr>
        </thead>
        <tbody>
          {mesures.map(m=> (
            <tr key={m.id}><td>{m.id}</td><td>{m.num}</td><td>{m.numUd}</td><td>{m.Pb}</td><td>{m.precision}</td><td>{m.date}</td><td>{m.livetime}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
