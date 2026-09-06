export const MONTHS_ID = [
  'januari',
  'februari',
  'maret',
  'april',
  'mei',
  'juni',
  'juli',
  'agustus',
  'september',
  'oktober',
  'november',
  'desember',
]

/**
 * Rebuilds a WIB (UTC+7) wall-clock time as a real instant.
 * MAGMA reports every timestamp in WIB, so the offset is fixed, not local.
 */
export function wibToDate(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  return new Date(Date.UTC(year, monthIndex, day, hour - 7, minute))
}
