import type { CatalogItem } from '../types/pos'

// Semua harga selain solar adalah contoh DEMO, bukan harga milik warung.
export const demoProducts: CatalogItem[] = [
  { id: 'p1', illustration: 'rice', sku: 'SB-001', name: 'Beras premium', category: 'Sembako', price: 15000, cost: 13000, unit: 'kg', stock: 42, minimumStock: 10, symbol: 'BR' },
  { id: 'p2', illustration: 'oil', sku: 'SB-002', name: 'Minyak goreng', category: 'Sembako', price: 19000, cost: 16500, unit: 'liter', stock: 18, minimumStock: 5, symbol: 'MG' },
  { id: 'p3', illustration: 'sugar', sku: 'SB-003', name: 'Gula pasir', category: 'Sembako', price: 18000, cost: 15500, unit: 'kg', stock: 4, minimumStock: 5, symbol: 'GP' },
  { id: 'p4', illustration: 'noodles', sku: 'MK-001', name: 'Mi goreng instan', category: 'Makanan', price: 3500, cost: 2800, unit: 'bungkus', stock: 64, minimumStock: 12, symbol: 'MI' },
  { id: 'p5', illustration: 'biscuit', sku: 'MK-002', name: 'Biskuit kelapa', category: 'Makanan', price: 8000, cost: 6500, unit: 'bungkus', stock: 16, minimumStock: 5, symbol: 'BK' },
  { id: 'p6', illustration: 'water', sku: 'MN-001', name: 'Air mineral 600 ml', category: 'Minuman', price: 4000, cost: 2500, unit: 'botol', stock: 48, minimumStock: 10, symbol: 'AM' },
  { id: 'p7', illustration: 'tea', sku: 'MN-002', name: 'Teh melati', category: 'Minuman', price: 5000, cost: 3500, unit: 'botol', stock: 3, minimumStock: 6, symbol: 'TM' },
  { id: 'p8', illustration: 'soap', sku: 'EC-001', name: 'Sabun mandi', category: 'Eceran', price: 5000, cost: 3800, unit: 'batang', stock: 20, minimumStock: 5, symbol: 'SM' },
  { id: 'p9', illustration: 'tissue', sku: 'EC-002', name: 'Tisu saku', category: 'Eceran', price: 2000, cost: 1200, unit: 'pak', stock: 0, minimumStock: 5, symbol: 'TS' },
  { id: 'p10', illustration: 'fuel', sku: 'BM-001', name: 'Bensin 1 liter', category: 'Bensin', price: null, cost: null, unit: 'botol 1 L', stock: 12, minimumStock: 3, symbol: 'B1' },
  { id: 'p11', illustration: 'fuel', sku: 'BM-002', name: 'Bensin 1,5 liter', category: 'Bensin', price: null, cost: null, unit: 'botol 1,5 L', stock: 8, minimumStock: 3, symbol: 'B1½' },
  { id: 'p12', illustration: 'fuel', sku: 'BM-003', name: 'Bensin 5 liter', category: 'Bensin', price: null, cost: null, unit: 'jeriken 5 L', stock: 4, minimumStock: 2, symbol: 'B5' },
  { id: 'p13', illustration: 'diesel', sku: 'BM-004', name: 'Solar', category: 'Solar', price: 13000, cost: null, unit: 'liter', stock: 35, minimumStock: 10, symbol: 'SL' },
  { id: 'p14', sku: 'EC-003', name: 'Kopi susu sachet', category: 'Eceran', price: 2000, cost: 1500, unit: 'sachet', stock: 32, minimumStock: 8, symbol: 'KS', illustration: 'sachet' },
]


