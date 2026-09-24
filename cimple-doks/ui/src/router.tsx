import { createBrowserRouter, Outlet } from "react-router";
import { Suspense } from "react";
import "./index.css";
import { App } from "./App";
import { BASE_PATH } from "./lib/base";

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-[#f7f7f5]">
    <div className="text-sm text-[#77776f]">Loading Cimple Doks…</div>
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
        element: <App />,
      },
      {
        path: ":docId",
        element: <App />,
      },
    ],
  },
]);

export default router;