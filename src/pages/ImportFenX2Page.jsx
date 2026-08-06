import React, { useState, useEffect } from 'react'
import { getChantiers, addMesures, getPiecesByChantier, addPieceWithSupports, reclassifyMesuresByChantier, addChantier, addPiece, addSupport } from '../services/storage'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { parseRows, parseNumber, classify } from '../services/fenx2Parser'

export default function ImportFenX2Page(){
  const [file, setFile] = useState(null)
  const [chantiers, setChantiers] = useState([])
  const [chantierId, setChantierId] = useState('')
  const [importMode, setImportMode] = useState('fenx2') // fenx2 | logiciel | logiciel_direct
  const [preview, setPreview] = useState(null)
  const [rawRows, setRawRows] = useState([])
  useEffect(()=>{ getChantiers().then(setChantiers) },[])

  const parseCSV = (text)=>{
    return new Promise((res)=>{
      Papa.parse(text, {header:true, skipEmptyLines:true, complete:(r)=>res(r.data)})
    })
  }

  const readRows = async (f)=>{
    const name = f.name.toLowerCase()
    if (name.endsWith('.csv')){
      const text = await f.text()
      return parseCSV(text)
    }
    const ab = await f.arrayBuffer()
    const wb = XLSX.read(ab, {type:'array'})
    const first = wb.Sheets[wb.SheetNames[0]]
    return XLSX.utils.sheet_to_json(first, { defval: '' })
  }

  const normalizeKey = (k)=> String(k||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'_')

  const mapLogicielRow = (row)=>{
    const keys = {}
    for (const k of Object.keys(row||{})) keys[normalizeKey(k)] = k
    const get = (aliases)=>{
      for (const a of aliases){
        if (keys[a] !== undefined) return row[keys[a]]
      }
      return ''
    }
    return {
      piece: String(get(['piece', 'localisation']) || '').trim(),
      repere: String(get(['repere_plan', 'zone']) || '').trim(),
      numUd: String(get(['num_ud', 'n_ud']) || '').trim(),
      nomUd: String(get(['nom_ud', 'element']) || '').trim(),
      substrat: String(get(['substrat']) || '').trim(),
      revetement: String(get(['revetement_apparent', 'revetement']) || '').trim(),
      hauteur: String(get(['hauteur']) || '').trim(),
      mesure: String(get(['mesure', 'pb']) || '').trim(),
      precision: String(get(['precision_de_la_mesure', 'precision']) || '').trim(),
      etat: String(get(['type_degradation', 'etat']) || '').trim(),
      degradation: String(get(['degradation']) || '').trim(),
      classement: String(get(['classement']) || '').trim(),
      partie: String(get(['partie_mesuree', 'element']) || '').trim(),
      observations: String(get(['observations']) || '').trim()
    }
  }

  const buildPreview = (rows, mode)=>{
    const cols = rows.length ? Object.keys(rows[0]) : []
    return { mode, count: rows.length, cols, sample: rows.slice(0,5) }
  }

  const onSelectFile = async (f)=>{
    setFile(f || null)
    setPreview(null)
    setRawRows([])
    if (!f) return
    const rows = await readRows(f)
    setRawRows(rows)
    setPreview(buildPreview(rows, importMode))
  }

  const handleImport = async ()=>{
    alert('HANDLE IMPORT EXECUTE')
    alert('Fonction appelée: handleImport\nFichier: src/pages/ImportFenX2Page.jsx\nLigne: ~95')
    if (!file) return alert('Choisir un fichier')
    if (importMode === 'logiciel_direct'){
      const rows = rawRows.length ? rawRows : await readRows(file)
        const chantierName = file.name.replace(/\.(xlsx|xls|csv)$/i,'') + ' (import logiciel direct)'
        const newChantierId = await addChantier({ name: chantierName, client:'', address:'', date: new Date().toISOString().slice(0,10) })
        const pieceByName = {}
        const supportByPiece = {}
        const mesuresToAdd = []
        let seq = 1

        const readRaw = (row, names)=>{
          for (const n of names){
            if (row[n] !== undefined) return row[n]
          }
          return ''
        }
        const toEtatConservation = (etat, degradation)=>{
          const n = String(etat||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
          const d = String(degradation||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
          if (n === 'non visible') return 'Non visible'
          if (n === 'non degrade') return 'Non dégradé'
          if (n.includes("etat d'usage") || n.includes('etat d usage') || n.includes('etat dusage')) return "État d'usage"
          if (n === 'degrade' || n.includes('degrad')) return 'Dégradé'
          if (d === 'non visible') return 'Non visible'
          if (d === 'non degrade') return 'Non dégradé'
          if (d.includes("etat d'usage") || d.includes('etat d usage') || d.includes('etat dusage')) return "État d'usage"
          if (d === 'degrade' || d.includes('degrad')) return 'Dégradé'
          return 'Non visible'
        }

        for (const row of rows){
          const pieceRaw = String(readRaw(row, ['Localisation']) || '').trim()
          const repereRaw = String(readRaw(row, ['Zone']) || '').trim()
          const elementRaw = String(readRaw(row, ['Elément', 'Element']) || '').trim()
          const substratRaw = String(readRaw(row, ['Substrat']) || '').trim()
          const revetementRaw = String(readRaw(row, ['Revêtement', 'Revetement']) || '').trim()
          const pbRaw = String(readRaw(row, ['Pb']) || '').trim()
          const precisionRaw = String(readRaw(row, ['Précision', 'Precision']) || '').trim()
          const etatRaw = String(readRaw(row, ['Etat', 'État']) || '').trim()
          const degradationRaw = String(readRaw(row, ['Dégradation', 'Degradation']) || '').trim()
          const observationsRaw = String(readRaw(row, ['Observations']) || '').trim()

          const isEmpty = !pieceRaw && !repereRaw && !elementRaw && !substratRaw && !revetementRaw && !pbRaw && !precisionRaw && !etatRaw && !degradationRaw && !observationsRaw
          if (isEmpty) continue

          const pieceName = pieceRaw || 'Sans nom'
          let pieceId = pieceByName[pieceName]
          if (!pieceId){
            pieceId = await addPiece({ chantierId: Number(newChantierId), name: pieceName, numUd: '' })
            pieceByName[pieceName] = pieceId
          }
          const supportName = elementRaw || 'Support'
          const skey = `${pieceId}::${supportName}`
          let supportId = supportByPiece[skey]
          if (!supportId){
            supportId = await addSupport({ pieceId: Number(pieceId), name: supportName })
            supportByPiece[skey] = supportId
          }

          const etatConservation = toEtatConservation(etatRaw, degradationRaw)
          const pbValue = parseNumber(pbRaw)
          const classe = classify(pbValue, etatConservation)
          mesuresToAdd.push({
            chantierId: Number(newChantierId),
            pieceId: Number(pieceId),
            supportId: Number(supportId),
            num: String(seq++),
            numUd: '',
            point: repereRaw,
            zone: repereRaw,
            element: elementRaw,
            substrat: substratRaw,
            revetement: revetementRaw,
            hauteur: String(readRaw(row, ['Hauteur']) || '').trim(),
            Pb: pbRaw,
            Pb_value: pbValue,
            precision: precisionRaw,
            etat_conservation: etatConservation,
            classe,
            conservationClass: classe,
            observations: observationsRaw
          })
        }

        if (mesuresToAdd.length){
          await addMesures(mesuresToAdd)
          try{ await reclassifyMesuresByChantier(Number(newChantierId)) }catch(e){ console.error('reclassify error', e) }
        }
        alert(`Import logiciel (mode direct) terminé: ${mesuresToAdd.length} ligne(s) importée(s)`)
        return
    }

    if (importMode === 'fenx2'){
      if (!chantierId) return alert('Choisir un chantier')
      const rows = rawRows.length ? rawRows : await readRows(file)
      const parsed = parseRows(rows)
      const pieces = await getPiecesByChantier(chantierId)
      for (const p of parsed){
        p.chantierId = Number(chantierId)
        let piece = null
        if (p.numUd) piece = pieces.find(x=> x.numUd && String(x.numUd) === String(p.numUd))
        if (!piece && p.numUd){
          const ls = localStorage.getItem('autoCreateSupports')
          const autoSupports = ls === null ? true : (ls === 'true')
          const id = await addPieceWithSupports({chantierId:Number(chantierId), name:`UD ${p.numUd}`, numUd: String(p.numUd)}, autoSupports)
          piece = {id, numUd: p.numUd}
          pieces.push(piece)
        }
        if (piece) p.pieceId = piece.id
        p.num = p.num || ''
      }
      if (parsed.length) {
        await addMesures(parsed)
        try{ await reclassifyMesuresByChantier(Number(chantierId)) }catch(e){ console.error('reclassify error', e) }
      }
      alert(`Import FenX2 terminé: ${parsed.length} mesures`)
      return
    }

    const rows = rawRows.length ? rawRows : await readRows(file)
    alert('Rows lues : ' + rows.length)
    const mapped = []
    const rejected = []
    const importRows = rows.map(mapLogicielRow)
    console.log('Première ligne source :', rows[0])
    const exploitableRows = []
    alert('Rows après mapping : ' + importRows.length)
    console.log('Première ligne importée :', importRows[0])
    console.log('Nombre de lignes après mapping :', importRows.length)
    rows.forEach((row, idx)=>{
      if (idx < 10){
        console.log({
          localisation: row["Localisation"],
          zone: row["Zone"],
          element: row["Elément"],
          substrat: row["Substrat"],
          revetement: row["Revêtement"],
          pb: row["Pb"]
        })
      }
      const m = importRows[idx]
      const check = isLogicielRowExploitable(m)
      if (check.exploitable){
        mapped.push(m)
        exploitableRows.push(m)
      } else {
        const raison = `aucune propriété exploitable. Présentes=[${check.present.join(', ')}], absentes=[${check.missing.join(', ')}], colonnes source=[${Object.keys(row || {}).join(', ')}]`
        console.log('Ligne rejetée car :', raison)
        rejected.push({ idx, raison })
      }
    })
    console.log('Nombre de lignes après filtrage :', exploitableRows.length)
    alert('Rows exploitables : ' + exploitableRows.length)
    console.log(`Lignes lues: ${rows.length}, mappées: ${importRows.length}, rejetées: ${rejected.length}`)
    console.log('Résultat du mapping :', mapped[0])
    console.log('mapped:', mapped)
    console.log(`Import logiciel: ${mapped.length} ligne(s) exploitable(s), ${rejected.length} ligne(s) rejetée(s)`)
    if (!mapped.length){
      alert(JSON.stringify(importRows[0], null, 2))
      return alert('Aucune ligne exploitable détectée')
    }

    const chantierName = file.name.replace(/\.(xlsx|xls|csv)$/i,'') + ' (import logiciel)'
    const newChantierId = await addChantier({ name: chantierName, client:'', address:'', date: new Date().toISOString().slice(0,10) })

    const pieceByName = {}
    const supportByPiece = {}
    const mesuresToAdd = []
    let seq = 1

    const toEtatConservation = (etat, degradation)=>{
      const n = String(etat||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      const d = String(degradation||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      if (n === 'non visible') return 'Non visible'
      if (n === 'non degrade') return 'Non dégradé'
      if (n.includes("etat d'usage") || n.includes('etat d usage') || n.includes('etat dusage')) return "État d'usage"
      if (n === 'degrade' || n.includes('degrad')) return 'Dégradé'
      if (d === 'non visible') return 'Non visible'
      if (d === 'non degrade') return 'Non dégradé'
      if (d.includes("etat d'usage") || d.includes('etat d usage') || d.includes('etat dusage')) return "État d'usage"
      if (d === 'degrade' || d.includes('degrad')) return 'Dégradé'
      return 'Non visible'
    }

    for (const r of mapped){
      const pieceName = r.piece || `UD ${r.numUd || ''}`.trim() || 'Sans nom'
      let pieceId = pieceByName[pieceName]
      if (!pieceId){
        pieceId = await addPiece({ chantierId: Number(newChantierId), name: pieceName, numUd: r.numUd || '' })
        pieceByName[pieceName] = pieceId
      }
      const supportName = r.partie || r.nomUd || 'Support'
      const skey = `${pieceId}::${supportName}`
      let supportId = supportByPiece[skey]
      if (!supportId){
        supportId = await addSupport({ pieceId: Number(pieceId), name: supportName })
        supportByPiece[skey] = supportId
      }
      const etatConservation = toEtatConservation(r.etat, r.degradation)
      const pbValue = parseNumber(r.mesure)
      const classe = classify(pbValue, etatConservation)
      mesuresToAdd.push({
        chantierId: Number(newChantierId),
        pieceId: Number(pieceId),
        supportId: Number(supportId),
        num: String(seq++),
        numUd: r.numUd || '',
        point: r.repere || '',
        zone: r.repere || '',
        element: r.partie || r.nomUd || '',
        substrat: r.substrat || '',
        revetement: r.revetement || '',
        hauteur: r.hauteur || '',
        Pb: r.mesure || '',
        Pb_value: pbValue,
        precision: r.precision || '',
        etat_conservation: etatConservation,
        classe,
        conservationClass: classe,
        observations: r.observations || ''
      })
    }
    await addMesures(mesuresToAdd)
    try{ await reclassifyMesuresByChantier(Number(newChantierId)) }catch(e){ console.error('reclassify error', e) }
    alert(`Import logiciel terminé: chantier créé (${chantierName}), ${Object.keys(pieceByName).length} pièce(s), ${mesuresToAdd.length} mesure(s)`)
  }

  return (
    <div>
      <h2>📥 Import Excel</h2>
      <h3 style={{color:'red'}}>IMPORT-PAGE-V3</h3>
      <div style={{marginBottom:10}}>
        <label><input type="radio" checked={importMode==='fenx2'} onChange={()=>{ setImportMode('fenx2'); if (rawRows.length) setPreview(buildPreview(rawRows,'fenx2')) }} /> Import FenX2</label>
        <label style={{marginLeft:12}}><input type="radio" checked={importMode==='logiciel'} onChange={()=>{ setImportMode('logiciel'); if (rawRows.length) setPreview(buildPreview(rawRows,'logiciel')) }} /> Import logiciel</label>
        <label style={{marginLeft:12}}><input type="radio" checked={importMode==='logiciel_direct'} onChange={()=>{ setImportMode('logiciel_direct'); if (rawRows.length) setPreview(buildPreview(rawRows,'logiciel_direct')) }} /> 📥 Import logiciel (mode direct)</label>
      </div>
      {importMode==='fenx2' && (
        <div>
          <select value={chantierId} onChange={e=>setChantierId(e.target.value)}>
            <option value="">Sélectionner chantier</option>
            {chantiers.map(c=> <option value={c.id} key={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      <div style={{marginTop:8}}>
        <input type="file" accept=".csv,.xlsx,.xls" onChange={e=>onSelectFile(e.target.files?.[0]||null)} />
        <button onClick={handleImport}>✅ Importer</button>
      </div>
      {preview && (
        <div style={{marginTop:12, border:'1px solid #ddd', padding:10}}>
          <h3>Prévisualisation avant import</h3>
          <div>Nombre de lignes détectées: <strong>{preview.count}</strong></div>
          <div>Colonnes détectées ({preview.cols.length}): <strong>{preview.cols.join(' | ')}</strong></div>
          <div style={{marginTop:8}}>
            <table border={1} cellPadding={4}>
              <thead>
                <tr>{preview.cols.slice(0,12).map(c => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {preview.sample.map((r, i)=> (
                  <tr key={i}>
                    {preview.cols.slice(0,12).map(c => <td key={c}>{String(r[c] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
