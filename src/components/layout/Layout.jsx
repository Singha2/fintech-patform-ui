import { Outlet } from 'react-router-dom'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'

export default function Layout({ currentPersona, onPersonaChange }) {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <TopBar currentPersona={currentPersona} onPersonaChange={onPersonaChange} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentPersona={currentPersona} />
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
