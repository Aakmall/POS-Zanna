import type { BackupData } from './backup'
import { assertRecord, assertTimestamp, assertUnitSnapshot, assertUuid } from './checkoutValidation'
import { commandFingerprint, convertInventoryQuantity, MAX_STOCK_BASE, validateInventoryCommand } from './inventoryRules'
import { movementTypes, type InventoryCommand } from './inventory'

export function validateBackupInventory(data: BackupData): void {
  const balances = new Map(data.inventoryBalances.map((b) => [b.productId, b]))
  for (const balance of data.inventoryBalances) {
    assertUuid(balance.productId, 'Produk saldo'); assertTimestamp(balance.initializedAt); assertTimestamp(balance.updatedAt)
    if (!data.products.some((p) => p.id === balance.productId) || !Number.isSafeInteger(balance.quantityBase) || balance.quantityBase < 0 || balance.quantityBase > MAX_STOCK_BASE) throw new Error('Saldo persediaan tidak valid.')
  }
  const history = new Map<string, BackupData['stockMovements']>()
  for (const movement of data.stockMovements) {
    assertUuid(movement.id, 'Mutasi'); assertUuid(movement.operationId, 'Operasi mutasi'); assertTimestamp(movement.createdAt)
    const product = data.products.find((p) => p.id === movement.productId)
    assertRecord(movement.conversionSnapshot, 'Konversi mutasi')
    const c = movement.conversionSnapshot; assertUnitSnapshot(c.baseUnit); assertUnitSnapshot(c.inputUnit)
    if (!product || product.baseUnitId !== c.baseUnit.id || !data.units.some((u) => u.id === c.inputUnit.id) || !data.units.some((u) => u.id === c.baseUnit.id) || movement.createdBy !== null || typeof movement.productName !== 'string' || !movement.productName.trim() || typeof movement.reason !== 'string' || movement.reason.length > 300) throw new Error('Referensi mutasi persediaan tidak valid.')
    for (const n of [movement.quantityBeforeBase, movement.quantityAfterBase, movement.inputQuantity]) if (!Number.isSafeInteger(n) || n < 0 || n > MAX_STOCK_BASE) throw new Error('Jumlah mutasi tidak valid.')
    if (!Number.isSafeInteger(movement.quantityDeltaBase) || movement.quantityAfterBase !== movement.quantityBeforeBase + movement.quantityDeltaBase) throw new Error('Perubahan saldo mutasi tidak cocok.')
    if (c.baseUnit.dimension === 'count' && [movement.quantityBeforeBase, movement.quantityAfterBase].some((n) => n % 1000 !== 0)) throw new Error('Saldo satuan jumlah tidak boleh pecahan.')
    if (!Number.isSafeInteger(c.quantityInBaseUnit) || c.quantityInBaseUnit <= 0 || c.quantityInBaseUnit > 1_000_000_000 || !['base', 'metric', 'variant', 'custom'].includes(c.source)) throw new Error('Isi satuan mutasi tidak valid.')
    const amount = convertInventoryQuantity(movement.inputQuantity, c)
    if (movement.movementType !== 'SALE') {
      if (!movementTypes.includes(movement.movementType) || movement.saleId !== undefined || movement.saleItemId !== undefined) throw new Error('Jenis mutasi manual tidak valid.')
      if (movement.quantityDeltaBase !== (movement.movementType === 'ADJUSTMENT_OUT' ? -amount : amount)) throw new Error('Jumlah mutasi tidak cocok dengan isi satuan.')
      const raw: unknown = JSON.parse(movement.requestFingerprint)
      if (!Array.isArray(raw) || raw.length !== 9) throw new Error('Identitas permintaan mutasi tidak valid.')
      if (c.source !== 'variant' && (raw[4] !== null || c.variantId !== undefined || c.variantName !== undefined) || c.source !== 'custom' && raw[5] !== null) throw new Error('Identitas sumber konversi tidak cocok.')
      const command: InventoryCommand = { operationId: movement.operationId, productId: movement.productId, movementType: movement.movementType,
        inputQuantity: movement.inputQuantity, inputUnitId: c.inputUnit.id, reason: movement.reason,
        ...(raw[4] !== null ? { variantId: raw[4] } : {}), ...(raw[5] !== null ? { customQuantityInBaseUnit: raw[5] } : {}),
        ...(raw[7] !== null ? { expectedBeforeBase: raw[7] } : {}), ...(raw[8] !== null ? { expectedFactorBase: raw[8] } : {}) }
      validateInventoryCommand(command)
      if (commandFingerprint(command) !== movement.requestFingerprint || (command.expectedBeforeBase !== undefined && command.expectedBeforeBase !== movement.quantityBeforeBase) || (command.expectedFactorBase !== undefined && command.expectedFactorBase !== c.quantityInBaseUnit)) throw new Error('Permintaan mutasi berbeda dari saldo atau isi satuannya.')
      if (c.source === 'base' && (c.inputUnit.id !== c.baseUnit.id || c.quantityInBaseUnit !== 1000) || c.source === 'metric' && (c.inputUnit.isPackaging || c.inputUnit.dimension !== c.baseUnit.dimension || c.quantityInBaseUnit * c.baseUnit.factor !== c.inputUnit.factor * 1000) || c.source === 'variant' && (!c.variantId || command.variantId !== c.variantId || !data.variants.some((v) => v.id === c.variantId && v.productId === product.id)) || c.source === 'custom' && (!c.inputUnit.isPackaging || c.inputUnit.id === c.baseUnit.id || command.customQuantityInBaseUnit !== c.quantityInBaseUnit)) throw new Error('Sumber konversi mutasi tidak konsisten.')
    }
    const rows = history.get(product.id) ?? []; rows.push(movement); history.set(product.id, rows)
  }
  for (const product of data.products) {
    const rows = (history.get(product.id) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)), balance = balances.get(product.id)
    if (!rows.length && !balance) continue
    if (!balance || !rows.length || rows[0].movementType !== 'OPENING_BALANCE' || rows[0].quantityBeforeBase !== 0 || rows.filter((m) => m.movementType === 'OPENING_BALANCE').length !== 1) throw new Error('Saldo wajib memiliki tepat satu stok awal dan riwayat lengkap.')
    let quantity = 0, last = ''
    for (const row of rows) { if (row.quantityBeforeBase !== quantity || row.createdAt <= last) throw new Error('Urutan atau saldo riwayat persediaan terputus.'); quantity = row.quantityAfterBase; last = row.createdAt }
    if (balance.quantityBase !== quantity || balance.updatedAt !== last || balance.initializedAt !== rows[0].createdAt) throw new Error('Saldo akhir berbeda dari riwayat persediaan.')
  }
}
