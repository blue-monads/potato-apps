import { createBrowserRouter, RouterProvider, Navigate, Outlet } from "react-router";
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import "./index.css";
import { BASE_PATH } from "./lib/base";
import WithSpaceAuth from "./lib/shared/WithSpaceAuth";
import App from "./App";
import { ModalProvider } from "./lib/shared/modal/modal";

const ListAccount = lazy(() => import("./pages/account/ListAccount"));
const ProductManagement = lazy(() => import("./pages/product/ProductManagement"));
const ListSales = lazy(() => import("./pages/sales/ListSales"));
const SalesForm = lazy(() => import("./pages/sales/SalesForm"));
const ListTxn = lazy(() => import("./pages/txn/ListTxn"));
const ListEstimates = lazy(() => import("./pages/estimates/ListEstimates"));
const ListTax = lazy(() => import("./pages/tax/ListTax"));
const ReportsList = lazy(() => import("./pages/reports/ReportsList"));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-lg">Loading...</div>
  </div>
);


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
            path: "products",
            element: <ProductManagement />,
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
            path: "estimates",
            element: <ListEstimates />,
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
                element: <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Report Coming Soon</h2>
                    <p className="text-gray-600">This report will be implemented in a future update.</p>
                  </div>
                </div>,
              },
            ],
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
