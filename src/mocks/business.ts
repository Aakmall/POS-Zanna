import type { DemoCustomer, DemoSale } from '../types/pos'

export const demoCustomers: DemoCustomer[] = [
  { id: 'c1', name: 'Ibu Sari', phone: '08xx-xxxx-0101', paid: 25000, entries: [
    { id: 'b1', date: '2026-10-17', description: 'Sembako dan kebutuhan rumah', amount: 85000 },
    { id: 'b2', date: '2026-10-18', description: 'Minuman dan makanan', amount: 20000 },
  ] },
  { id: 'c2', name: 'Pak Budi', phone: '08xx-xxxx-0202', paid: 0, entries: [{ id: 'b3', date: '2026-10-18', description: 'Beras dan minyak', amount: 64000 }] },
  { id: 'c3', name: 'Ibu Rina', phone: '08xx-xxxx-0303', paid: 30000, entries: [{ id: 'b4', date: '2026-10-16', description: 'Kebutuhan dapur', amount: 30000 }] },
]

// Sampel tetap untuk dashboard/laporan, terpisah dari simulasi checkout sesi.
export const demoSales: DemoSale[] = [
  { id: 'DEMO-001', date: '2026-10-13', customer: 'Pelanggan umum', method: 'Tunai', total: 125000, cost: 99000 },
  { id: 'DEMO-002', date: '2026-10-14', customer: 'Pelanggan umum', method: 'QRIS', total: 98000, cost: 75000 },
  { id: 'DEMO-003', date: '2026-10-15', customer: 'Pelanggan umum', method: 'Tunai', total: 156000, cost: 122000 },
  { id: 'DEMO-004', date: '2026-10-16', customer: 'Ibu Rina', method: 'Bon', total: 30000, cost: 23000 },
  { id: 'DEMO-005', date: '2026-10-17', customer: 'Ibu Sari', method: 'Bon', total: 85000, cost: 68000 },
  { id: 'DEMO-006', date: '2026-10-18', customer: 'Pelanggan umum', method: 'QRIS', total: 72000, cost: 54000 },
  { id: 'DEMO-007', date: '2026-10-19', customer: 'Pelanggan umum', method: 'Tunai', total: 114000, cost: 88000 },
  { id: 'DEMO-008', date: '2026-10-19', customer: 'Pelanggan umum', method: 'QRIS', total: 47000, cost: 35500 },
]

