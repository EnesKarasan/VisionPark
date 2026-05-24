import sidebarLogoSrc from '../assets/sidebar-logo.svg'

type SidebarLogoProps = {
  /** Örn. h-8 w-8 (kare ikon) veya h-9 w-auto max-w-[200px] (yatay logo) */
  className?: string
  alt?: string
}

/**
 * Kenar çubuğu üstündeki logo — kaynak: `src/assets/sidebar-logo.svg`.
 * İndirilen bir SVG’yi aktarmak için: `npm run import-sidebar-logo` (Downloads’taki Gemini dosyasından kopyalar, koyu tema için dolguyu #f8fafc yapar).
 * Elle düzenlerken koyu arka plan için açık renk (#f8fafc) kullanın.
 */
export function SidebarLogo({ className, alt = 'VisionPark' }: SidebarLogoProps) {
  return <img src={sidebarLogoSrc} alt={alt} className={className} draggable={false} />
}
