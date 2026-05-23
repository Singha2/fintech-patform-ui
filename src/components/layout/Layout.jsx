import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'

export default function Layout({ currentPersona, onPersonaChange }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <TopBar
        currentPersona={currentPersona}
        onPersonaChange={onPersonaChange}
        onMenuToggle={() => setSidebarOpen(o => !o)}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          currentPersona={currentPersona}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
