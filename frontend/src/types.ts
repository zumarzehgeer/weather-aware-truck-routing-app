export type Place = { name: string; latitude: number; longitude: number; timezone?: string }
export type PlanRequest = {
  origin: Place
  destination: Place
  departure_local: string
  timezone: string
  load_lb: number
  spacing_miles: number
  demo: boolean
}
export type Capabilities = { demo_enabled: boolean; weather_transport?: 'server' | 'browser' }
export type Weather = {
  time: string
  wind_mph: number | null
  rain_in: number | null
  snow_in: number | null
}
export type Risk = { score: number | null; label: string; complete: boolean; reasons: string[] }
export type Checkpoint = {
  id: string
  coordinate: [number, number]
  mile: number
  arrival: string
  weather: Weather | null
  risk: Risk
}
export type Route = {
  id: string
  name: string
  geometry: [number, number][]
  distance_miles: number
  duration_seconds: number
  arrival: string
  checkpoints: Checkpoint[]
  summary: {
    risk_miles: Record<string, number>
    average_risk: number | null
    complete: boolean
    no_travel: boolean
  }
}
export type Cell = {
  coordinate: [number, number]
  bounds: [[number, number], [number, number]]
  forecasts: { weather: Weather | null; risk: Risk }[]
}
export type Plan = {
  mode: 'live' | 'demo'
  generated_at: string
  departure: string
  origin: Place
  destination: Place
  load_lb: number
  spacing_miles: number
  routes: Route[]
  recommended_id: string | null
  explanation: string
  warnings: string[]
  corridor: { timestamps: string[]; cells: Cell[] }
  providers: {
    routing: string
    weather: string
    truck_restrictions: boolean
    weather_transport?: 'server' | 'browser'
  }
}
