/**
 * Injected during demo recording only.
 * Spotlight uses fixed viewport coords + box-shadow cutout (no page zoom).
 */
(() => {
  if (window.__demoOverlay) return

  const ROOT_ID = 'physics-demo-overlay-root'
  const HOLE_ID = 'physics-demo-hole'
  const CAPTION_ID = 'physics-demo-caption'
  const STEP_ID = 'physics-demo-step'
  const BACKDROP_ID = 'physics-demo-backdrop'

  let stepCounter = 0

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async function waitForLayout() {
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    )
  }

  function ensureRoot() {
    let root = document.getElementById(ROOT_ID)
    if (root) return root

    root = document.createElement('div')
    root.id = ROOT_ID
    root.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:99999',
      'pointer-events:none',
      'font-family:system-ui,-apple-system,sans-serif',
    ].join(';')

    const backdrop = document.createElement('div')
    backdrop.id = BACKDROP_ID
    backdrop.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:rgba(8,12,24,0.72)',
      'opacity:0',
      'transition:opacity 350ms ease',
    ].join(';')

    const hole = document.createElement('div')
    hole.id = HOLE_ID
    hole.style.cssText = [
      'position:fixed',
      'box-sizing:border-box',
      'border:3px solid #38bdf8',
      'border-radius:12px',
      'box-shadow:0 0 0 9999px rgba(8,12,24,0.62),0 0 28px rgba(56,189,248,0.55)',
      'opacity:0',
      'transition:opacity 250ms ease, top 420ms cubic-bezier(.2,.8,.2,1), left 420ms cubic-bezier(.2,.8,.2,1), width 420ms cubic-bezier(.2,.8,.2,1), height 420ms cubic-bezier(.2,.8,.2,1)',
      'will-change:top,left,width,height,opacity',
    ].join(';')

    const caption = document.createElement('div')
    caption.id = CAPTION_ID
    const isMobile = window.innerWidth < 768
    const captionFont = isMobile ? '15px' : '22px'
    const titleFont = isMobile ? '20px' : '26px'
    const captionBottom = isMobile ? '18px' : '28px'
    const captionPad = isMobile ? '12px 18px' : '16px 28px'

    caption.style.cssText = [
      'position:fixed',
      'left:50%',
      `bottom:${captionBottom}`,
      'transform:translateX(-50%)',
      'max-width:min(960px,calc(100vw - 32px))',
      `padding:${captionPad}`,
      'border-radius:16px',
      'background:rgba(15,23,42,0.94)',
      'color:#f8fafc',
      `font-size:${captionFont}`,
      'line-height:1.45',
      'text-align:center',
      'box-shadow:0 12px 40px rgba(0,0,0,0.35)',
      'opacity:0',
      'transition:opacity 250ms ease',
    ].join(';')

    const step = document.createElement('div')
    step.id = STEP_ID
    step.style.cssText = [
      'position:fixed',
      'top:18px',
      'right:22px',
      'padding:6px 12px',
      'border-radius:999px',
      'background:rgba(56,189,248,0.18)',
      'color:#7dd3fc',
      'font-size:12px',
      'font-weight:600',
      'letter-spacing:0.04em',
      'opacity:0',
      'transition:opacity 250ms ease',
    ].join(';')

    root.appendChild(backdrop)
    root.appendChild(hole)
    root.appendChild(caption)
    root.appendChild(step)
    document.body.appendChild(root)
    return root
  }

  function applyHole(rect, padding) {
    const hole = document.getElementById(HOLE_ID)
    if (!hole || !rect) return

    const top = Math.max(8, rect.y - padding)
    const left = Math.max(8, rect.x - padding)
    const width = Math.min(window.innerWidth - left - 8, rect.width + padding * 2)
    const height = Math.min(window.innerHeight - top - 8, rect.height + padding * 2)

    hole.style.top = `${top}px`
    hole.style.left = `${left}px`
    hole.style.width = `${Math.max(24, width)}px`
    hole.style.height = `${Math.max(24, height)}px`
    hole.style.opacity = '1'
  }

  function showCaption(text, stepLabel = true) {
    const captionEl = document.getElementById(CAPTION_ID)
    const stepEl = document.getElementById(STEP_ID)
    if (captionEl) {
      captionEl.textContent = text
      captionEl.style.opacity = text ? '1' : '0'
    }
    if (stepEl && stepLabel) {
      stepEl.textContent = `Step ${stepCounter}`
      stepEl.style.opacity = '1'
    }
  }

  window.__demoOverlay = {
    async titleCard(title, subtitle) {
      stepCounter += 1
      ensureRoot()
      this.clear(false)

      const caption = document.getElementById(CAPTION_ID)
      const step = document.getElementById(STEP_ID)
      const backdrop = document.getElementById(BACKDROP_ID)
      caption.innerHTML = `<strong style="display:block;font-size:${window.innerWidth < 768 ? '20px' : '26px'};margin-bottom:8px">${title}</strong>${subtitle || ''}`
      step.textContent = `Step ${stepCounter}`
      caption.style.opacity = '1'
      step.style.opacity = '1'
      backdrop.style.opacity = '1'
      await wait(2800)
    },

    async caption(text, ms = 2200) {
      stepCounter += 1
      ensureRoot()
      showCaption(text)
      await wait(ms)
    },

    async spotlightRect(rect, options = {}) {
      const { caption = '', padding = 8, holdMs = 2400 } = options

      if (!rect || rect.width <= 0 || rect.height <= 0) {
        if (caption) await this.caption(caption, holdMs)
        return false
      }

      stepCounter += 1
      ensureRoot()

      const backdrop = document.getElementById(BACKDROP_ID)
      backdrop.style.opacity = '0'
      applyHole(rect, padding)
      if (caption) showCaption(caption)

      await wait(holdMs)
      return true
    },

    async spotlight(selector, options = {}) {
      const { caption = '', padding = 8, holdMs = 2400 } = options

      const target = document.querySelector(selector)
      if (!target) {
        if (caption) await this.caption(caption, holdMs)
        return false
      }

      target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
      await waitForLayout()
      await wait(120)

      const rect = target.getBoundingClientRect()
      return this.spotlightRect(
        { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        { caption, padding, holdMs },
      )
    },

    clear(resetBackdrop = true) {
      const hole = document.getElementById(HOLE_ID)
      const captionEl = document.getElementById(CAPTION_ID)
      const stepEl = document.getElementById(STEP_ID)
      const backdrop = document.getElementById(BACKDROP_ID)

      if (hole) hole.style.opacity = '0'
      if (captionEl) {
        captionEl.textContent = ''
        captionEl.style.opacity = '0'
      }
      if (stepEl) stepEl.style.opacity = '0'
      if (backdrop && resetBackdrop) backdrop.style.opacity = '0'
    },

    async endCard(title, subtitle) {
      await this.titleCard(title, subtitle)
      this.clear()
    },
  }

  window.print = () => {
    window.__demoPrintTriggered = true
  }
})()
