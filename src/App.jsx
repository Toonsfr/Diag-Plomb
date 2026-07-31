import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import PiecesPage from './pages/PiecesPage'
import ImportFenX2Page from './pages/ImportFenX2Page'
import MesuresPage from './pages/MesuresPage'
import ExportPage from './pages/ExportPage'
import Sidebar from './components/Sidebar'
import './index.css'

export default function App(){
  return (
    <BrowserRouter>
      <div className="app-root">
        <Sidebar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/pieces/:chantierId" element={<PiecesPage />} />
            <Route path="/import" element={<ImportFenX2Page />} />
            <Route path="/mesures/:chantierId" element={<MesuresPage />} />
            <Route path="/export" element={<ExportPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
