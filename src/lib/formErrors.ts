import type { ParseKeys, TFunction } from 'i18next'

export function errorText(t: TFunction, message: string | undefined): string | undefined {
  return message === undefined ? undefined : t(message as ParseKeys)
}
