import { useMemo } from 'react'
import { Polyline, Tooltip } from 'react-leaflet'
import { routeColors } from '../../constants'
import type { Plan } from '../../types'
import { LayerPane } from './LayerPane'

export function RoutePaths({
  plan,
  selected,
  onSelect,
}: {
  plan: Plan
  selected: string | null
  onSelect: (id: string) => void
}) {
  const routePositions = useMemo(
    () =>
      Object.fromEntries(
        plan.routes.map((route) => [
          route.id,
          route.geometry.map(([lon, lat]) => [lat, lon] as [number, number]),
        ]),
      ),
    [plan],
  )
  // Render the selected alternative last so its line remains above the other paths.
  const sorted = [...plan.routes].sort(
    (a, b) => Number(a.id === selected) - Number(b.id === selected),
  )

  return (
    <>
      {sorted.map((route) => {
        const index = plan.routes.findIndex((r) => r.id === route.id)
        const positions = routePositions[route.id]
        return (
          <LayerPane
            key={route.id}
            name={`route-${route.id}`}
            zIndex={route.id === selected ? 440 : 420}
          >
            <Polyline
              positions={positions}
              pathOptions={{
                color: '#0d1e2d',
                weight: route.id === selected ? 10 : 8,
                opacity: 0.95,
              }}
              interactive={false}
            />
            <Polyline
              positions={positions}
              pathOptions={{
                color: routeColors[index],
                weight: route.id === selected ? 5 : 3,
                opacity: route.id === selected ? 1 : 0.85,
                dashArray: route.id === selected ? undefined : '7 5',
              }}
              eventHandlers={{ click: () => onSelect(route.id) }}
            >
              <Tooltip sticky>
                {route.name}
                {route.id === plan.recommended_id ? ' · Recommended' : ''} · Click to select
              </Tooltip>
            </Polyline>
          </LayerPane>
        )
      })}
    </>
  )
}
