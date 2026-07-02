# Solution pipeline

Worked-solution PDFs → aligned problem solutions → concept tags → prerequisite graph.

## Quick start

```bash
source .venv/bin/activate
bash scripts/ollama-local.sh start   # if LLM_PROVIDER=local in local.env

# Full pipeline (ingest + concept tags + graph with LLM topic pass)
npm run solutions:pipeline

# Or step by step:
npm run solutions:ingest
npm run solutions:concepts
npm run solutions:graph
```

## Outputs (backend-only, not in static export)

| Path | Description |
|------|-------------|
| `parsed/solutions/solutions.jsonl` | Worked solutions aligned to `problem_id` |
| `parsed/solutions/skipped.jsonl` | PDFs that failed ingest + reason |
| `parsed/concepts/solution_concepts.jsonl` | LLM `solved_concepts` from solution text |
| `parsed/graph/prerequisites.jsonl` | Prerequisite/unlocks edges per problem |

Loaded by `admin/server/physics_admin/tutor_context.py` and the public hints API
`GET /api/problems/{id}/solution` for progressive reveal in the reader UI.

## Ingest options

```bash
export PHYSICS_MARKER_CPU=1
export MARKER_FORCE_OCR=0
python3 scripts/ingest_solutions.py              # all PDFs, resumable
python3 scripts/ingest_solutions.py --only file.pdf
python3 scripts/ingest_solutions.py --force        # re-run Marker
```

Bronze markdown cached in `output_solutions/` (gitignored).

## Graph logic

1. **Concept tags**: solution LLM tags override Halliday statement tags per problem.
2. **Subset edges**: within same topic, A → B when A's concepts are mostly contained in B's.
3. **LLM edges** (`--llm`): one batch call per topic for extra study-order links (optional).
