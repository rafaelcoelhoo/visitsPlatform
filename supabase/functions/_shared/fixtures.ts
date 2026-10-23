import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (name: string): Uint8Array => new Uint8Array(readFileSync(join(import.meta.dirname, 'fixtures', name)))

export const FIXTURES = {
  lossless1x1: read('lossless-1x1.webp'),
  lossy1x1: read('lossy-1x1.webp'),
  lossy1600x900: read('lossy-1600x900.webp'),
  lossy1601x100: read('lossy-1601x100.webp'),
}
