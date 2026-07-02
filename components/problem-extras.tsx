'use client'

import { AskAiAboutProblem } from '@/components/ai/ask-ai-about-problem'
import { SolutionHintsPanel } from '@/components/solution-hints-panel'
import { DimensiSainsVideos } from '@/components/dimensi-sains-videos'
import { PhysicsTags } from '@/components/halliday-tags'
import { SimilarProblems } from '@/components/similar-problems'
import type { Problem } from '@/lib/types'

export function ProblemExtras({
  problem,
  onSelectSimilar,
}: {
  problem: Problem
  onSelectSimilar?: (problem: Problem) => void
}) {
  return (
    <div className="space-y-4">
      <SolutionHintsPanel problem={problem} />
      <DimensiSainsVideos problemId={problem.id} />
      <PhysicsTags problemId={problem.id} />
      <SimilarProblems problemId={problem.id} onSelect={onSelectSimilar} />
      <AskAiAboutProblem problem={problem} />
    </div>
  )
}
