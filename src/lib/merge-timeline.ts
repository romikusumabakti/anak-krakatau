import type { EruptionEvent } from '@/lib/sources/eruptions'
import type { VonaNotice } from '@/lib/sources/vona'

export type TimelineEntry = {
  at: Date
  kind: 'eruption' | 'vona'
  text: string
  ongoing: boolean
  url: string | null
}

const MAX_ENTRIES = 20

export function mergeTimeline(eruptions: EruptionEvent[], notices: VonaNotice[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...eruptions.map((event) => ({
      at: event.occurredAt,
      kind: 'eruption' as const,
      text: event.narrative,
      ongoing: event.ongoing,
      url: null,
    })),
    ...notices.map((notice) => ({
      at: notice.issuedAt,
      kind: 'vona' as const,
      text: notice.summary,
      ongoing: false,
      url: notice.detailUrl,
    })),
  ]

  return entries.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, MAX_ENTRIES)
}

/**
 * A stable React key for a timeline entry. `kind` + timestamp alone can
 * collide: MAGMA has issued multiple VONA notices within the same minute
 * during this eruption, and eruption narratives are only timestamped to the
 * minute (parsed from "pukul HH:MM WIB"). Folding in the entry's own text --
 * the full narrative or summary, which differs whenever the underlying
 * record does -- means a collision now requires two genuinely identical
 * records at the same timestamp, not merely a shared minute.
 */
export function timelineKey(entry: TimelineEntry): string {
  return `${entry.kind}:${entry.at.toISOString()}:${entry.text}`
}
