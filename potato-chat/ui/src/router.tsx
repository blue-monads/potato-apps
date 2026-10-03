import { createBrowserRouter, Outlet, useRouteError } from "react-router";
import { Suspense, lazy } from 'react';
import "./index.css";
import { BASE_PATH } from "./lib/base";
import ChatView from "./Chat/ChatView";

const Settings = lazy(() => import("./Settings/Settings"));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-lg">Loading...</div>
  </div>
);

const ErrorBoundary = () => {
  const error = useRouteError();
  console.error("Route error:", error);
  return (
    <div className="p-8 text-center">
      <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
      <pre className="text-sm text-gray-600">{JSON.stringify(error, null, 2)}</pre>
    </div>
  );
};

const RootLayout = () => (
  <Suspense fallback={<LoadingFallback />}>
    <Outlet />
  </Suspense>
);

const router = createBrowserRouter([
  {
    path: BASE_PATH,
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <ChatView />,
      },
      {
        path: "settings",
        element: <Settings />,
      },
      {
        path: "*",
        element: <div className="p-8 text-center">404 - Page not found</div>,
      },
    ],
  },
]);

export default router;