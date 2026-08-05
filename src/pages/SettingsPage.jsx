import React, { useState, useEffect } from 'react'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import { getChantiers, reclassifyMesuresByChantier } from '../services/storage'

export default function SettingsPage(){
  const [autoCreateBati, setAutoCreateBati] = useState(()=>{
    try{ const raw = typeof window !== 'undefined' ? localStorage.getItem('mesures_auto_create_bati') : null; return raw === null ? true : raw === 'true' }catch(e){ return true }
  })
  const [chantiers, setChantiers] = useState([])
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState('')

  useEffect(()=>{ getChantiers().then(setChantiers) },[])

  const toggle = ()=>{
    setAutoCreateBati(v=>{ const nv = !v; try{ localStorage.setItem('mesures_auto_create_bati', String(nv)) }catch(e){}; return nv })
  }

  const runReclassifyAll = async ()=>{
    if (!confirm('Exécuter la reclassification des mesures pour tous les chantiers ?')) return
    setRunning(true); setLog('')
    try{
      for (const c of chantiers){
        const updated = await reclassifyMesuresByChantier(c.id)
        setLog(l => l + `Chantier ${c.id} (${c.name}): ${updated} mesure(s) mises à jour\n`)
      }
      setLog(l => l + 'Terminé')
    }catch(e){ setLog(l => l + 'Erreur: ' + e.message) }
    setRunning(false)
  }

  const resetLists = ()=>{
    if (!confirm('Remettre les listes éléments/revêtements/substrats aux valeurs métier par défaut ?')) return
    const elements = ['Mur','Plafond','Porte','Fenêtre','Volet','Radiateur']
    const revetements = ['Peinture','Enduit','Carrelage','PVC']
    const substrats = ['Béton','Bois','Plâtre','Brique']
    try{
      localStorage.setItem('mesures_elements', JSON.stringify(elements))
      localStorage.setItem('mesures_revetements', JSON.stringify(revetements))
      localStorage.setItem('mesures_substrats', JSON.stringify(substrats))
      alert('Listes réinitialisées')
    }catch(e){ console.warn('reset lists failed', e); alert('Échec') }
  }

  return (
    <div>
      <h2>Paramètres</h2>
      <div style={{marginBottom:12}}>
        <FormControlLabel control={<Switch checked={autoCreateBati} onChange={toggle} />} label="Créer automatiquement le bâti" />
      </div>
      <div style={{marginBottom:12}}>
        <Button variant="contained" onClick={runReclassifyAll} disabled={running}>Reclassifier toutes les mesures</Button>
      </div>
      <div style={{marginBottom:12}}>
        <Button onClick={resetLists}>Réinitialiser listes métier par défaut</Button>
      </div>
      <pre style={{whiteSpace:'pre-wrap', background:'#f6f6f6', padding:8}}>{log}</pre>
    </div>
  )
}
