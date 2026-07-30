import React, { useState, useEffect } from 'react'
import { getChantiers, getChantier, addMesures, getPiecesByChantier, addPiece } from '../services/storage'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export default function ImportFenX2Page(){
  const [file, setFile] = useState(null)
  const [chantiers, setChantiers] = useState([])
  const [chantierId, setChantierId] = useState('')
  useEffect(()=>{ getChantiers().then(setChantiers) },[])

  const parseCSV = (text)=>{
    return new Promise((res)=>{
      Papa.parse(text, {header:true, skipEmptyLines:true, complete:(r)=>res(r.data)})
    })
  }

  const handleFile = async ()=>{
    if (!file || !chantierId) return alert('Choisir fichier et chantier')
    const name = file.name.toLowerCase()
    let rows = []
    if (name.endsWith('.csv')){
      const text = await file.text()
      rows = await parseCSV(text)
    } else {
      const ab = await file.arrayBuffer()
      const wb = XLSX.read(ab, {type:'array'})
      const first = wb.Sheets[wb.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json(first)
    }
    // Map rows to mesures
    const pieces = await getPiecesByChantier(chantierId)
    const mesures = []
    for (const r of rows){
      const m = {
        chantierId: Number(chantierId),
        pieceId: null,
        num: r.num || r.NUM || r.Num || '',
        numUd: r.numUd || r.num_ud || r.numUd || '',
        Pb: r.Pb || r.Pb || r.Pb || '',
        precision: r.précision || r.precision || r.precise || '',
        date: r.date || '',
        livetime: r.livetime || r.livetime || ''
      }
      // try to find piece by numUd
      let piece = pieces.find(p=> p.numUd && String(p.numUd) === String(m.numUd))
      if (!piece && m.numUd){
        const id = await addPiece({chantierId:Number(chantierId), name:`UD ${m.numUd}`, numUd: String(m.numUd)})
        piece = {id, numUd: m.numUd}
      }
      if (piece) m.pieceId = piece.id
      mesures.push(m)
    }
    if (mesures.length) await addMesures(mesures)
    alert(`Importé ${mesures.length} mesures`) 
  }

  return (
    <div>
      <h2>Import FenX2 (CSV / XLSX)</h2>
      <div>
        <select value={chantierId} onChange={e=>setChantierId(e.target.value)}>
          <option value="">Sélectionner chantier</option>
          {chantiers.map(c=> <option value={c.id} key={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div style={{marginTop:8}}>
        <input type="file" accept=".csv,.xlsx,.xls" onChange={e=>setFile(e.target.files?.[0]||null)} />
        <button onClick={handleFile}>Importer</button>
      </div>
    </div>
  )
}
