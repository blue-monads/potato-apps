import { Outlet } from 'react-router';

function App() {
    return (
        <div className='min-h-screen w-full'>
            <Outlet />
        </div>
    )
}

export default App;