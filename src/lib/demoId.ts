let sequence = 0
// ID untuk memori sesi; tetap bekerja pada tablet lewat HTTP jaringan lokal.
export function demoId(prefix: string) { sequence += 1; return `${prefix}-${Date.now()}-${sequence}` }
