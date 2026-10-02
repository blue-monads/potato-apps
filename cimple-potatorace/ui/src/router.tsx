import { createBrowserRouter, Outlet } from "react-router";
import React, { Suspense } from 'react';
import "./index.css";
import Home from "./Home/Home";
import { BASE_PATH } from "./lib/base";

const LobbyPage = React.lazy(() => import("./Lobby/Lobby"));
const TVPage = React.lazy(() => import("./TV/TV"));

const LoadingFallback = () => (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg)', color: 'var(--txt)' }}>
        <div className="text-lg">Loading…</div>
    </div>
);

const RootLayout = () => (
    <Suspense fallback={<LoadingFallback />}>
        <Outlet />
    </Suspense>
);

const router = createBrowserRouter([
    {
        path: BASE_PATH,
        element: <RootLayout />,
        children: [
            {
                index: true,
                path: BASE_PATH,
                element: <Home />,
            },
            {
                path: `${BASE_PATH}lobby/:roomId`,
                element: <LobbyPage />,
            },
            {
                path: `${BASE_PATH}tv/:roomId`,
                element: <TVPage />,
            },
        ],
    },
]);

export default router;