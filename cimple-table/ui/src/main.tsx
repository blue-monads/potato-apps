import { createBrowserRouter, RouterProvider, Navigate, Outlet } from "react-router";
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import "./index.css";
import { BASE_PATH } from "./lib/base";
import App from "./App";
import { ModalProvider } from "./lib/shared/modal/modal";
import WithSpaceAuth from "./lib/shared/WithSpaceAuth";

const TablePage = lazy(() => import("./pages/table/Table"));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-lg">Loading...</div>
  </div>
);


const RootLayout = () => (
    <Suspense fallback={<LoadingFallback />}>
        <WithSpaceAuth spaceKey="cimple-table">
          <ModalProvider>
            <Outlet />
          </ModalProvider>
        </WithSpaceAuth>
    </Suspense>
);

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
            element: <Navigate to={`${BASE_PATH}table`} replace />,
          },
          {
            path: "table",
            element: <TablePage />,
          },
          {
            path: "table/:tableId",
            element: <TablePage />,
          },
        ]
      },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
