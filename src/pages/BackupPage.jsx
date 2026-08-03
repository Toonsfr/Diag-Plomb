import React, { useEffect, useState } from 'react'
import { getChantiers, exportChantierJSONDownload, importChantierJSONFromFile } from '../services/storage'

export default function BackupPage(){
  const [chantiers, setChantiers] = useState([])
  const [selected, setSelected] = useState(null)
  useEffect(()=>{ getChantiers().then(list=>{ setChantiers(list); if(list && list.length) setSelected(list[0].id) }) },[])

  const handleExport = async ()=>{
    if (!selected) return alert('Sélectionnez un chantier')
    try{
      await exportChantierJSONDownload(selected)
      alert('Export terminé')
    }catch(e){ console.error(e); alert('Export échoué') }
  }

  const fileInputRef = React.createRef()
  const handleImportClick = ()=> fileInputRef.current && fileInputRef.current.click()
  const handleFile = async (ev)=>{
    const f = ev.target.files && ev.target.files[0]
    if (!f) return
    try{
      const id = await importChantierJSONFromFile(f)
      alert('Import terminé. Chantier créé: '+id)
    }catch(e){ console.error(e); alert('Import échoué') }
    ev.target.value = null
  }

  return (
    <div>
      <h2>📂 Sauvegarde / Mobilité</h2>
      <div style={{marginBottom:12}}>
        <label>Sélectionner un chantier: </label>
        <select value={selected||''} onChange={e=>setSelected(e.target.value)}>
          <option value="">-- choisir --</option>
          {chantiers.map(c=> <option key={c.id} value={c.id}>{c.name||('Chantier '+c.id)}</option>)}
        </select>
      </div>
      <div style={{marginBottom:12}}>
        <button onClick={handleExport}>💾 Exporter chantier JSON</button>
      </div>
      <div style={{marginBottom:12}}>
        <input ref={fileInputRef} type="file" accept="application/json" style={{display:'none'}} onChange={handleFile} />
        <button onClick={handleImportClick}>📂 Importer chantier JSON</button>
      </div>
    </div>
  )
}