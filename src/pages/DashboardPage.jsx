import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getChantiers, addChantier, getNiveauxByChantier, getPiecesByChantier, archiveChantier, deleteChantier, restoreChantier } from '../services/storage'
import { exportChantier } from '../services/exportExcel'

export default function DashboardPage(){
  const [chantiers, setChantiers] = useState([])
  const [name, setName] = useState('')
  const [filter, setFilter] = useState('active') // 'all'|'active'|'archived'|'deleted'
  useEffect(()=>{ load() },[filter])
  const load = async()=> setChantiers(await getChantiers({ filter }))
  const create = async ()=>{
    if (!name) return
    await addChantier({name, client:'', address:'', date: new Date().toISOString().slice(0,10)})
    setName('')
    load()
  }

  const [structure, setStructure] = useState({})
  // load structure (niveaux -> pieces) for a chantier
  const loadStructure = async (chantierId)=>{
    const nv = await getNiveauxByChantier(chantierId)
    const ps = await getPiecesByChantier(chantierId)
    const map = {}
    for (const n of nv) map[n.id] = { niveau: n, pieces: [] }
    // pieces without niveauId go under null
    map['__null__'] = { niveau: { id: null, name: 'Sans niveau' }, pieces: [] }
    for (const p of ps){
      const key = p.niveauId || '__null__'
      if (!map[key]) map[key] = { niveau: { id: p.niveauId, name: 'Niveau '+p.niveauId }, pieces: [] }
      map[key].pieces.push(p)
    }
    setStructure(prev=> ({...prev, [chantierId]: map}))
  }
  return (
    <div>
      <h2>Chantiers</h2>
      <div style={{marginBottom:12}}>
        <input placeholder="Nom du chantier" value={name} onChange={e=>setName(e.target.value)} />
        <button onClick={create}>Créer</button>
      </div>

      <div style={{marginBottom:12}}>
        <label>Filtrer: </label>
        <select value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">Tous</option>
          <option value="active">Actifs</option>
          <option value="archived">Archivés</option>
          <option value="deleted">Supprimés</option>
        </select>
      </div>

      <ul>
        {chantiers.map(c=> (
          <li key={c.id} style={{marginBottom:8}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <strong>{c.name || `Chantier ${c.id}`}</strong>
              <Link to={`/mesures/${c.id}`}>Mesures</Link>
              <Link to={`/plans/${c.id}`} style={{marginLeft:8}}>📐 Plan</Link>
              <button onClick={()=>loadStructure(c.id)} style={{marginLeft:8}}>Afficher structure</button>
              {c.status !== 'archived' && c.status !== 'deleted' && (
                <button onClick={async ()=>{ if (!confirm('Archiver ce chantier ?')) return; await archiveChantier(c.id); load() }} style={{marginLeft:8}}>📦 Archiver</button>
              )}
              {c.status !== 'deleted' && (
                <button onClick={async ()=>{ if (!confirm('Marquer comme supprimé ?')) return; await deleteChantier(c.id); load() }} style={{marginLeft:8}}>🗑 Supprimer</button>
              )}
              {(c.status === 'archived' || c.status === 'deleted') && (
                <button onClick={async ()=>{ await restoreChantier(c.id); load() }} style={{marginLeft:8}}>♻ Restaurer</button>
              )}
              <button onClick={async ()=>{ try { if (!confirm('Exporter ce chantier en Excel ?')) return; const f = await exportChantier(c.id); alert('Export terminé: '+f) } catch (err){ console.error(err); alert('Export échoué') } }} style={{marginLeft:8}}>📊 Export Excel</button>
            </div>
            {structure[c.id] && (
              <ul>
                {Object.values(structure[c.id]).map(entry=> (
                  <li key={String(entry.niveau.id)}>
                    <strong>{entry.niveau.name}</strong>
                    <ul>
                      {entry.pieces.map(p=> <li key={p.id}><Link to={`/pieces/${c.id}`}>{p.name}</Link></li>)}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
