import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { getChantiers } from '../services/storage'

export default function Sidebar(){
  const [chantiers, setChantiers] = useState([])
  useEffect(()=>{ getChantiers().then(setChantiers) },[])
  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">Diag Plomb</div>
      <nav>
        <NavLink to="/" end className={({isActive})=> isActive? 'active':''}>Dashboard</NavLink>
        <NavLink to="/import" className={({isActive})=> isActive? 'active':''}>Import FenX2</NavLink>
        <NavLink to="/export" className={({isActive})=> isActive? 'active':''}>Export Excel</NavLink>
        <NavLink to="/plans" className={({isActive})=> isActive? 'active':''}>📐 Plan</NavLink>
        <NavLink to="/backup" className={({isActive})=> isActive? 'active':''}>📂 Sauvegarde / Mobilité</NavLink>
        <NavLink to="/full-backup" className={({isActive})=> isActive? 'active':''}>📦 Sauvegarde complète</NavLink>
        <NavLink to="/offline" className={({isActive})=> isActive? 'active':''}>Hors-ligne / Mobilité</NavLink>
        <NavLink to="/settings" className={({isActive})=> isActive? 'active':''}>⚙ Paramètres</NavLink>
      </nav>
      <div className="sidebar-list">
        <div className="sidebar-subtitle">Chantiers</div>
        <ul>
          {chantiers.map(c=> (
            <li key={c.id}><NavLink to={`/pieces/${c.id}`} className={({isActive})=> isActive? 'active':''}>{c.name}</NavLink></li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
