import { createBrowserRouter, RouterProvider, Navigate, Outlet, useRouteError } from "react-router";
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BASE_PATH } from "./lib/base";
import "./index.css";
import WithSpaceAuth from "./lib/shared/WithSpaceAuth";
import App from "./App";
import { ModalProvider } from "./lib/shared/modal/modal";

const Events = lazy(() => import("./pages/event/Events"));
const Maps = lazy(() => import("./pages/event/Maps"));
const CreateEvent = lazy(() => import("./pages/event/CreateEvent"));
const CreateEventType = lazy(() => import("./pages/event/CreateEventType"));
const FeatureEditor = lazy(() => import("./pages/feature/FeatureEditor"));
const CreateFeature = lazy(() => import("./pages/feature/CreateFeature"));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-lg">Loading...</div>
  </div>
);

const RouteErrorBoundary = () => {
  const error = useRouteError() as any;
  console.error("Route error:", error);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl text-center">
        <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-xl font-bold mb-2">Map Workspace Error</h2>
        <p className="text-sm text-slate-400 mb-6 font-mono text-left bg-slate-950 p-3 rounded border border-slate-800 break-words">
          {error?.message || "An unexpected error occurred while rendering the workspace."}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            Reload Page
          </button>
          <button
            onClick={() => {
              window.location.href = `${BASE_PATH}maps`;
            }}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            Back to Maps
          </button>
        </div>
      </div>
    </div>
  );
};

const RootLayout = () => (
    <Suspense fallback={<LoadingFallback />}>
        <WithSpaceAuth spaceKey="cimple-eventmap">
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
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <App />,
        children: [
          {
            index: true,
            element: <Navigate to={`${BASE_PATH}maps`} replace />,
          },
          {
            path: "events",
            element: <Events />,
          },
          {
            path: "maps",
            element: <Maps />,
          },
          {
            path: "create-event",
            element: <CreateEvent />,
          },
          {
            path: "create-event-type",
            element: <CreateEventType />,
          },
          {
            path: "features",
            element: <FeatureEditor />,
          },
          {
            path: "create-feature",
            element: <CreateFeature />,
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
