import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getChantier, getPiecesByChantier, addPieceWithSupports, addPiece, updatePiece, deletePiece, getSupportsByPiece, addSupport, updateSupport, deleteSupport, getNiveauxByChantier, addNiveau, updateNiveau, deleteNiveau } from '../services/storage'

export default function PiecesPage(){
  const { chantierId } = useParams()
  const [chantier, setChantier] = useState(null)
  const [pieces, setPieces] = useState([])
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(null)
  const [ud, setUd] = useState('')
  const [autoCreateSupports, setAutoCreateSupports] = useState(() => {
    const v = localStorage.getItem('autoCreateSupports')
    return v === null ? true : (v === 'true')
  })
  const [openSupportsFor, setOpenSupportsFor] = useState(null)
  const [supportsMap, setSupportsMap] = useState({})
  const [newSupportName, setNewSupportName] = useState('')
  const [niveaux, setNiveaux] = useState([])
  const [newNiveauName, setNewNiveauName] = useState('')
  const [selectedNiveau, setSelectedNiveau] = useState('')
  const [quickSelection, setQuickSelection] = useState({})
  const predefinedSupports = ['Mur E','Mur F','Mur G','Mur H','Porte','Fenêtre','Volet','Radiateur','Garde-corps']

  useEffect(()=>{ load() },[chantierId])
  const load = async ()=>{
    if (!chantierId) return
    setChantier(await getChantier(chantierId))
    const ps = await getPiecesByChantier(chantierId)
    setPieces(ps)
    // load supports for pieces
    const map = {}
    await Promise.all(ps.map(async p=>{
      const s = await getSupportsByPiece(p.id)
      map[p.id] = s || []
    }))
    setSupportsMap(map)
    // load niveaux
    const nv = await getNiveauxByChantier(chantierId)
    setNiveaux(nv)
  }

  const add = async ()=>{
    if (!name) return
    const createSupports = !!autoCreateSupports
    const pieceObj = {chantierId:Number(chantierId), name, numUd: ud||''}
    if (selectedNiveau) pieceObj.niveauId = Number(selectedNiveau)
    await addPieceWithSupports(pieceObj, createSupports)
    setName(''); setUd(''); setSelectedNiveau('')
    load()
  }
  const startEdit = (p)=>{ setEditing(p.id); setName(p.name); setUd(p.numUd||''); setSelectedNiveau(p.niveauId || '') }
  const saveEdit = async ()=>{ await updatePiece(editing, {name, numUd: ud, niveauId: selectedNiveau ? Number(selectedNiveau) : null}); setEditing(null); setName(''); setUd(''); setSelectedNiveau(''); load() }
  const remove = async (id)=>{ if (!confirm('Supprimer cette pièce ?')) return; await deletePiece(id); load() }

  const toggleSupports = (pieceId)=> setOpenSupportsFor(openSupportsFor === pieceId ? null : pieceId)
  const addNiv = async ()=>{ if (!newNiveauName) return; await addNiveau({chantierId:Number(chantierId), name:newNiveauName}); setNewNiveauName(''); load() }
  const renameNiv = async (id, name)=>{ if (!name) return; await updateNiveau(id, {name}); load() }
  const removeNiv = async (id)=>{ if (!confirm('Supprimer ce niveau ?')) return; await deleteNiveau(id); load() }
  const addNewSupport = async (pieceId)=>{
    if (!newSupportName) return
    await addSupport({pieceId:Number(pieceId), name:newSupportName})
    setNewSupportName('')
    load()
  }
  const renameSupport = async (id, name)=>{ if (!name) return; await updateSupport(id, {name}); load() }
  const removeSupport = async (id)=>{ if (!confirm('Supprimer ce support ?')) return; await deleteSupport(id); load() }
  const toggleAutoSupports = (v)=>{ setAutoCreateSupports(v); localStorage.setItem('autoCreateSupports', v ? 'true' : 'false') }

  const toggleQuickSupport = (pieceId, name) => {
    setQuickSelection(prev=>{
      const cur = new Set(prev[pieceId] || [])
      if (cur.has(name)) cur.delete(name)
      else cur.add(name)
      return {...prev, [pieceId]: Array.from(cur)}
    })
  }
  const addSelectedSupports = async (pieceId) => {
    const selected = quickSelection[pieceId] || []
    const existing = (supportsMap[pieceId]||[]).map(s=> s.name)
    for (const name of selected){
      if (!existing.includes(name)){
        try{ await addSupport({pieceId: pieceId, name}) } catch(e){ console.error('addSupport error', e) }
      }
    }
    // clear selection for this piece
    setQuickSelection(prev=> ({...prev, [pieceId]: []}))
    load()
  }

  if (!chantier) return <div>Chargement chantier...</div>
  return (
    <div>
      <h2>Pièces / UD — {chantier.name}</h2>
      <div style={{marginBottom:12}}>
        <input placeholder="Nom pièce" value={name} onChange={e=>setName(e.target.value)} />
        <input placeholder="UD (numUd)" value={ud} onChange={e=>setUd(e.target.value)} style={{marginLeft:8}} />
        <select value={selectedNiveau||''} onChange={e=>setSelectedNiveau(e.target.value)} style={{marginLeft:8}}>
          <option value="">-- Niveau --</option>
          {niveaux.map(n=> <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
        {editing ? (<><button onClick={saveEdit}>Sauver</button><button onClick={()=>{setEditing(null);setName('');setUd(''); setSelectedNiveau('')}}>Annuler</button></>) : (<button onClick={add}>Ajouter</button>)}
        <label style={{marginLeft:12}}><input type="checkbox" checked={autoCreateSupports} onChange={e=>toggleAutoSupports(e.target.checked)} /> Créer automatiquement les supports</label>
      </div>

      <div style={{marginBottom:12}}>
        <h4>Niveaux</h4>
        <input placeholder="Nom niveau" value={newNiveauName} onChange={e=>setNewNiveauName(e.target.value)} />
        <button onClick={addNiv} style={{marginLeft:8}}>Ajouter niveau</button>
        <ul>
          {niveaux.map(n=> (
            <li key={n.id}>{n.name} <input defaultValue={n.name} onBlur={e=>renameNiv(n.id, e.target.value)} style={{marginLeft:8}} /><button onClick={()=>removeNiv(n.id)} style={{marginLeft:8}}>Supprimer</button></li>
          ))}
        </ul>
      </div>

      <table border={1} cellPadding={6}>
        <thead><tr><th>ID</th><th>Nom</th><th>Niveau</th><th>UD</th><th>Supports</th><th>Actions</th></tr></thead>
        <tbody>
          {pieces.map(p=> (
            <React.Fragment key={p.id}>
              <tr><td>{p.id}</td><td>{p.name}</td><td>{niveaux.find(n=> n.id === p.niveauId)?.name || '-'}</td><td>{p.numUd||'-'}</td><td>{(supportsMap[p.id]||[]).length}</td><td>
                <button onClick={()=>startEdit(p)}>Éditer</button>
                <button onClick={()=>toggleSupports(p.id)} style={{marginLeft:8}}>{openSupportsFor===p.id? 'Cacher supports':'Gérer supports'}</button>
                <button onClick={()=>remove(p.id)} style={{marginLeft:8}}>Supprimer</button>
              </td></tr>
              {openSupportsFor===p.id && (
                <tr><td colSpan={6}>
                  <div>
                    <h4>Supports pour {p.name}</h4>
                    <div>
                      <input placeholder="Nom support" value={newSupportName} onChange={e=>setNewSupportName(e.target.value)} />
                      <button onClick={()=>addNewSupport(p.id)} style={{marginLeft:8}}>+ Ajouter support</button>
                      <button onClick={async ()=>{
                        // add a set of métier supports if they don't exist yet
                        const wanted = ['Mur E','Mur F','Mur G','Mur H','Porte','Fenêtre','Volet','Radiateur','Garde-corps']
                        const existing = (supportsMap[p.id]||[]).map(s=> s.name)
                        for (const name of wanted){
                          if (!existing.includes(name)){
                            try{ await addSupport({pieceId: p.id, name}) } catch(e){ console.error('addSupport error', e) }
                          }
                        }
                        load()
                      }} style={{marginLeft:8}}>+ Ajouter supports métier</button>

                      {/* Quick multi-select generator */}
                      <div style={{marginTop:8, border:'1px solid #eee', padding:8}}>
                        <div style={{fontWeight:600}}>Génération rapide</div>
                        <div style={{marginTop:6}}>
                          {predefinedSupports.map(name=> (
                            <label key={name} style={{marginRight:12, display:'inline-block'}}>
                              <input type="checkbox" checked={(quickSelection[p.id]||[]).includes(name)} onChange={()=>toggleQuickSupport(p.id, name)} /> {name}
                            </label>
                          ))}
                        </div>
                        <div style={{marginTop:8}}>
                          <button onClick={()=>addSelectedSupports(p.id)}>Créer sélection</button>
                          <button onClick={()=>setQuickSelection(prev=>({...prev, [p.id]: predefinedSupports.slice()}))} style={{marginLeft:8}}>Sélectionner tout</button>
                          <button onClick={()=>setQuickSelection(prev=>({...prev, [p.id]: []}))} style={{marginLeft:8}}>Tout décocher</button>
                        </div>
                      </div>
                    </div>
                    <ul>
                      {(supportsMap[p.id]||[]).map(s=> (
                        <li key={s.id}>
                          <input defaultValue={s.name} onBlur={e=>renameSupport(s.id, e.target.value)} />
                          <button onClick={()=>removeSupport(s.id)} style={{marginLeft:8}}>Supprimer</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </td></tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
