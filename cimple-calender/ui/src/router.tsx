import { createBrowserRouter, Outlet } from "react-router";
import React, { Suspense } from 'react'
import "./index.css";
import Home from "./Home/Home";
import { BASE_PATH } from "./lib/base";

const AuthorPage = React.lazy(() => import("./Author/Author"));


const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-lg">Loading...</div>
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
        path: `${BASE_PATH}:author`,
        element: <AuthorPage />,
      },
    ],

  },
]);

export default router;