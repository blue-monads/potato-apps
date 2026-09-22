import { createBrowserRouter, RouterProvider, Navigate, Outlet } from "react-router";
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import "./index.css";
import { basePath } from "./lib/base";
import App from "./App";
import Submissions from "./pages/Submissions/Submissions";
import WithSpaceAuth from "./lib/shared/WithSpaceAuth";

const ListingsPage = lazy(() => import("./pages/Listings/ListingsPage"));
const FormBuilderPage = lazy(() => import("./pages/Builder/FormBuilderPage"));
const SubmitterPage = lazy(() => import("./pages/Submitter/SubmitterPage"));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-lg">Loading...</div>
  </div>
);

// Root layout with suspense
const RootLayout = () => (
  <Suspense fallback={<LoadingFallback />}>
    <Outlet />
  </Suspense>
);

// Protected layout with space authentication for admin routes
const ProtectedLayout = () => (
  <WithSpaceAuth spaceKey="cimple-form">
    <App />
  </WithSpaceAuth>
);

// Create router with data router API
const router = createBrowserRouter([
  {
    path: basePath,
    element: <RootLayout />,
    children: [
      {
        path: "submitter",
        element: <SubmitterPage />,
      },
      {
        element: <ProtectedLayout />,
        children: [
          {
            index: true,
            element: <Navigate to={`${basePath}forms`} replace />,
          },
          {
            path: "forms",
            element: <ListingsPage />,
          },
          {
            path: "forms/:formId",
            element: <FormBuilderPage />,
          },
          {
            path: "submissions",
            element: <Submissions />,
          },
        ],
      },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
