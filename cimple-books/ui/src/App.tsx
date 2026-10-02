import { useState, useEffect } from 'react'
import { Outlet } from 'react-router'
import Sidebar from './components/Sidebar'

function App() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('cimple_books_sidebar_collapsed') === 'true'
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault()
        setCollapsed((prev) => {
          const next = !prev
          localStorage.setItem('cimple_books_sidebar_collapsed', String(next))
          return next
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleToggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('cimple_books_sidebar_collapsed', String(next))
      return next
    })
  }

  return (
    <div className="flex min-h-screen bg-[#F4F5F1] print:block print:min-h-0 print:bg-white">
      <div className="print:hidden">
        <Sidebar isCollapsed={collapsed} onToggle={handleToggle} />
      </div>
      <main className={`flex-1 transition-all duration-200 min-h-screen print:min-h-0 print:ml-0 print:m-0 print:p-0 ${collapsed ? 'ml-16' : 'ml-36 md:ml-52'}`}>
        <Outlet />
      </main>
    </div>
  )
}

export default App
