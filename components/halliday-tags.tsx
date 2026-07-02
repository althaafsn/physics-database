'use client'

import useSWR from 'swr'
import {
  detailLabel,
  normalizeTagRecord,
  physicsTagsFetcher,
  topicLabel,
} from '@/lib/halliday'

export function PhysicsTags({ problemId }: { problemId: string }) {
  const { data } = useSWR('physics-tags-data', physicsTagsFetcher, {
    revalidateOnFocus: false,
  })

  const tags = normalizeTagRecord(data?.tags[problemId])
  if (!tags || (tags.topics.length === 0 && tags.details.length === 0)) {
    return null
  }

  const taxonomy = data?.taxonomy

  return (
    <section className="space-y-3 border-t border-border/60 pt-4">
      <h4 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        Physics topics
      </h4>
      {tags.topics.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.topics.map((topic) => (
            <span
              key={topic}
              className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-medium leading-snug text-primary"
              title={topicLabel(taxonomy, topic)}
            >
              {topicLabel(taxonomy, topic)}
            </span>
          ))}
        </div>
      ) : null}
      {tags.details.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {tags.details.map((detail) => (
            <span
              key={detail}
              className="rounded-md bg-muted/60 px-2 py-0.5 text-[10px] leading-snug text-muted-foreground"
              title={detailLabel(taxonomy, detail)}
            >
              {detailLabel(taxonomy, detail)}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  )
}

/** @deprecated use PhysicsTags */
export const HallidayTags = PhysicsTags
