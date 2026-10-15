export type Place = { name: string; latitude: number; longitude: number; timezone?: string }
export type Weather = { time: string; wind_mph: number | null; rain_in: number | null; snow_in: number | null }
export type Risk = { score: number | null; label: string; complete: boolean; reasons: string[] }
export type Checkpoint = { id: string; coordinate: [number, number]; mile: number; arrival: string; weather: Weather | null; risk: Risk }
export type Route = {
  id: string; name: string; geometry: [number, number][]; distance_miles: number; duration_seconds: number; arrival: string;
  checkpoints: Checkpoint[]; summary: { risk_miles: Record<string, number>; average_risk: number | null; complete: boolean; no_travel: boolean }
}
export type Cell = { coordinate: [number, number]; bounds: [[number, number], [number, number]]; forecasts: { weather: Weather | null; risk: Risk }[] }
export type Plan = {
  mode: 'live' | 'demo'; generated_at: string; departure: string; origin: Place; destination: Place; load_lb: number; spacing_miles: number;
  routes: Route[]; recommended_id: string | null; explanation: string; warnings: string[];
  corridor: { timestamps: string[]; cells: Cell[] }; providers: { routing: string; weather: string; truck_restrictions: boolean }
}
export const riskColors: Record<string, string> = { Low: '#38bca4', Moderate: '#c4ce69', High: '#f4b35f', Severe: '#f47c63', 'No Travel': '#d95283', Unknown: '#94a3b8' }
export const routeColors = ['#58dac0', '#d9ad75', '#ad9bfa']
export const chicago: Place = { name: 'Chicago, Illinois, United States', latitude: 41.8781, longitude: -87.6298, timezone: 'America/Chicago' }
export const detroit: Place = { name: 'Detroit, Michigan, United States', latitude: 42.3314, longitude: -83.0458, timezone: 'America/Detroit' }

export function displayTime(value: string, zone: string, full = false) {
  return new Intl.DateTimeFormat('en-US', { timeZone: zone, month: full ? 'short' : undefined, day: full ? 'numeric' : undefined,
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(value))
}
export function duration(seconds: number) { const minutes = Math.round(seconds / 60); return `${Math.floor(minutes / 60)}h ${minutes % 60}m` }
export function value(number: number | null | undefined, digits = 1) { return number == null ? 'Unavailable' : number.toFixed(digits) }
