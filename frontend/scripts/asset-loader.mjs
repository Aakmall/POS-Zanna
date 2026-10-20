// Tes DOM tidak memuat gambar; Vite memverifikasi bundling aset saat build.
export function load(url, context, nextLoad) {
  if (url.endsWith('.svg')) return { format: 'module', shortCircuit: true, source: 'export default "/test-local-asset.svg"' }
  return nextLoad(url, context)
}
