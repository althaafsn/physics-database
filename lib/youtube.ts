export type YoutubeMatchType = 'exam_full' | 'exam_timestamp' | 'problem_number' | 'title_fuzzy'

export interface YoutubeProblemLink {
  problem_id: string
  video_id: string
  title: string
  url: string
  match_type: YoutubeMatchType
  confidence: number
  channel: string
  /** Jump-to time in seconds (from video description timestamps). */
  start_seconds?: number
  /** Human-readable timestamp label, e.g. 04:43 or 01:02:31. */
  start_label?: string
}

export type YoutubeLinksByProblem = Record<string, YoutubeProblemLink[]>

const LINKS_URL = '/data/youtube/links.json'

let linksCache: YoutubeLinksByProblem | null = null

export function youtubeLinksSwrKey(): string {
  return LINKS_URL
}

export async function fetchYoutubeLinks(): Promise<YoutubeLinksByProblem> {
  if (linksCache) return linksCache
  const res = await fetch(LINKS_URL)
  if (!res.ok) return {}
  linksCache = (await res.json()) as YoutubeLinksByProblem
  return linksCache
}

export function matchTypeLabel(
  matchType: YoutubeMatchType,
  startLabel?: string,
): string {
  if (startLabel) {
    return `Starts at ${startLabel}`
  }
  switch (matchType) {
    case 'exam_full':
    case 'exam_timestamp':
      return 'Full exam walkthrough'
    case 'problem_number':
      return 'Problem-specific'
    case 'title_fuzzy':
      return 'Title match'
    default:
      return 'Video'
  }
}
