export function displayTime(value: string, zone: string, full = false) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    month: full ? 'short' : undefined,
    day: full ? 'numeric' : undefined,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value))
}
export function duration(seconds: number) {
  const minutes = Math.round(seconds / 60)
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
export function value(number: number | null | undefined, digits = 1) {
  return number == null ? 'Unavailable' : number.toFixed(digits)
}

export function localDate(zone: string) {
  const date = new Date(Date.now() + 3600_000)
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
  return parts.replace(' ', 'T')
}
