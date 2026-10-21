import { Route, Routes } from 'react-router'
import { AppLayout } from '../components/layout/AppLayout'
import { HomePage } from '../features/home/HomePage'
import { NotFoundPage } from '../features/not-found/NotFoundPage'
import { OperationalLayout } from '../components/layout/OperationalLayout'
import { CashierPage } from '../features/cashier/CashierPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { ProductsPage } from '../features/products/ProductsPage'
import { StockPage } from '../features/stock/StockPage'
import { CreditPage } from '../features/credit/CreditPage'
import { ReportsPage } from '../features/reports/ReportsPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { SalesHistoryPage } from '../features/sales-history/SalesHistoryPage'
import { SaleDetailsPage } from '../features/sales-history/SaleDetailsPage'
import type { SalesHistoryReader } from '../domain/salesHistory'

export function AppRoutes({ salesHistory }: { salesHistory?: SalesHistoryReader } = {}) {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
      </Route>
      <Route element={<OperationalLayout />}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="kasir" element={<CashierPage />} />
        <Route path="produk" element={<ProductsPage />} />
        <Route path="stok" element={<StockPage />} />
        <Route path="penjualan" element={<SalesHistoryPage service={salesHistory} />} />
        <Route path="penjualan/:saleId" element={<SaleDetailsPage service={salesHistory} />} />
        <Route path="bon" element={<CreditPage />} />
        <Route path="laporan" element={<ReportsPage />} />
        <Route path="pengaturan" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
