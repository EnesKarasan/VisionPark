import { useState, useEffect } from 'react'

/** Görünür genişlik (çentik / zoom sonrası daha doğru) */
function getCssViewportWidth(): number {
  if (typeof window === 'undefined') return 375
  const vv = window.visualViewport
  return Math.round(vv?.width ?? window.innerWidth)
}

/**
 * Mobil çekmece genişliği (px) — telefon CSS genişliğine göre oransal.
 * Örnek 375px: ~%28 → ~105px. Üst sınır ekranın ~%34'ü veya 200px (hangisi küçükse).
 */
export function computeMobileDrawerWidth(cssWidth: number): number {
  const preferred = Math.round(cssWidth * 0.28)
  const minW = 88
  const maxW = Math.min(Math.round(cssWidth * 0.34), 200)
  return Math.min(maxW, Math.max(minW, preferred))
}

export function useMobileDrawerWidth(isDesktop: boolean): number | undefined {
  const [px, setPx] = useState<number | undefined>(() => {
    if (typeof window === 'undefined' || window.matchMedia('(min-width: 768px)').matches) {
      return undefined
    }
    return computeMobileDrawerWidth(getCssViewportWidth())
  })

  useEffect(() => {
    if (isDesktop) {
      setPx(undefined)
      return
    }

    const update = () => setPx(computeMobileDrawerWidth(getCssViewportWidth()))

    update()
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)

    return () => {
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [isDesktop])

  return px
}
