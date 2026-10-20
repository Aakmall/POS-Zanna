import { ChartNoAxesCombined, CreditCard, LayoutDashboard, Package, Settings2, ShoppingBasket, Warehouse } from 'lucide-react'

export const navigation = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/kasir', label: 'Kasir', icon: ShoppingBasket },
  { to: '/produk', label: 'Produk', icon: Package },
  { to: '/stok', label: 'Stok', icon: Warehouse },
  { to: '/bon', label: 'Pelanggan & Bon', icon: CreditCard },
  { to: '/laporan', label: 'Laporan', icon: ChartNoAxesCombined },
  { to: '/pengaturan', label: 'Pengaturan', icon: Settings2 },
]
