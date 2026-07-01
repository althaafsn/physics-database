export interface PhysicsDetail {
  id: string
  title: string
}

export interface PhysicsTopic {
  id: string
  title: string
  discipline: string
  details: PhysicsDetail[]
}

export interface PhysicsDiscipline {
  id: string
  title: string
  topics: string[]
}

export interface PhysicsTagTaxonomy {
  version: number
  disciplines: PhysicsDiscipline[]
  topics: PhysicsTopic[]
}

export interface PhysicsTagRecord {
  problem_id: string
  topics: string[]
  details: string[]
  disciplines: string[]
  confidence: number
  method: string
  model?: string | null
  /** @deprecated legacy v1 */
  chapters?: string[]
  /** @deprecated legacy v1 */
  sections?: string[]
}

export interface SimilarNeighbor {
  id: string
  score: number
  shared_topics: string[]
  shared_details: string[]
  /** @deprecated legacy */
  shared_chapters?: string[]
  /** @deprecated legacy */
  shared_sections?: string[]
}

export type PhysicsTagsById = Record<string, PhysicsTagRecord>
export type SimilarityById = Record<string, SimilarNeighbor[]>

const TAXONOMY_URL = '/data/halliday/taxonomy.json'
const TAGS_URL = '/data/halliday/tags.json'
const SIMILARITY_URL = '/data/halliday/similarity.json'

let taxonomyCache: PhysicsTagTaxonomy | null = null
let tagsCache: PhysicsTagsById | null = null
let similarityCache: SimilarityById | null = null

export function physicsTagsSwrKey(): string {
  return TAGS_URL
}

/** @deprecated use physicsTagsSwrKey */
export const hallidaySwrKey = physicsTagsSwrKey

export async function fetchPhysicsTaxonomy(): Promise<PhysicsTagTaxonomy | null> {
  if (taxonomyCache) return taxonomyCache
  const res = await fetch(TAXONOMY_URL)
  if (!res.ok) return null
  taxonomyCache = (await res.json()) as PhysicsTagTaxonomy
  return taxonomyCache
}

export async function fetchPhysicsTags(): Promise<PhysicsTagsById> {
  if (tagsCache) return tagsCache
  const res = await fetch(TAGS_URL)
  if (!res.ok) return {}
  tagsCache = (await res.json()) as PhysicsTagsById
  return tagsCache
}

export async function fetchSimilarityIndex(): Promise<SimilarityById> {
  if (similarityCache) return similarityCache
  const res = await fetch(SIMILARITY_URL)
  if (!res.ok) return {}
  similarityCache = (await res.json()) as SimilarityById
  return similarityCache
}

export async function physicsTagsFetcher(): Promise<{
  tags: PhysicsTagsById
  similarity: SimilarityById
  taxonomy: PhysicsTagTaxonomy | null
}> {
  const [tags, similarity, taxonomy] = await Promise.all([
    fetchPhysicsTags(),
    fetchSimilarityIndex(),
    fetchPhysicsTaxonomy(),
  ])
  return { tags, similarity, taxonomy }
}

/** @deprecated use physicsTagsFetcher */
export const hallidayFetcher = physicsTagsFetcher

function humanizeKebab(id: string): string {
  return id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function topicLabel(
  taxonomy: PhysicsTagTaxonomy | null | undefined,
  topicId: string,
): string {
  const topic = taxonomy?.topics.find((t) => t.id === topicId)
  return topic?.title ?? humanizeKebab(topicId)
}

export function detailLabel(
  taxonomy: PhysicsTagTaxonomy | null | undefined,
  detailId: string,
): string {
  for (const topic of taxonomy?.topics ?? []) {
    const detail = topic.details.find((d) => d.id === detailId)
    if (detail) return detail.title
  }
  return humanizeKebab(detailId)
}

export function disciplineLabel(
  taxonomy: PhysicsTagTaxonomy | null | undefined,
  disciplineId: string,
): string {
  const discipline = taxonomy?.disciplines.find((d) => d.id === disciplineId)
  return discipline?.title ?? humanizeKebab(disciplineId)
}

/** Normalize legacy tag records */
export function normalizeTagRecord(record: PhysicsTagRecord | undefined) {
  if (!record) return null
  const topics = record.topics?.length ? record.topics : (record.chapters ?? [])
  const details = record.details?.length ? record.details : (record.sections ?? [])
  return { ...record, topics, details }
}
