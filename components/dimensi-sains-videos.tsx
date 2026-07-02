'use client'

import useSWR from 'swr'
import { ExternalLink, PlayCircle } from 'lucide-react'
import { fetchYoutubeLinks, matchTypeLabel, youtubeLinksSwrKey } from '@/lib/youtube'

interface DimensiSainsVideosProps {
  problemId: string
}

export function DimensiSainsVideos({ problemId }: DimensiSainsVideosProps) {
  const { data: linksByProblem } = useSWR(youtubeLinksSwrKey(), fetchYoutubeLinks, {
    revalidateOnFocus: false,
  })

  const links = linksByProblem?.[problemId] ?? []
  if (links.length === 0) return null

  return (
    <section className="space-y-3 border-t border-border/60 pt-4">
      <div className="flex items-center gap-2">
        <PlayCircle className="size-3.5 text-red-500" />
        <h4 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Dimensi Sains videos
        </h4>
      </div>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.video_id}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/50"
            >
              <span className="mt-0.5 shrink-0 text-red-500">
                <PlayCircle className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm leading-snug text-foreground group-hover:underline">
                  {link.title}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{matchTypeLabel(link.match_type)}</span>
                  {link.match_type === 'title_fuzzy' ? (
                    <span>{Math.round(link.confidence * 100)}% match</span>
                  ) : null}
                </span>
              </span>
              <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
