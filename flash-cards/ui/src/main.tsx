import './index.css';
import App from "./App";
import { StrictMode, Suspense, lazy } from 'react'
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from "react-router";
import { ModalProvider } from "./lib/shared/modal/modal";
import WithSpaceAuth from './lib/shared/WithSpaceAuth';
import { BASE_PATH } from './lib/base';
import { createRoot } from 'react-dom/client';
import DecksPage from './pages/deck/Deck';
import { DeckDetailPage } from './pages/deck/DeckDetails';


const LoadingFallback = () => (
    <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
    </div>
)


const RootLayout = () => (
    <Suspense fallback={<LoadingFallback />}>
        <WithSpaceAuth spaceKey="flash-cards">
            <ModalProvider>
                <Outlet />
            </ModalProvider>
        </WithSpaceAuth>
    </Suspense>
)


const router = createBrowserRouter([
    {
        path: BASE_PATH,
        element: <RootLayout />,
        children: [
            {
               element: <App />,
               children: [
                {
                    index: true,
                    element: <Navigate to={`${BASE_PATH}deck`} replace />,
                },
                {
                    path: 'deck',
                    element: <DecksPage />
                },
                {
                    path: "deck/:deckId",
                    element: <DeckDetailPage />,
                }
               ]
            },
        ]
    }
]);

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <RouterProvider router={router} />
    </StrictMode>
)