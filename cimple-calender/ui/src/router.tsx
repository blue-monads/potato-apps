import { createBrowserRouter, Outlet } from "react-router";
import { Suspense } from 'react';
import "./index.css";
import Home from "./Home/Home";
import { BASE_PATH } from "./lib/base";

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-[#f8f9fa]">
    <div className="text-sm font-semibold text-gray-500 animate-pulse">Loading Cimple Calendar...</div>
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
        element: <Home />,
      },
    ],
  },
]);

export default router;