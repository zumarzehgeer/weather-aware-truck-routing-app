import type { Place } from './types'

export const riskColors: Record<string, string> = {
  Low: '#38bca4',
  Moderate: '#c4ce69',
  High: '#f4b35f',
  Severe: '#f47c63',
  'No Travel': '#d95283',
  Unknown: '#94a3b8',
}
export const routeColors = ['#58dac0', '#d9ad75', '#ad9bfa']
export const chicago: Place = {
  name: 'Chicago, Illinois, United States',
  latitude: 41.8781,
  longitude: -87.6298,
  timezone: 'America/Chicago',
}
export const detroit: Place = {
  name: 'Detroit, Michigan, United States',
  latitude: 42.3314,
  longitude: -83.0458,
  timezone: 'America/Detroit',
}

export const timezones = [
  'America/Chicago',
  'America/New_York',
  'America/Denver',
  'America/Los_Angeles',
  'America/Detroit',
  'UTC',
  'Europe/London',
  'Asia/Kolkata',
]
