import { Outlet } from 'react-router';

function App() {
  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-50 text-slate-900">
      <Outlet />
    </div>
  );
}

export default App;
