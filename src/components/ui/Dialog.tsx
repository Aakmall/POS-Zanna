import { useEffect, useId, useRef, type PropsWithChildren } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

type Props = PropsWithChildren<{ title: string; onClose: () => void; wide?: boolean }>
export function Dialog({ title, onClose, children, wide = false }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog?.showModal()
    return () => {
      dialog?.close()
      document.body.style.overflow = previousOverflow
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])
  return (
    <dialog ref={ref} aria-labelledby={titleId} className={`demo-dialog ${wide ? 'demo-dialog-wide' : ''}`}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect()
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
      } }}>
      <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
        <div><p className="eyebrow mb-1">Simulasi · DEMO</p><h2 id={titleId} className="text-lg font-semibold text-ink">{title}</h2></div>
        <Button variant="ghost" aria-label="Tutup dialog" onClick={onClose}><X size={20} aria-hidden="true" /></Button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  )
}
