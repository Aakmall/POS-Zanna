import { useContext } from 'react'
import { DemoContext } from '../app/demoContext'

export function useDemoStore() {
  const store = useContext(DemoContext)
  if (!store) throw new Error('useDemoStore harus dipakai di dalam DemoProvider')
  return store
}
