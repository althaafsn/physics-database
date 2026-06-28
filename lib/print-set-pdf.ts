import { toast } from 'sonner'

export function printExamPreview(): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.print()
    return true
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Print failed')
    return false
  }
}

export function downloadSetJson(name: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${name.replace(/\s+/g, '_') || 'exam_set'}.json`
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
