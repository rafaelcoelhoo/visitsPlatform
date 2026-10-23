export interface WebpInfo {
  width: number
  height: number
}

const ascii = (bytes: Uint8Array, start: number, text: string): boolean =>
  text.split('').every((char, index) => bytes[start + index] === char.charCodeAt(0))

const le24 = (b: Uint8Array, at: number): number => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8) | ((b[at + 2] ?? 0) << 16)

// Lê o cabeçalho real do ficheiro (magic bytes + dimensões). Devolve null se não for um WebP bem formado.
// Não confia na extensão nem no Content-Type, que o cliente controla.
export function readWebp(bytes: Uint8Array): WebpInfo | null {
  if (bytes.length < 30) return null
  if (!ascii(bytes, 0, 'RIFF') || !ascii(bytes, 8, 'WEBP')) return null
  const riffSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true)
  if (riffSize + 8 !== bytes.length) return null

  if (ascii(bytes, 12, 'VP8 ')) {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null
    return {
      width: ((bytes[26] ?? 0) | ((bytes[27] ?? 0) << 8)) & 0x3fff,
      height: ((bytes[28] ?? 0) | ((bytes[29] ?? 0) << 8)) & 0x3fff,
    }
  }

  if (ascii(bytes, 12, 'VP8L')) {
    if (bytes[20] !== 0x2f) return null
    const b1 = bytes[21] ?? 0
    const b2 = bytes[22] ?? 0
    const b3 = bytes[23] ?? 0
    const b4 = bytes[24] ?? 0
    return {
      width: 1 + (((b2 & 0x3f) << 8) | b1),
      height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
    }
  }

  if (ascii(bytes, 12, 'VP8X')) {
    return { width: 1 + le24(bytes, 24), height: 1 + le24(bytes, 27) }
  }

  return null
}

export type WebpRejection = 'file_too_large' | 'not_webp' | 'dimensions_too_large'

export function validateWebp(bytes: Uint8Array, limits: { maxBytes: number; maxLongSidePx: number }): WebpRejection | null {
  if (bytes.length > limits.maxBytes) return 'file_too_large'
  const info = readWebp(bytes)
  if (!info || info.width < 1 || info.height < 1) return 'not_webp'
  if (Math.max(info.width, info.height) > limits.maxLongSidePx) return 'dimensions_too_large'
  return null
}
