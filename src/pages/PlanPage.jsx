import React, { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { getChantier, getPlanFilesByChantier, addPlanFile, deletePlanFile } from '../services/storage'

export default function PlanPage(){
  const { chantierId } = useParams()
  const [chantier, setChantier] = useState(null)
  const [plans, setPlans] = useState([])
  const [selected, setSelected] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({x:0,y:0})
  const [isPanning, setIsPanning] = useState(false)
  const startPan = useRef({x:0,y:0,origX:0,origY:0})
  const containerRef = useRef()

  useEffect(()=>{ load() },[chantierId])
  const load = async ()=>{
    if (!chantierId) return
    setChantier(await getChantier(chantierId))
    const pf = await getPlanFilesByChantier(chantierId)
    setPlans(pf || [])
  }

  const onFile = async (e)=>{
    const f = e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = async (ev)=>{
      const dataUrl = ev.target.result
      await addPlanFile({ chantierId: Number(chantierId), name: f.name, type: f.type, dataUrl })
      load()
    }
    reader.readAsDataURL(f)
  }

  const openViewer = (plan)=>{ setSelected(plan); setZoom(1); setPos({x:0,y:0}) }
  const closeViewer = ()=> setSelected(null)

  const doZoom = (delta)=> setZoom(z => Math.min(5, Math.max(0.2, +(z+delta).toFixed(2))))
  const resetView = ()=>{ setZoom(1); setPos({x:0,y:0}) }

  // mouse handlers
  const onPointerDown = (e)=>{
    e.preventDefault()
    setIsPanning(true)
    startPan.current = { x: e.clientX, y: e.clientY, origX: pos.x, origY: pos.y }
  }
  const onPointerMove = (e)=>{
    if (!isPanning) return
    const dx = e.clientX - startPan.current.x
    const dy = e.clientY - startPan.current.y
    setPos({ x: startPan.current.origX + dx, y: startPan.current.origY + dy })
  }
  const onPointerUp = ()=>{ setIsPanning(false) }

  // touch handlers
  const onTouchStart = (e)=>{
    if (!e.touches || e.touches.length === 0) return
    const t = e.touches[0]
    setIsPanning(true)
    startPan.current = { x: t.clientX, y: t.clientY, origX: pos.x, origY: pos.y }
  }
  const onTouchMove = (e)=>{
    if (!isPanning || !e.touches || e.touches.length === 0) return
    const t = e.touches[0]
    const dx = t.clientX - startPan.current.x
    const dy = t.clientY - startPan.current.y
    setPos({ x: startPan.current.origX + dx, y: startPan.current.origY + dy })
  }
  const onTouchEnd = ()=> setIsPanning(false)

  const onWheel = (e)=>{
    e.preventDefault()
    const delta = e.deltaY < 0 ? 0.1 : -0.1
    doZoom(delta)
  }

  const goFullscreen = ()=>{
    if (!containerRef.current) return
    const el = containerRef.current
    if (el.requestFullscreen) el.requestFullscreen()
    else if (el.webkitEnterFullscreen) el.webkitEnterFullscreen()
  }

  return (
    <div style={{display:'flex', height: '100%'}}>
      <div style={{width:260, borderRight:'1px solid #ddd', padding:12, boxSizing:'border-box'}}>
        <h3>Plans — {chantier?.name}</h3>
        <div style={{marginBottom:8}}>
          <input type="file" accept="image/*,application/pdf" onChange={onFile} />
        </div>
        <div style={{maxHeight:'70vh', overflowY:'auto'}}>
          <ul style={{padding:0, margin:0, listStyle:'none'}}>
            {plans.map(p=> (
              <li key={p.id} style={{padding:8, borderBottom:'1px solid #eee', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div onClick={()=>openViewer(p)} style={{flex:1}}>
                  <div style={{fontWeight:600}}>{p.name}</div>
                  <div style={{fontSize:12, color:'#666'}}>{new Date(p.createdAt).toLocaleString()}</div>
                </div>
                <div style={{marginLeft:8}}>
                  <button onClick={async (ev)=>{ ev.stopPropagation(); if (!confirm('Supprimer ce plan ?')) return; await deletePlanFile(p.id); load() }}>Suppr</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div ref={containerRef} style={{flex:1, position:'relative', background:'#f6f6f6', display:'flex', flexDirection:'column'}}>
        <div style={{padding:8, borderBottom:'1px solid #eee', display:'flex', gap:8, alignItems:'center'}}>
          <button onClick={resetView}>Reset</button>
          <button onClick={()=>doZoom(-0.2)}>Zoom -</button>
          <button onClick={()=>doZoom(0.2)}>Zoom +</button>
          <button onClick={goFullscreen}>Plein écran</button>
          <div style={{marginLeft:'auto'}}>{selected ? selected.name : 'Aucun plan sélectionné'}</div>
        </div>

        <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', position:'relative'}} onWheel={onWheel} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerDown={onPointerDown} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          {selected ? (
            <div style={{position:'relative', transform:`translate(${pos.x}px, ${pos.y}px)`, touchAction:'none'}}>
              {selected.type === 'application/pdf' ? (
                <iframe title={selected.name} src={selected.dataUrl} style={{width:800*zoom, height:1000*zoom, border:'none'}} />
              ) : (
                <img src={selected.dataUrl} alt={selected.name} style={{width:800*zoom, height:'auto', display:'block'}} />
              )}
            </div>
          ) : (
            <div style={{color:'#666'}}>Sélectionner un plan à gauche ou importer un fichier</div>
          )}
        </div>
      </div>
    </div>
  )
}
