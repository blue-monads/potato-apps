import { createBrowserRouter, Outlet } from "react-router";
import { Suspense } from 'react';
import "./index.css";
import Home from "./Home/Home";
import { BASE_PATH } from "./lib/base";

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-500 text-xs">
    <div>Loading Autonoda...</div>
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
    ],
  },
  // Fallback for root / dev
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
    ],
  },
]);

export default router;