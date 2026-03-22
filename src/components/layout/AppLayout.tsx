import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const location = useLocation()

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-[#fafafa]">
        <div key={location.pathname} className="max-w-5xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
