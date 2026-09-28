import { Outlet } from 'react-router'
import Sidebar from './components/Sidebar'

function App() {
  return (
    <div className="flex min-h-screen bg-[#F4F5F1]">
      <Sidebar />
      <main className="flex-1 ml-36 md:ml-52 min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}

export default App
