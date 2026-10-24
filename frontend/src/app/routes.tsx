import { lazy } from 'react'
import { Route, Routes } from 'react-router'
import { AppLayout } from '../components/layout/AppLayout'
import { HomePage } from '../features/home/HomePage'
import { NotFoundPage } from '../features/not-found/NotFoundPage'
import { OperationalLayout } from '../components/layout/OperationalLayout'
import type { SalesHistoryReader } from '../domain/salesHistory'
import type { DashboardService } from '../services/dashboardOperations'
import type { CreditService } from '../services/creditOperations'
import type { CustomerService } from '../services/customerOperations'

// Keep the layout/provider mounted when pages suspend so the cart and checkout
// operation identity survive navigation. Excel imports remain dynamic as before.
const CashierPage = lazy(() => import('../features/cashier/CashierPage').then((module) => ({ default: module.CashierPage })))
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const ProductsPage = lazy(() => import('../features/products/ProductsPage').then((module) => ({ default: module.ProductsPage })))
const StockPage = lazy(() => import('../features/stock/StockPage').then((module) => ({ default: module.StockPage })))
const CreditPage = lazy(() => import('../features/credit/CreditPage').then((module) => ({ default: module.CreditPage })))
const ReportsPage = lazy(() => import('../features/reports/ReportsPage').then((module) => ({ default: module.ReportsPage })))
const SettingsPage = lazy(() => import('../features/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const SalesHistoryPage = lazy(() => import('../features/sales-history/SalesHistoryPage').then((module) => ({ default: module.SalesHistoryPage })))
const SaleDetailsPage = lazy(() => import('../features/sales-history/SaleDetailsPage').then((module) => ({ default: module.SaleDetailsPage })))

export function AppRoutes({ salesHistory, dashboard, credit, customers }: { salesHistory?: SalesHistoryReader; dashboard?: DashboardService; credit?: CreditService; customers?: CustomerService } = {}) {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
      </Route>
      <Route element={<OperationalLayout />}>
        <Route path="dashboard" element={<DashboardPage service={dashboard} />} />
        <Route path="kasir" element={<CashierPage />} />
        <Route path="produk" element={<ProductsPage />} />
        <Route path="stok" element={<StockPage />} />
        <Route path="penjualan" element={<SalesHistoryPage service={salesHistory} />} />
        <Route path="penjualan/:saleId" element={<SaleDetailsPage service={salesHistory} />} />
        <Route path="bon" element={<CreditPage service={credit} customers={customers} />} />
        <Route path="laporan" element={<ReportsPage />} />
        <Route path="pengaturan" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
