export type FailureReason = 'timeout' | 'http' | 'parse'

export type Result<T> =
  | { ok: true; data: T; fetchedAt: Date; sourceUrl: string }
  | { ok: false; reason: FailureReason; sourceUrl: string }

export const ok = <T>(data: T, sourceUrl: string, fetchedAt?: Date): Result<T> => ({
  ok: true,
  data,
  fetchedAt: fetchedAt ?? new Date(),
  sourceUrl,
})

export const fail = <T>(reason: FailureReason, sourceUrl: string): Result<T> => ({
  ok: false,
  reason,
  sourceUrl,
})
