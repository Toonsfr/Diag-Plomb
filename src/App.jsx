import React from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import ChantierPage from './pages/ChantierPage'
import ImportFenX2Page from './pages/ImportFenX2Page'
import MesuresPage from './pages/MesuresPage'
import ExportPage from './pages/ExportPage'
import './index.css'

export default function App(){
  return (
    <BrowserRouter>
      <div className="app-root">
        <header className="app-header">
          <h1>Diag Plomb Terrain Pro</h1>
          <nav>
            <Link to="/">Dashboard</Link> |
            <Link to="/import"> Import FenX2</Link> |
            <Link to="/export"> Export</Link>
          </nav>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/chantier/:id" element={<ChantierPage />} />
            <Route path="/import" element={<ImportFenX2Page />} />
            <Route path="/mesures/:chantierId" element={<MesuresPage />} />
            <Route path="/export" element={<ExportPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
