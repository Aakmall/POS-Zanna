import { BACKUP_TABLES, type BackupData } from './backup'
import { assertRecord, assertText, assertTimestamp, assertUnitSnapshot, assertUuid } from './checkoutValidation'
import { validateUnitPolicy } from './unitPolicy'
import { nameKey, validMoney, validateVariantUnit } from './validation'
import { validateCustomer } from './customerRules'
import { validateCheckoutIntent } from './checkoutRequest'
import { validateStoredCheckout } from './checkoutIntegrity'
import { validatePaymentIntent, validateReceivableGraph } from './creditRules'
import { itemCost } from './reportingRules'
import { validateBackupInventory } from './backupInventory'

const fields = {
  products: 'id,name,categoryId,baseUnitId,costPrice,costKnown,minimumStock,isActive,isDemo,demoKey,illustration,unitPolicy,createdAt,updatedAt',
  categories: 'id,name,nameKey,isActive,createdAt,updatedAt', units: 'id,code,name,dimension,factor,isPackaging,createdAt,updatedAt',
  variants: 'id,productId,name,sku,barcode,sellingUnitId,quantityInBaseUnit,sellingPrice,saleMode,isActive,createdAt,updatedAt',
  inventoryBalances: 'productId,quantityBase,initializedAt,updatedAt',
  stockMovements: 'id,operationId,productId,productName,movementType,quantityDeltaBase,quantityBeforeBase,quantityAfterBase,inputQuantity,conversionSnapshot,reason,createdBy,createdAt,requestFingerprint,saleId,saleItemId',
  sales: 'id,receiptNumber,checkoutOperationId,requestFingerprint,createdAt,status,paymentMethod,customerSnapshot,dueDate,subtotal,total,cashReceived,changeAmount,operatorId,pricingPolicy',
  saleItems: 'id,saleId,position,productId,variantId,productNameSnapshot,variantNameSnapshot,saleModeSnapshot,unitSnapshot,conversionSnapshot,quantity,quantityBase,unitPriceSnapshot,lineTotal',
  checkoutIntents: 'checkoutOperationId,status,command,requestFingerprint,createdAt,saleId',
  customers: 'id,name,phone,address,note,isActive,createdAt,updatedAt',
  receivables: 'id,saleId,checkoutOperationId,customerId,customerSnapshot,receiptNumber,createdAt,updatedAt,dueDate,originalAmount,totalPaid,balance,status',
  creditPayments: 'id,operationId,receivableId,saleId,customerId,customerSnapshot,saleReceiptNumber,receiptNumber,amount,balanceBefore,balanceAfter,paymentMethod,createdAt,requestFingerprint',
  creditPaymentIntents: 'operationId,receivableId,command,requestFingerprint,createdAt,status,paymentId',
  saleItemCosts: 'saleItemId,saleId,costPerBaseUnit,totalCost,policy',
} as const
const primary = (table: typeof BACKUP_TABLES[number]) => table === 'inventoryBalances' ? 'productId' : table === 'checkoutIntents' ? 'checkoutOperationId' : table === 'creditPaymentIntents' ? 'operationId' : table === 'saleItemCosts' ? 'saleItemId' : 'id'
function unique<T>(rows: readonly T[], key: (row: T) => string | undefined, label: string) {
  const seen = new Set<string>()
  for (const row of rows) { const value = key(row); if (value === undefined) continue; if (typeof value !== 'string' || !value || seen.has(value)) throw new Error(`${label} kosong atau duplikat.`); seen.add(value) }
}
function metadata(row: { createdAt: string; updatedAt: string }) { assertTimestamp(row.createdAt); assertTimestamp(row.updatedAt); if (row.updatedAt < row.createdAt) throw new Error('Waktu perubahan lebih lama dari pembuatan.') }
function boolean(value: unknown) { if (typeof value !== 'boolean') throw new Error('Status aktif/data contoh harus benar atau salah.') }

export function validateBackupData(value: unknown): asserts value is BackupData {
  assertRecord(value, 'Isi cadangan')
  if (Object.keys(value).length !== BACKUP_TABLES.length || Object.keys(value).some((key) => !BACKUP_TABLES.includes(key as typeof BACKUP_TABLES[number]))) throw new Error('Daftar data cadangan tidak sesuai versi aplikasi.')
  let count = 0
  for (const table of BACKUP_TABLES) {
    const rows: unknown = value[table]
    if (!Array.isArray(rows)) throw new Error(`Data ${table} harus berupa daftar.`)
    count += rows.length; if (count > 100000) throw new Error('Cadangan melebihi batas 100.000 catatan. Hubungi pengembang untuk pemulihan data besar.')
    const ids = new Set<string>(), allowed = fields[table].split(',')
    for (const row of rows) {
      assertRecord(row, `Catatan ${table}`)
      if (Object.keys(row).some((key) => !allowed.includes(key))) throw new Error(`Ada kolom ${table} yang belum didukung. Data tidak dipulihkan dengan menebak.`)
      const id = row[primary(table)]; assertUuid(id, 'Identitas data')
      if (ids.has(id)) throw new Error(`Identitas ${table} duplikat.`)
      ids.add(id)
    }
  }
  // Shape/identities are checked above; every business field and relationship below.
  const data = value as unknown as BackupData
  unique(data.categories, (r) => r.nameKey, 'Nama kategori'); unique(data.units, (r) => r.code, 'Kode satuan')
  unique(data.products, (r) => r.demoKey, 'Identitas contoh'); unique(data.variants, (r) => r.sku, 'SKU'); unique(data.variants, (r) => r.barcode, 'Barcode')
  unique(data.stockMovements, (r) => r.operationId, 'Operasi stok'); unique(data.stockMovements, (r) => r.saleItemId, 'Mutasi item penjualan')
  unique(data.sales, (r) => r.receiptNumber, 'Nomor struk'); unique(data.sales, (r) => r.checkoutOperationId, 'Operasi checkout')
  unique(data.saleItems, (r) => `${r.saleId}:${r.position}`, 'Posisi item')
  unique(data.receivables, (r) => r.saleId, 'Penjualan tagihan'); unique(data.receivables, (r) => r.checkoutOperationId, 'Operasi tagihan')
  unique(data.creditPayments, (r) => r.operationId, 'Operasi pembayaran'); unique(data.creditPayments, (r) => r.receiptNumber, 'Nomor bukti')
  unique(data.creditPaymentIntents, (r) => r.paymentId, 'Bukti intent')
  for (const c of data.categories) { metadata(c); assertText(c.name, 'Kategori', 60); boolean(c.isActive); if (c.nameKey !== nameKey(c.name)) throw new Error('Nama kategori tidak cocok dengan identitas pencariannya.') }
  for (const u of data.units) { metadata(u); assertUnitSnapshot(u) }
  for (const p of data.products) {
    metadata(p); assertText(p.name, 'Produk', 100); boolean(p.isActive); boolean(p.isDemo)
    const base = data.units.find((u) => u.id === p.baseUnitId)
    if (!base || !data.categories.some((c) => c.id === p.categoryId) || !validMoney(p.costPrice) || p.costKnown !== (p.costPrice !== null) || p.minimumStock !== null && (!Number.isSafeInteger(p.minimumStock) || p.minimumStock < 0 || p.minimumStock > 1_000_000_000)) throw new Error('Referensi, modal atau batas stok produk tidak valid.')
    if (p.unitPolicy !== undefined) validateUnitPolicy(p.unitPolicy, base, data.units)
    if (!data.variants.some((v) => v.productId === p.id)) throw new Error('Produk kehilangan seluruh variannya.')
  }
  for (const v of data.variants) {
    metadata(v); assertText(v.name, 'Varian', 80); boolean(v.isActive)
    const p = data.products.find((p) => p.id === v.productId)
    if (!p || !data.units.some((u) => u.id === v.sellingUnitId) || !validMoney(v.sellingPrice) || !Number.isSafeInteger(v.quantityInBaseUnit) || v.quantityInBaseUnit <= 0 || v.quantityInBaseUnit > 1_000_000_000 || !['fixed', 'variable'].includes(v.saleMode)) throw new Error('Isi satuan, harga atau referensi varian tidak valid.')
    if (v.sku !== undefined && (typeof v.sku !== 'string' || !v.sku.trim() || v.sku.length > 60) || v.barcode !== undefined && (typeof v.barcode !== 'string' || !/^[A-Za-z0-9-]{1,80}$/.test(v.barcode))) throw new Error('SKU/barcode tidak valid.')
    // Legacy products without a reviewed policy remain unchanged; no guessing or repair.
    if (p.unitPolicy && v.isActive) validateVariantUnit(p, v, data.units)
  }
  for (const c of data.customers) validateCustomer(c)
  for (const intent of data.checkoutIntents) {
    validateCheckoutIntent(intent)
    const command = intent.command
    if (command.lines.some((line) => !data.variants.some((v) => v.id === line.variantId && v.productId === line.expected.productId))) throw new Error('Referensi permintaan checkout hilang.')
    if (command.paymentMethod === 'BON' && !data.customers.some((c) => c.id === command.customer.id)) throw new Error('Pelanggan permintaan checkout hilang.')
    const sale = data.sales.find((s) => s.checkoutOperationId === intent.checkoutOperationId)
    if (intent.status === 'COMMITTED' && (!sale || sale.id !== intent.saleId) || intent.status !== 'COMMITTED' && sale) throw new Error('Status checkout tidak cocok dengan penjualan.')
  }
  for (const item of data.saleItems) if (!data.sales.some((s) => s.id === item.saleId) || !data.products.some((p) => p.id === item.productId && p.baseUnitId === item.conversionSnapshot?.baseUnit?.id) || !data.variants.some((v) => v.id === item.variantId && v.productId === item.productId) || !data.units.some((u) => u.id === item.unitSnapshot?.id)) throw new Error('Referensi item penjualan hilang.')
  for (const sale of data.sales) {
    const intent = data.checkoutIntents.find((i) => i.checkoutOperationId === sale.checkoutOperationId)
    if (!intent) throw new Error('Penjualan kehilangan permintaan checkout.')
    validateStoredCheckout(intent, sale, data.saleItems.filter((i) => i.saleId === sale.id).sort((a, b) => a.position - b.position), data.stockMovements.filter((m) => m.saleId === sale.id))
    const r = data.receivables.find((r) => r.saleId === sale.id)
    if (sale.paymentMethod === 'BON' && (!r || !data.customers.some((c) => c.id === sale.customerSnapshot?.id)) || sale.paymentMethod === 'CASH' && r) throw new Error('Penjualan dan tagihan Bon tidak cocok.')
  }
  for (const m of data.stockMovements) if (m.movementType === 'SALE' && !data.saleItems.some((i) => i.id === m.saleItemId && i.saleId === m.saleId)) throw new Error('Mutasi penjualan kehilangan itemnya.')
  for (const intent of data.creditPaymentIntents) {
    validatePaymentIntent(intent)
    if (!data.receivables.some((r) => r.id === intent.receivableId) && intent.status !== 'CANCELLED') throw new Error('Permintaan pembayaran kehilangan tagihan.')
    if (intent.status === 'COMMITTED' && !data.creditPayments.some((p) => p.id === intent.paymentId && p.operationId === intent.operationId)) throw new Error('Permintaan pembayaran kehilangan bukti.')
  }
  for (const r of data.receivables) {
    const sale = data.sales.find((s) => s.id === r.saleId)
    if (!sale || !data.customers.some((c) => c.id === r.customerId)) throw new Error('Referensi tagihan hilang.')
    validateReceivableGraph(r, sale, data.creditPayments.filter((p) => p.receivableId === r.id), data.creditPaymentIntents.filter((p) => p.receivableId === r.id))
  }
  for (const p of data.creditPayments) if (!data.receivables.some((r) => r.id === p.receivableId)) throw new Error('Pembayaran kehilangan tagihan.')
  for (const cost of data.saleItemCosts) {
    const item = data.saleItems.find((i) => i.id === cost.saleItemId)
    if (!item) throw new Error('Harga modal kehilangan item penjualan.')
    const expected = itemCost(item, { costKnown: cost.costPerBaseUnit !== null, costPrice: cost.costPerBaseUnit })
    if (cost.saleId !== item.saleId || cost.totalCost !== expected.totalCost || cost.policy !== expected.policy) throw new Error('Harga modal historis tidak konsisten.')
  }
  validateBackupInventory(data)
}
