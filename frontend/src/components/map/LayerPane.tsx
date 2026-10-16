import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Pane } from 'react-leaflet'

// React-Leaflet Pane styles are initialization-only. Update mutable layer visibility/order via its DOM ref.
export function LayerPane({
  name,
  zIndex,
  visible = true,
  children,
}: {
  name: string
  zIndex: number
  visible?: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.style.zIndex = String(zIndex)
      ref.current.style.display = visible ? 'block' : 'none'
    }
  }, [zIndex, visible])
  return (
    <Pane ref={ref} name={name} style={{ zIndex, display: visible ? 'block' : 'none' }}>
      {children}
    </Pane>
  )
}
