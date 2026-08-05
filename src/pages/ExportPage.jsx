import React, { useEffect, useState } from 'react'
import { exportAllMesures, exportChantier, exportLogicielMetierAll, exportLogicielMetierChantier } from '../services/exportExcel'
import { getChantiers } from '../services/storage'

export default function ExportPage(){
  const [chantiers, setChantiers] = useState([])
  const [mode, setMode] = useState('selected') // 'all' or 'selected'
  const [selected, setSelected] = useState(null)

  useEffect(()=>{ (async ()=> setChantiers(await getChantiers()))() },[])

  const handleExport = async () => {
    try {
      let filename
      if (mode === 'all') filename = await exportAllMesures()
      else if (selected) filename = await exportChantier(selected)
      else { alert('Sélectionner un chantier'); return }
      console.log('Export completed:', filename)
      alert('Export terminé: ' + filename)
    } catch (err) {
      console.error('Export failed', err)
      alert('Erreur lors de l\'export. Voir la console pour détails.')
    }
  }

  const handleMetierExport = async () => {
    try {
      let filename
      if (mode === 'all') filename = await exportLogicielMetierAll()
      else if (selected) filename = await exportLogicielMetierChantier(selected)
      else { alert('Sélectionner un chantier'); return }
      console.log('Metier export completed:', filename)
      alert('Export métier terminé: ' + filename)
    } catch (err) {
      console.error('Metier export failed', err)
      alert('Erreur lors de l\'export métier. Voir la console pour détails.')
    }
  }

  return (
    <div>
      <h2>Export Excel</h2>
      <div>
        <label><input type="radio" checked={mode==='selected'} onChange={()=>setMode('selected')} /> Chantier sélectionné</label>
        <label style={{marginLeft:12}}><input type="radio" checked={mode==='all'} onChange={()=>setMode('all')} /> Tous les chantiers</label>
      </div>
      <div style={{marginTop:8}}>
        <select value={selected || ''} onChange={e=>setSelected(e.target.value)}>
          <option value="">-- Choisir un chantier --</option>
          {chantiers.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div style={{marginTop:12}}>
        <button onClick={handleExport}>Exporter en XLSX</button>
        <button onClick={handleMetierExport} style={{marginLeft:12}}>📊 Export logiciel métier</button>
      </div>
    </div>
  )
}
