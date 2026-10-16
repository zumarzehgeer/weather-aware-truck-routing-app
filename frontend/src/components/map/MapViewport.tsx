import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Plan } from '../../types'

export function routeBounds(plan: Plan) {
  return L.latLngBounds(
    plan.routes.flatMap((r) => r.geometry.map(([lon, lat]) => L.latLng(lat, lon))),
  )
}

export function MapViewport({ plan }: { plan: Plan | null }) {
  const map = useMap()
  useEffect(() => {
    if (plan) {
      map.stop()
      map.fitBounds(routeBounds(plan), { padding: [48, 48], maxZoom: 10, animate: false })
    }
  }, [plan, map])
  useEffect(() => {
    const element = map.getContainer()
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(element)
    return () => observer.disconnect()
  }, [map])
  return null
}
