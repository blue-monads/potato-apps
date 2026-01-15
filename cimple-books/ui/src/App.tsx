import { Outlet } from 'react-router'
import Sidebar from './components/Sidebar'

function App() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-32 md:ml-48">
        <Outlet />
      </main>
    </div>
  )
}

export default App
