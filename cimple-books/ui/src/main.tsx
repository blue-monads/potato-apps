import { createBrowserRouter, RouterProvider, Navigate, Outlet, useRouteError } from "react-router";
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import "./index.css";
import { BASE_PATH } from "./lib/base";
import WithSpaceAuth from "./lib/shared/WithSpaceAuth";
import App from "./App";
import { ModalProvider } from "./lib/shared/modal/modal";

const ListAccount = lazy(() => import("./pages/account/ListAccount"));
const ContactsPage = lazy(() => import("./pages/contacts/ContactsPage"));
const ProductManagement = lazy(() => import("./pages/product/ProductManagement"));
const ProductFormPage = lazy(() => import("./pages/product/ProductFormPage"));
const ListStockIn = lazy(() => import("./pages/stockin/ListStockIn"));
const StockInForm = lazy(() => import("./pages/stockin/StockInForm"));
const ListSales = lazy(() => import("./pages/sales/ListSales"));
const SalesForm = lazy(() => import("./pages/sales/SalesForm"));
const ListTxn = lazy(() => import("./pages/txn/ListTxn"));
const ListTax = lazy(() => import("./pages/tax/ListTax"));
const ReportsList = lazy(() => import("./pages/reports/ReportsList"));
const ReportViewer = lazy(() => import("./pages/reports/ReportViewer"));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage"));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-lg text-stone-500 font-sans">Loading...</div>
  </div>
);

const RouteErrorBoundary = () => {
  const error = useRouteError() as any;
  console.error("Route error:", error);

  const errorMsg = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const isChunkError =
    errorMsg.includes('dynamically imported module') ||
    errorMsg.includes('Failed to fetch') ||
    errorMsg.includes('Loading chunk') ||
    errorMsg.includes('Failed to load');

  if (isChunkError) {
    return (
      <div className="min-h-screen bg-[#F4F5F1] p-8 flex flex-col items-center justify-center font-sans">
        <div className="max-w-md bg-white p-6 rounded-2xl border border-[#E1E3DB] shadow-sm text-center">
          <h2 className="text-xl font-bold text-stone-900 mb-2 font-display">New version available</h2>
          <p className="text-stone-600 text-sm mb-5">
            The application was updated. Please refresh the page to load the latest version.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F5F1] p-8 flex flex-col items-center justify-center font-sans">
      <div className="max-w-xl bg-white p-6 rounded-2xl border border-[#E1E3DB] shadow-sm text-center">
        <h2 className="text-xl font-bold text-stone-900 mb-2 font-display">Something went wrong</h2>
        <p className="text-stone-600 text-sm mb-4">
          An error occurred while displaying this page:
        </p>
        <pre className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs text-rose-700 text-left font-mono overflow-auto max-h-48 mb-5 whitespace-pre-wrap">
          {error instanceof Error ? error.stack || error.message : JSON.stringify(error, null, 2)}
        </pre>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 border border-stone-200 hover:bg-stone-50 text-stone-700 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
          >
            Reload
          </button>
          <a
            href={`${BASE_PATH}reports`}
            className="px-4 py-2 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Back to Reports
          </a>
        </div>
      </div>
    </div>
  );
};

// Auto-recover if Vite dynamic import fails due to chunk hash changes after deployment
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

const RootLayout = () => (
    <Suspense fallback={<LoadingFallback />}>
        <WithSpaceAuth spaceKey="cimple-books">
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
            element: <Navigate to={`${BASE_PATH}accounts`} replace />,
          },
          {
            path: "accounts",
            element: <ListAccount />,
          },
          {
            path: "txns",
            element: <ListTxn />,
          },
          {
            path: "contacts",
            element: <ContactsPage />,
          },
          {
            path: "products",
            children: [
              {
                index: true,
                element: <ProductManagement />,
              },
              {
                path: "new",
                element: <ProductFormPage />,
              },
              {
                path: ":id/edit",
                element: <ProductFormPage />,
              },
            ],
          },
          {
            path: "stockin",
            children: [
              {
                index: true,
                element: <ListStockIn />,
              },
              {
                path: "new",
                element: <StockInForm />,
              },
              {
                path: ":id/edit",
                element: <StockInForm />,
              },
            ],
          },
          {
            path: "sales",
            children: [
              {
                index: true,
                element: <ListSales />,
              },
              {
                path: "new",
                element: <SalesForm />,
              },
              {
                path: ":id/edit",
                element: <SalesForm />,
              },
            ],
          },          
          {
            path: "taxes",
            element: <ListTax />,
          },
          {
            path: "reports",
            children: [
              {
                index: true,
                element: <ReportsList />,
              },
              {
                path: ":reportId",
                element: <ReportViewer />,
              },
            ],
          },
          {
            path: "settings",
            element: <SettingsPage />,
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
