export type Level = 'OSK' | 'OSP' | 'OSN'

export type Topic =
  | 'mechanics'
  | 'electromagnetism'
  | 'thermodynamics'
  | 'waves'
  | 'optics'
  | 'modern'
  | 'mixed'

export type QualityState = 'clean' | 'error' | 'repaired'

export type ProblemLocale = 'id' | 'en'

export type IngestPhase =
  | 'pdf_only'
  | 'bronze_ready'
  | 'silver_done'
  | 'gold_done'

export interface ProblemPart {
  label: string
  prompt: string
}

export interface Problem {
  id: string
  title: string
  level: Level
  year: number
  topic: Topic
  /** Markdown body with inline/display LaTeX delimited by $$ */
  body: string
  parts: ProblemPart[]
  figure?: string
  quality: QualityState
  needsReview: boolean
  topicConfidence: number
  errorSummary?: string
  /** English translation when available (Indonesian remains in title/body/parts) */
  titleEn?: string
  bodyEn?: string
  partsEn?: ProblemPart[]
  hasTranslation: boolean
  /** Active problem text locale (same id, different language variant). */
  locale: ProblemLocale
  /** Whether an English translation exists for this problem. */
  hasEnglish: boolean
  /** English requested but no translation — showing Indonesian text. */
  usingFallback: boolean
}

export interface IngestRecord {
  slug: string
  filename: string
  phase: IngestPhase
  progress: number
  problemCount: number
  pages: number
  updatedAt: string
}

export interface ReviewError {
  problemId: string
  fault: string
  category: 'syntax' | 'figure' | 'bbox'
  action: string
}

export interface ReviewTopic {
  problemId: string
  confidence: number
  predicted: Topic
  alternate: Topic
}

export interface CorpusStats {
  totalAvailable: number
  englishAvailable: number
  topicCounts: Record<Topic, number>
  levelCounts: Record<Level, number>
}

export interface BuiltSet {
  name: string
  mode: string
  problemIds: string[]
  markdown: string
}

export interface SavedProblemSet {
  id: string
  name: string
  mode: 'manual' | 'random'
  problemIds: string[]
  createdAt: string
  updatedAt: string
}

export const TOPIC_LABELS: Record<Topic, string> = {
  mechanics: 'Mechanics',
  electromagnetism: 'Electromagnetism',
  thermodynamics: 'Thermodynamics',
  waves: 'Waves & Acoustics',
  optics: 'Optics',
  modern: 'Modern Physics',
  mixed: 'Mixed / Unclassified',
}

/** Topic slugs stored in gold JSONL (pre-catalog mapping). */
export const GOLD_TOPIC_LABELS: Record<string, string> = {
  mechanics: 'Mechanics',
  electromagnetism: 'Electromagnetism',
  thermodynamics: 'Thermodynamics',
  waves_optics: 'Waves & Optics',
  modern_physics: 'Modern Physics',
  mixed: 'Mixed / Unclassified',
}

export const GOLD_TOPICS = Object.keys(GOLD_TOPIC_LABELS)

export const PHASE_LABELS: Record<IngestPhase, string> = {
  pdf_only: 'pdf_only',
  bronze_ready: 'bronze_ready',
  silver_done: 'silver_done',
  gold_done: 'gold_done',
}

export const PHASE_ORDER: IngestPhase[] = [
  'pdf_only',
  'bronze_ready',
  'silver_done',
  'gold_done',
]

export const NEXT_PHASE_ACTION: Record<
  IngestPhase,
  { label: string; task: string } | null
> = {
  pdf_only: { label: 'Run Marker Opt', task: 'convert' },
  bronze_ready: { label: 'Extract Silver', task: 'extract' },
  silver_done: { label: 'Run LLM Repair', task: 'repair' },
  gold_done: { label: 'Audit Record', task: 'audit' },
}
