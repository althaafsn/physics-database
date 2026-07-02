export type YoutubeMatchType = 'exam_full' | 'problem_number' | 'title_fuzzy'

export interface YoutubeProblemLink {
  problem_id: string
  video_id: string
  title: string
  url: string
  match_type: YoutubeMatchType
  confidence: number
  channel: string
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

export function matchTypeLabel(matchType: YoutubeMatchType): string {
  switch (matchType) {
    case 'exam_full':
      return 'Full exam walkthrough'
    case 'problem_number':
      return 'Problem-specific'
    case 'title_fuzzy':
      return 'Title match'
    default:
      return 'Video'
  }
}
