import React, { useState, useEffect } from 'react'
import { getChantiers, addMesures, getPiecesByChantier, addPiece } from '../services/storage'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { parseRows } from '../services/fenx2Parser'

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
    // Parse FenX2 rows
    const parsed = parseRows(rows)
    // try to match pieces by numUd and create pieces if needed
    const pieces = await getPiecesByChantier(chantierId)
    for (const p of parsed){
      p.chantierId = Number(chantierId)
      // match piece by numUd
      let piece = null
      if (p.numUd) piece = pieces.find(x=> x.numUd && String(x.numUd) === String(p.numUd))
      if (!piece && p.numUd){
        const id = await addPiece({chantierId:Number(chantierId), name:`UD ${p.numUd}`, numUd: String(p.numUd)})
        piece = {id, numUd: p.numUd}
        pieces.push(piece)
      }
      if (piece) p.pieceId = piece.id
      // map fields to DB schema
      p.num = p.num || ''
    }
    if (parsed.length) await addMesures(parsed)
    alert(`Importé ${parsed.length} mesures`)
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
