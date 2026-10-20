export const categories = ['Sembako', 'Makanan', 'Minuman', 'Bensin', 'Solar', 'Eceran'] as const
export type Category = typeof categories[number]
export type ProductIllustration = 'rice' | 'oil' | 'sugar' | 'noodles' | 'biscuit' | 'water' | 'tea' | 'soap' | 'tissue' | 'fuel' | 'diesel' | 'sachet'

export interface CatalogItem {
  id: string
  sku: string
  name: string
  category: string
  price: number | null
  cost: number | null
  unit: string
  stock: number | null
  minimumStock: number
  symbol: string
  illustration?: ProductIllustration
  productId?: string
  barcode?: string
  isActive?: boolean
  isDemo?: boolean
  saleMode?: 'fixed' | 'variable'
}

export interface CartLine { variantId: string; quantity: number }
export type PaymentMethod = 'Tunai' | 'QRIS' | 'Bon'
export interface DemoCustomer {
  id: string
  name: string
  phone: string
  entries: { id: string; date: string; description: string; amount: number }[]
  paid: number
}
export interface DemoSale {
  id: string
  date: string
  customer: string
  method: PaymentMethod
  total: number
  cost: number
}

