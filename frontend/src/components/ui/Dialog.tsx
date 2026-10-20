import { useEffect, useId, useRef, type PropsWithChildren } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

type Props = PropsWithChildren<{ title: string; onClose: () => void; wide?: boolean; sheet?: boolean; mode?: 'demo' | 'local' }>
export function Dialog({ title, onClose, children, wide = false, sheet = false, mode = 'demo' }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog?.showModal()
    const viewport = window.visualViewport
    const resize = () => {
      dialog?.style.setProperty('--dialog-viewport-height', `${viewport?.height ?? window.innerHeight}px`)
      dialog?.style.setProperty('--dialog-keyboard-inset', `${Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`)
    }
    resize()
    viewport?.addEventListener('resize', resize)
    viewport?.addEventListener('scroll', resize)
    return () => {
      viewport?.removeEventListener('resize', resize)
      viewport?.removeEventListener('scroll', resize)
      dialog?.close()
      document.body.style.overflow = previousOverflow
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
      else document.getElementById('operasional')?.focus()
    }
  }, [])
  return (
    <dialog ref={ref} aria-labelledby={titleId} className={`demo-dialog ${wide ? 'demo-dialog-wide' : ''} ${sheet ? 'cart-sheet' : ''}`}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect()
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
      } }}>
      <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
        <div><p className="eyebrow mb-1">{mode === 'local' ? 'Data lokal · IndexedDB' : 'Simulasi · DEMO'}</p><h2 id={titleId} className="text-lg font-semibold text-ink">{title}</h2></div>
        <Button variant="ghost" aria-label="Tutup dialog" onClick={onClose}><X size={20} aria-hidden="true" /></Button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  )
}
