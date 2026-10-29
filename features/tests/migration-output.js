import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs'

export const MAX_REPORT_BYTES = 8 * 1024 * 1024
export const MAX_PROBE_BYTES = 64 * 1024

// Limits apply to reads, not child disk writes (#12). The sandbox runs trusted
// code and is not OS isolation.
// Reject non-regular files and symlinks, and cap actual bytes read even if the
// file grows after fstat. O_NONBLOCK prevents a hostile FIFO from hanging open.
export function readBoundedText(path, maxBytes, { optional = false } = {}) {
  let fd
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  } catch (error) {
    if (optional && error.code === 'ENOENT') return ''
    throw error
  }
  try {
    const stat = fstatSync(fd)
    if (!stat.isFile()) throw new Error(`Expected a regular file: ${path}`)
    if (stat.size > maxBytes) throw new Error(`File exceeds ${maxBytes} bytes: ${path}`)
    const buffer = Buffer.allocUnsafe(maxBytes + 1)
    let count = 0
    while (count < buffer.length) {
      const read = readSync(fd, buffer, count, buffer.length - count, null)
      if (read === 0) break
      count += read
    }
    if (count > maxBytes) throw new Error(`File exceeds ${maxBytes} bytes: ${path}`)
    return buffer.subarray(0, count).toString('utf8')
  } finally {
    closeSync(fd)
  }
}
