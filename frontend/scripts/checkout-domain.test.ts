import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CheckoutError, type CheckoutErrorCode, type CheckoutIntent } from '../src/domain/checkout'
import { calculateChange, calculateLineTotal, scaleFixedQuantity, sumLineTotals } from '../src/domain/checkoutMath'
import { assertSameCheckoutRequest, checkoutFingerprint, copyCheckoutCommand, validateCheckoutCommand, validateCheckoutIntent } from '../src/domain/checkoutRequest'
import { calculateCheckoutQuote, validateCheckoutAgainstSnapshot } from '../src/domain/checkoutRules'
import { formatReceiptNumber, validateSale, validateSaleItem } from '../src/domain/saleRules'
import { validateInventoryCommand } from '../src/domain/inventoryRules'
import { checkoutFixture, commandFixture, saleFixture, testStamp } from './checkout-fixtures'

const errorCode = (code: CheckoutErrorCode) => (error: unknown) => error instanceof CheckoutError && error.code === code
test('checkout math: Solar 1,5 L dan 0,5 L memakai integer Rupiah', () => {
  assert.equal(calculateLineTotal(13000, 1500), 19500)
  assert.equal(calculateLineTotal(13000, 500), 6500)
  assert.equal(calculateChange(20000, 19500), 500)
})
test('HALF_UP_LINE_V1: bulatkan tiap baris sebelum jumlah; stok tidak ikut dibulatkan', () => {
  assert.equal(calculateLineTotal(12500, 1), 13)
  assert.equal(sumLineTotals([calculateLineTotal(12500, 1), calculateLineTotal(12500, 1)]), 26)
  const f = checkoutFixture(); f.variant.sellingPrice = 12500
  const quote = calculateCheckoutQuote([{ variantId: f.variant.id, quantity: 1 }], f.catalog, f.balances)
  assert.equal(quote.items[0].quantityBase, 1)
  assert.equal(quote.items[0].lineTotal, 13)
})
test('kalkulasi multi item menggunakan HALF_UP per baris untuk dua varian', () => {
  const f = checkoutFixture(); f.variant.sellingPrice = 12500
  const other = { ...f.variant, id: crypto.randomUUID(), name: 'Meteran lain' }; f.catalog.variants.push(other)
  const quote = calculateCheckoutQuote([f.variant, other].map((item) => ({ variantId: item.id, quantity: 1 })), f.catalog, f.balances)
  assert.equal(quote.total, 26); assert.equal(quote.stockRequirements[0].quantityBase, 2)
  const header = saleFixture().sale
  const command = { payloadVersion: 1 as const, checkoutOperationId: header.checkoutOperationId, paymentMethod: 'CASH' as const,
    lines: quote.lines, expectedTotal: quote.total, cashReceived: header.cashReceived }
  validateSale({ ...header, requestFingerprint: checkoutFingerprint(command), subtotal: quote.subtotal, total: quote.total,
    changeAmount: calculateChange(header.cashReceived, quote.total) }, quote.items.map((item) => ({ ...item, id: crypto.randomUUID(), saleId: header.id })))
})
test('nilai negatif, noninteger, NaN, Infinity, null dan overflow uang/jumlah ditolak', () => {
  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 1_000_000_001]) {
    assert.throws(() => calculateLineTotal(value, 1000), errorCode('INVALID_REQUEST'))
    assert.throws(() => calculateLineTotal(13000, value), errorCode('INVALID_REQUEST'))
    assert.throws(() => calculateChange(value, 0), errorCode('INVALID_REQUEST'))
  }
  assert.throws(() => calculateLineTotal(1000, 0), errorCode('INVALID_REQUEST'))
  assert.throws(() => calculateLineTotal(1_000_000_000, 1_000_000_000), errorCode('INVALID_REQUEST'))
  assert.throws(() => sumLineTotals([1_000_000_000, 1]), errorCode('INVALID_REQUEST'))
  assert.throws(() => calculateChange(1000, 1001), errorCode('CASH_INSUFFICIENT'))
})
test('fixed memakai scaled kemasan bulat; adapter count lama harus dipanggil eksplisit', () => {
  const f = checkoutFixture('bungkus', 'fixed')
  assert.equal(scaleFixedQuantity(2), 2000)
  const quote = calculateCheckoutQuote([{ variantId: f.variant.id, quantity: scaleFixedQuantity(2) }], f.catalog, f.balances)
  assert.equal(quote.items[0].quantityBase, 2000)
  for (const quantity of [2, 1500, 0, -1000, 0.1]) assert.throws(() => calculateCheckoutQuote([{ variantId: f.variant.id, quantity }], f.catalog, f.balances), errorCode('INVALID_REQUEST'))
  for (const count of [0, -1, 1.5, 1_000_001]) assert.throws(() => scaleFixedQuantity(count), errorCode('INVALID_REQUEST'))
})
test('konversi L/ml dan kg/gram tepat; remainder dan lintas dimensi ditolak', () => {
  const f = checkoutFixture('ml'); f.variant.sellingUnitId = f.unit('l').id; f.variant.quantityInBaseUnit = 1_000_000
  f.balances[0].quantityBase = 50_000_000
  assert.equal(calculateCheckoutQuote([{ variantId: f.variant.id, quantity: 1500 }], f.catalog, f.balances).items[0].quantityBase, 1_500_000)
  const mass = checkoutFixture('g'); mass.variant.sellingUnitId = mass.unit('kg').id; mass.variant.quantityInBaseUnit = 1_000_000; mass.balances[0].quantityBase = 10_000_000
  assert.equal(calculateCheckoutQuote([{ variantId: mass.variant.id, quantity: 1000 }], mass.catalog, mass.balances).items[0].quantityBase, 1_000_000)
  const liter = checkoutFixture(); liter.variant.sellingUnitId = liter.unit('ml').id; liter.variant.quantityInBaseUnit = 1
  assert.throws(() => calculateCheckoutQuote([{ variantId: liter.variant.id, quantity: 1 }], liter.catalog, liter.balances), /presisi/)
  mass.variant.sellingUnitId = mass.unit('l').id
  assert.throws(() => calculateCheckoutQuote([{ variantId: mass.variant.id, quantity: 1000 }], mass.catalog, mass.balances), errorCode('INVALID_REQUEST'))
})
test('BBM menolak Sachet/Bungkus pada kalkulator baru dan variable tidak menerima kemasan', () => {
  const f = checkoutFixture()
  for (const code of ['sachet', 'bungkus']) {
    f.variant.sellingUnitId = f.unit(code).id; f.variant.quantityInBaseUnit = 12000; f.variant.saleMode = 'fixed'
    assert.throws(() => calculateCheckoutQuote([{ variantId: f.variant.id, quantity: 10000 }], f.catalog, f.balances), /tidak diizinkan/)
  }
  f.variant.sellingUnitId = f.unit('botol').id; f.variant.quantityInBaseUnit = 1500; f.variant.saleMode = 'variable'
  assert.throws(() => calculateCheckoutQuote([{ variantId: f.variant.id, quantity: 1000 }], f.catalog, f.balances), /Jumlah aktual/)
})
test('legacy butuh review policy, harga null ditolak, harga nol sah dan tidak mengubah master', () => {
  const f = checkoutFixture(); delete f.product.unitPolicy
  assert.throws(() => calculateCheckoutQuote([{ variantId: f.variant.id, quantity: 1000 }], f.catalog, f.balances), errorCode('POLICY_REVIEW_REQUIRED'))
  f.product.unitPolicy = { kind: 'fuel', allowedPackagingUnitIds: [] }; f.variant.sellingPrice = null
  assert.throws(() => calculateCheckoutQuote([{ variantId: f.variant.id, quantity: 1000 }], f.catalog, f.balances), errorCode('INVALID_REQUEST'))
  f.variant.sellingPrice = 0
  const before = structuredClone(f.catalog), beforeBalances = structuredClone(f.balances)
  assert.equal(calculateCheckoutQuote([{ variantId: f.variant.id, quantity: 1500 }], f.catalog, f.balances).total, 0)
  assert.deepEqual(f.catalog, before); assert.deepEqual(f.balances, beforeBalances)
})
test('agregasi semua varian per productId; saldo belum diatur/duplikat/nonaktif ditolak', () => {
  const f = checkoutFixture(); f.variant.saleMode = 'fixed'; f.variant.sellingUnitId = f.unit('botol').id; f.variant.quantityInBaseUnit = 1500
  const other = { ...f.variant, id: crypto.randomUUID(), quantityInBaseUnit: 1000, name: 'Botol 1 L' }; f.catalog.variants.push(other); f.balances[0].quantityBase = 3000
  const selections = [f.variant, other].map((variant) => ({ variantId: variant.id, quantity: 1000 }))
  assert.deepEqual(calculateCheckoutQuote(selections, f.catalog, f.balances).stockRequirements, [{ productId: f.product.id, quantityBase: 2500 }])
  assert.throws(() => calculateCheckoutQuote([{ ...selections[0], quantity: 2000 }, selections[1]], f.catalog, f.balances), errorCode('INSUFFICIENT_STOCK'))
  assert.throws(() => calculateCheckoutQuote(selections, f.catalog, []), errorCode('STOCK_NOT_INITIALIZED'))
  assert.throws(() => calculateCheckoutQuote(selections, f.catalog, [...f.balances, f.balances[0]]), errorCode('INTEGRITY_ERROR'))
  f.variant.isActive = false
  assert.throws(() => calculateCheckoutQuote(selections, f.catalog, f.balances), errorCode('PRODUCT_UNAVAILABLE'))
})
test('validasi command menolak kosong/duplikat/metode DEMO/UUID/amount salah', () => {
  const f = commandFixture()
  validateCheckoutCommand(f.command)
  for (const value of [null, {}, { ...f.command, lines: [] }, { ...f.command, lines: [f.command.lines[0], f.command.lines[0]] }, { ...f.command, paymentMethod: 'QRIS' }, { ...f.command, paymentMethod: 'Bon' }, { ...f.command, checkoutOperationId: 'x' }, { ...f.command, expectedTotal: -1 }, { ...f.command, cashReceived: 0.5 }, { ...f.command, payloadVersion: 2 }]) assert.throws(() => validateCheckoutCommand(value), errorCode('INVALID_REQUEST'))
  assert.throws(() => validateCheckoutCommand({ ...f.command, cashReceived: 1 }), errorCode('CASH_INSUFFICIENT'))
})
test('fingerprint deterministik terhadap urutan properti; tiap field intent signifikan', () => {
  const f = commandFixture(), first = f.command.lines[0]
  const reordered = { cashReceived: f.command.cashReceived, expectedTotal: f.command.expectedTotal, lines: [{ expected: { variantUpdatedAt: first.expected.variantUpdatedAt, productUpdatedAt: first.expected.productUpdatedAt, unitPrice: first.expected.unitPrice, quantityInBaseUnit: first.expected.quantityInBaseUnit, saleMode: first.expected.saleMode, sellingUnitId: first.expected.sellingUnitId, baseUnitId: first.expected.baseUnitId, productId: first.expected.productId }, quantity: first.quantity, variantId: first.variantId }], paymentMethod: 'CASH', checkoutOperationId: f.command.checkoutOperationId, payloadVersion: 1 }
  assert.equal(checkoutFingerprint(reordered), checkoutFingerprint(f.command))
  const stored = { checkoutOperationId: f.command.checkoutOperationId, requestFingerprint: checkoutFingerprint(f.command) }
  assert.doesNotThrow(() => assertSameCheckoutRequest(stored, reordered))
  for (const incoming of [{ ...f.command, cashReceived: f.command.cashReceived + 1 }, { ...f.command, expectedTotal: f.command.expectedTotal + 1 }, { ...f.command, checkoutOperationId: crypto.randomUUID() }, { ...f.command, lines: [{ ...first, quantity: first.quantity + 1 }] }, { ...f.command, lines: [{ ...first, expected: { ...first.expected, unitPrice: first.expected.unitPrice + 1 } }] }]) assert.throws(() => assertSameCheckoutRequest(stored, incoming), errorCode('OPERATION_PAYLOAD_MISMATCH'))
})
test('copy request deep dan frozen; perubahan object React asal tidak mengubah retry', () => {
  const original = structuredClone(commandFixture().command), copied = copyCheckoutCommand(original), fingerprint = checkoutFingerprint(copied)
  Reflect.set(original.lines[0].expected, 'unitPrice', 9999); Reflect.set(original.lines[0], 'quantity', 1)
  assert.equal(checkoutFingerprint(copied), fingerprint)
  assert.equal(Reflect.set(copied.lines[0].expected, 'unitPrice', 1), false)
  assert.ok(Object.isFrozen(copied)); assert.ok(Object.isFrozen(copied.lines)); assert.ok(Object.isFrozen(copied.lines[0]))
})
test('intent PREPARED/COMMITTED/CANCELLED memvalidasi ID, fingerprint dan saleId', () => {
  const command = commandFixture().command
  const intent: CheckoutIntent = { checkoutOperationId: command.checkoutOperationId, command: copyCheckoutCommand(command), createdAt: testStamp, requestFingerprint: checkoutFingerprint(command), status: 'PREPARED' }
  validateCheckoutIntent(intent)
  validateCheckoutIntent({ ...intent, status: 'COMMITTED', saleId: crypto.randomUUID() })
  validateCheckoutIntent({ ...intent, status: 'CANCELLED' })
  for (const value of [{ ...intent, status: 'COMMITTED' }, { ...intent, saleId: crypto.randomUUID() }, { ...intent, status: 'FAILED' }, { ...intent, createdAt: '2026-02-30' }]) assert.throws(() => validateCheckoutIntent(value), errorCode('INVALID_REQUEST'))
  assert.throws(() => validateCheckoutIntent({ ...intent, requestFingerprint: 'changed' }), errorCode('OPERATION_PAYLOAD_MISMATCH'))
})
test('command expected bukan otoritas: hitung ulang harga/faktor/total/versi dan saldo terbaru', () => {
  const f = commandFixture(); assert.equal(validateCheckoutAgainstSnapshot(f.command, f.catalog, f.balances).total, 19500)
  f.balances[0].quantityBase = 2000 // Changed but still sufficient: no false requirement of exact before.
  assert.equal(validateCheckoutAgainstSnapshot(f.command, f.catalog, f.balances).total, 19500)
  assert.throws(() => validateCheckoutAgainstSnapshot({ ...f.command, expectedTotal: 1 }, f.catalog, f.balances), errorCode('QUOTE_CHANGED'))
  f.variant.sellingPrice = 14000
  assert.throws(() => validateCheckoutAgainstSnapshot(f.command, f.catalog, f.balances), errorCode('QUOTE_CHANGED'))
  f.variant.sellingPrice = 13000; f.product.updatedAt = '2026-10-21T01:00:01.000Z'
  assert.throws(() => validateCheckoutAgainstSnapshot(f.command, f.catalog, f.balances), errorCode('QUOTE_CHANGED'))
})
test('Sale dan SaleItem valid menggunakan snapshot, bukan master yang sudah diedit', () => {
  const f = saleFixture(); validateSale(f.sale, f.items); validateSaleItem(f.items[0])
  const snapshot = structuredClone(f.items)
  f.variant.sellingPrice = 9999; f.product.name = 'Nama baru'; f.product.unitPolicy = { kind: 'general', allowedPackagingUnitIds: [] }
  validateSale(f.sale, f.items); assert.deepEqual(f.items, snapshot)
  assert.equal(f.items[0].lineTotal, 19500)
  assert.match(f.sale.receiptNumber, /^ZC-20261021-/)
})
test('SaleItem invalid: snapshot satuan/konversi/jumlah/price/lineTotal dan ID ditolak', () => {
  const item = saleFixture().items[0]
  for (const value of [{ ...item, id: 'x' }, { ...item, position: 0 }, { ...item, unitPriceSnapshot: null }, { ...item, quantity: -1000 }, { ...item, quantityBase: item.quantityBase + 1 }, { ...item, lineTotal: 0 }, { ...item, saleModeSnapshot: 'fixed' }, { ...item, unitSnapshot: { ...item.unitSnapshot, code: 'kg' } }, { ...item, conversionSnapshot: { ...item.conversionSnapshot, quantityInBaseUnit: 0 } }, { ...item, conversionSnapshot: { ...item.conversionSnapshot, variantId: crypto.randomUUID() } }]) assert.throws(() => validateSaleItem(value), errorCode('INVALID_REQUEST'))
})
test('Sale invalid: status/metode/total/change/relasi/urutan dan duplicate item ditolak', () => {
  const { sale, items } = saleFixture()
  for (const value of [{ ...sale, status: 'FAILED' }, { ...sale, paymentMethod: 'QRIS' }, { ...sale, subtotal: 0 }, { ...sale, total: 0 }, { ...sale, changeAmount: -1 }, { ...sale, changeAmount: 0 }, { ...sale, receiptNumber: 'DUPLICATE' }, { ...sale, operatorId: 'owner' }, { ...sale, pricingPolicy: 'OTHER' }]) assert.throws(() => validateSale(value, items), errorCode('INVALID_REQUEST'))
  assert.throws(() => validateSale({ ...sale, cashReceived: 1, changeAmount: 0 }, items), errorCode('CASH_INSUFFICIENT'))
  for (const badItems of [[], [items[0], items[0]], [{ ...items[0], saleId: crypto.randomUUID() }], [{ ...items[0], position: 2 }]]) assert.throws(() => validateSale(sale, badItems), errorCode('INVALID_REQUEST'))
  assert.throws(() => formatReceiptNumber(sale.id, '2026-02-30T00:00:00.000Z'), errorCode('INVALID_REQUEST'))
})
test('validator inventory manual tetap menolak SALE meskipun ledger mendukung penjualan', () => {
  const request = { operationId: crypto.randomUUID(), productId: crypto.randomUUID(), movementType: 'SALE', inputQuantity: 1000, inputUnitId: crypto.randomUUID(), reason: '' }
  assert.throws(() => validateInventoryCommand(request as Parameters<typeof validateInventoryCommand>[0]), /belum didukung/)
})
