import React from 'react'
import { exportFullDBDownload, importFullDBFromFile } from '../services/storage'

export default function FullBackupPage(){
  const fileInputRef = React.createRef()
  const handleImportClick = ()=> fileInputRef.current && fileInputRef.current.click()
  const handleFile = async (ev)=>{
    const f = ev.target.files && ev.target.files[0]
    if (!f) return
    if (!confirm('Restaurer la base complète va remplacer les données locales. Continuer ?')) { ev.target.value = null; return }
    try{
      await importFullDBFromFile(f)
      alert('Restauration complète terminée. Rechargez la page.')
    }catch(e){ console.error(e); alert('Restauration échouée') }
    ev.target.value = null
  }

  const handleExport = async ()=>{
    try{
      await exportFullDBDownload()
      alert('Export complet terminé')
    }catch(e){ console.error(e); alert('Export échoué') }
  }

  return (
    <div>
      <h2>📦 Sauvegarde complète</h2>
      <div style={{marginBottom:12}}>
        <button onClick={handleExport}>💾 Export base complète</button>
      </div>
      <div style={{marginBottom:12}}>
        <input ref={fileInputRef} type="file" accept="application/json" style={{display:'none'}} onChange={handleFile} />
        <button onClick={handleImportClick}>📂 Restaurer base complète</button>
      </div>
    </div>
  )
}