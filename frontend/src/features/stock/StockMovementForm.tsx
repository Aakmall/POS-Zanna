import { useState, type SubmitEvent } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { useInventory } from '../../hooks/useInventory'
import { createUuid } from '../../domain/id'
import { parseQuantity, quantityText } from '../../domain/quantity'
import { movementLabels } from '../../domain/inventoryRules'
import type { InventoryCommand, MovementResult, MovementType } from '../../domain/inventory'
import type { InventoryService } from '../../services/inventoryOperations'
import { inventoryInputOptions } from '../../services/inventoryInputs'
import { UnitPolicyNotice } from '../../components/ui/UnitPolicyNotice'

type Preview = ReturnType<InventoryService['preview']>
export function StockMovementForm({ productId, initialType, onClose, onSaved }: {
  productId: string; initialType: MovementType; onClose: () => void; onSaved: (result: MovementResult) => void
}) {
  const { catalog, balances, service } = useInventory()
  const product = catalog.products.find((item) => item.id === productId)!
  const base = catalog.units.find((item) => item.id === product.baseUnitId)
  const balance = balances.find((item) => item.productId === productId)
  const [initialBefore] = useState(balance?.quantityBase ?? 0)
  const options = inventoryInputOptions(catalog, productId)
  const [fields, setFields] = useState({ quantity: '', option: options[0]?.key ?? '', custom: '', reason: '', type: initialType })
  const [operationId, setOperationId] = useState(createUuid)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState<{ command: InventoryCommand; preview: Preview } | null>(null)
  const [lastSubmitted, setLastSubmitted] = useState<InventoryCommand | null>(null)
  const selected = options.find((item) => item.key === fields.option)
  let preview: Preview | undefined, previewError = '', command: InventoryCommand | undefined
  try {
    const quantity = parseQuantity(fields.quantity)
    const custom = selected?.custom ? parseQuantity(fields.custom) : undefined
    if (quantity === null || !selected || custom === null) throw new Error('Isi jumlah dan konversi yang valid, maksimal tiga desimal.')
    command = { operationId, productId, movementType: fields.type, inputQuantity: quantity, inputUnitId: selected.unitId,
      ...(selected.variantId ? { variantId: selected.variantId } : {}), ...(custom !== undefined ? { customQuantityInBaseUnit: custom } : {}),
      reason: fields.reason, expectedBeforeBase: initialBefore }
    preview = service.preview(command, catalog, balance)
    command = { ...command, expectedFactorBase: preview.conversion.quantityInBaseUnit }
  } catch (cause) { previewError = cause instanceof Error ? cause.message : 'Konversi tidak valid.' }

  function edit(patch: Partial<typeof fields>) {
    setFields((previous) => ({ ...previous, ...patch })); setOperationId(createUuid()); setError(''); setLastSubmitted(null); setConfirmation(null)
  }
  async function save(request: InventoryCommand) {
    if (busy) return
    setBusy(true); setError(''); setLastSubmitted(request)
    try { onSaved(await service.execute(request)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Mutasi gagal disimpan. Periksa izin dan ruang penyimpanan browser.') }
    finally { setBusy(false) }
  }
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!preview || !command) { setError(previewError || 'Periksa isian terlebih dahulu.'); return }
    if (command.movementType === 'ADJUSTMENT_OUT') setConfirmation({ command, preview })
    else void save(command)
  }
  const correction = initialType.startsWith('ADJUSTMENT')
  return <Dialog mode="local" wide title={`${movementLabels[initialType]} · ${product.name}`} onClose={() => { if (!busy) onClose() }}>
    <form onSubmit={submit} className="space-y-5">
      <UnitPolicyNotice product={product} />
      <p className="rounded-lg bg-brand-soft p-3 text-sm leading-6 text-brand">{balance ? `Saldo saat ini: ${quantityText(balance.quantityBase)} ${base?.name}` : 'Stok awal belum diatur. Nilai 0 diperbolehkan untuk stok awal.'}</p>
      {!product.isActive && <p className="text-xs leading-5 text-warning">Produk nonaktif. Mutasi tetap mencatat persediaan fisik tanpa mengaktifkan produk untuk penjualan.</p>}
      <fieldset disabled={busy || !!confirmation} className="grid gap-4 sm:grid-cols-2">
        {correction && <label className="sm:col-span-2"><span className="field-label">Jenis koreksi</span><select className="field" value={fields.type} onChange={(event) => edit({ type: event.target.value === 'ADJUSTMENT_OUT' ? 'ADJUSTMENT_OUT' : 'ADJUSTMENT_IN' })}><option value="ADJUSTMENT_IN">Koreksi masuk (+)</option><option value="ADJUSTMENT_OUT">Koreksi keluar (−)</option></select></label>}
        <label><span className="field-label">Jumlah {initialType === 'OPENING_BALANCE' ? '(boleh 0)' : '(lebih dari 0)'}</span><input className="field" inputMode="decimal" value={fields.quantity} onChange={(event) => edit({ quantity: event.target.value })} placeholder="Contoh: 30 atau 1,5" required /></label>
        <label><span className="field-label">Satuan masukan</span><select className="field" value={fields.option} onChange={(event) => edit({ option: event.target.value, custom: '' })}>{options.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
        {selected?.custom && <label className="sm:col-span-2"><span className="field-label">Isi 1 kemasan dalam {base?.name} (wajib, tidak ditebak)</span><input className="field" inputMode="decimal" value={fields.custom} onChange={(event) => edit({ custom: event.target.value })} placeholder="Contoh: 18,5" required /></label>}
        <label className="sm:col-span-2"><span className="field-label">Alasan / catatan {correction ? '(wajib)' : '(opsional)'}</span><textarea className="field" value={fields.reason} onChange={(event) => edit({ reason: event.target.value })} maxLength={300} required={correction} rows={3} placeholder={correction ? 'Contoh: 2 bungkus rusak' : 'Contoh: penghitungan stok fisik'} /></label>
      </fieldset>
      {preview ? <div className="rounded-xl border border-line p-4 text-sm leading-7"><p>1 {preview.conversion.inputUnit.name} = <strong>{quantityText(preview.conversion.quantityInBaseUnit)} {preview.conversion.baseUnit.name}</strong></p><p>Perubahan: <strong>{preview.delta >= 0 ? '+' : '−'}{quantityText(Math.abs(preview.delta))} {preview.conversion.baseUnit.name}</strong></p><p>Saldo: {quantityText(preview.before)} → <strong>{quantityText(preview.after)} {preview.conversion.baseUnit.name}</strong></p></div> : fields.quantity && <p className="text-sm leading-6 text-warning">{previewError}</p>}
      <p className="text-xs leading-5 text-ink-muted">Jumlah/kemasan diskret harus bulat. Berat/volume maksimal 3 desimal; hasil tidak dibulatkan diam-diam. Mutasi dan saldo disimpan bersama. Ledger tidak dapat diedit/dihapus.</p>
      {error && <div role="alert" className="rounded-xl bg-danger-soft p-3 text-sm leading-6 text-danger">{error}{lastSubmitted && <Button variant="secondary" className="mt-3" disabled={busy} onClick={() => void save(lastSubmitted)}>Coba lagi operasi yang sama</Button>}</div>}
      {confirmation ? <div className="rounded-xl bg-warning-soft p-4 text-sm leading-6 text-warning"><p>Konfirmasi koreksi keluar <strong>{quantityText(Math.abs(confirmation.preview.delta))} {confirmation.preview.conversion.baseUnit.name}</strong>. Saldo menjadi <strong>{quantityText(confirmation.preview.after)}</strong>. Koreksi tersimpan tidak bisa dihapus; perbaikan berikutnya harus mutasi baru.</p><div className="mt-4 flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={() => setConfirmation(null)} disabled={busy}>Kembali ke form</Button><Button variant="danger" onClick={() => void save(confirmation.command)} disabled={busy}>{busy ? 'Menyimpan…' : 'Ya, kurangi stok'}</Button></div></div> : <div className="flex flex-wrap justify-end gap-3"><Button variant="secondary" onClick={onClose} disabled={busy}>Batal</Button><Button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : fields.type === 'ADJUSTMENT_OUT' ? 'Tinjau koreksi keluar' : 'Simpan mutasi'}</Button></div>}
      <details className="text-[11px] text-ink-muted"><summary className="min-h-11 cursor-pointer py-3">Identitas operasi</summary><p className="break-all">{operationId}</p></details>
    </form>
  </Dialog>
}
