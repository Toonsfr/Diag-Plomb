import React, { useEffect, useState, useRef } from 'react'
import { getChantiers, getChantier, exportChantierJSONDownload, importChantierJSONFromFile, getLastBackup, getBackupsByChantier, startAutoSave, stopAutoSave } from '../services/storage'

export default function OfflinePage(){
  const [chantiers, setChantiers] = useState([])
  const [selected, setSelected] = useState('')
  const [chantier, setChantier] = useState(null)
  const [lastBackup, setLastBackup] = useState(null)
  const [backupCount, setBackupCount] = useState(0)
  const [autosaveOn, setAutosaveOn] = useState(false)
  const pollRef = useRef(null)

  useEffect(()=>{ load() },[])
  const load = async ()=>{ setChantiers(await getChantiers({ includeArchived: true })) }

  useEffect(()=>{ if (selected) loadChantier(selected); else { setChantier(null); setLastBackup(null); setBackupCount(0) } },[selected])
  const loadChantier = async (id)=>{
    setChantier(await getChantier(Number(id)))
    const lb = await getLastBackup(Number(id)); setLastBackup(lb)
    const all = await getBackupsByChantier(Number(id)); setBackupCount(all ? all.length : 0)
  }

  useEffect(()=>{
    // when autosave toggled on, start polling backups to refresh display
    if (autosaveOn && selected){
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(async ()=>{
        try{
          const lb = await getLastBackup(Number(selected))
          const all = await getBackupsByChantier(Number(selected))
          setLastBackup(lb)
          setBackupCount(all ? all.length : 0)
        }catch(e){/* ignore */}
      }, 5000)
    } else {
      if (pollRef.current){ clearInterval(pollRef.current); pollRef.current = null }
    }
    return ()=>{ if (pollRef.current){ clearInterval(pollRef.current); pollRef.current = null } }
  }, [autosaveOn, selected])

  const onExport = async ()=>{
    if (!selected) return alert('Choisir un chantier')
    await exportChantierJSONDownload(selected)
    const lb = await getLastBackup(Number(selected)); setLastBackup(lb)
    const all = await getBackupsByChantier(Number(selected)); setBackupCount(all ? all.length : 0)
  }
  const onImport = async (e)=>{
    const f = e.target.files[0]
    if (!f) return
    try{
      const id = await importChantierJSONFromFile(f)
      alert('Chantier importé ID: ' + id)
      load()
    } catch(err){ console.error(err); alert('Erreur import') }
  }

  const toggleAutosave = ()=>{
    if (!selected) return alert('Choisir chantier')
    if (!autosaveOn){ startAutoSave(selected, 60000); setAutosaveOn(true) }
    else { stopAutoSave(); setAutosaveOn(false) }
  }

  return (
    <div>
      <h2>Mode mobilité / Hors-ligne</h2>
      <div style={{marginBottom:12}}>
        <label>Chantier: </label>
        <select value={selected} onChange={e=>setSelected(e.target.value)}>
          <option value="">-- Choisir chantier --</option>
          {chantiers.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div style={{marginBottom:12}}>
        <button onClick={onExport}>💾 Exporter chantier JSON</button>
        <input type="file" accept="application/json" onChange={onImport} style={{marginLeft:12}} />
      </div>

      <div style={{marginBottom:12}}>
        <div style={{fontWeight:600}}>Sauvegarde automatique IndexedDB</div>
        <div>Dernière sauvegarde: {lastBackup ? new Date(lastBackup.createdAt).toLocaleString() : 'Aucune'}</div>
        <div>Nombre de sauvegardes: {backupCount}</div>
        <button onClick={toggleAutosave}>{autosaveOn ? 'Désactiver autosave' : 'Activer autosave'}</button>
      </div>

      <div style={{marginTop:16}}>
        <p>Export/Import stocke toutes les données localement. Aucune donnée cloud. Tester sur Safari iPad / Chrome Android pour installation PWA.</p>
      </div>
    </div>
  )
}
