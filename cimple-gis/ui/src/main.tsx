import { createBrowserRouter, RouterProvider, Navigate, Outlet } from "react-router";
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


const RootLayout = () => (
    <Suspense fallback={<LoadingFallback />}>
        <WithSpaceAuth spaceKey="cimple-gis">
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
            element: <Navigate to={`${BASE_PATH}events`} replace />,
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
