import React from 'react'
import * as XLSX from 'xlsx'
import { getMesuresByChantier, getChantiers } from '../services/storage'

export default function ExportPage(){
  const exportAll = async ()=>{
    const chantiers = await getChantiers()
    const rows = []
    for (const c of chantiers){
      const m = await getMesuresByChantier(c.id)
      for (const r of m) rows.push({chantier: c.name, ...r})
    }
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'mesures')
    XLSX.writeFile(wb, 'diag-plomb-export.xlsx')
  }
  return (
    <div>
      <h2>Export Excel</h2>
      <button onClick={exportAll}>Exporter tout en XLSX</button>
    </div>
  )
}
