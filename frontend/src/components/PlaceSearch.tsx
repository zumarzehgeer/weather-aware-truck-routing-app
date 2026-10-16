import { useEffect, useRef, useState } from 'react'
import { MapPin, LoaderCircle, Search } from 'lucide-react'
import { api } from '../lib/api'
import type { Place } from '../types'

export function PlaceSearch({
  label,
  place,
  onChange,
  disabled,
  id,
}: {
  label: string
  place: Place | null
  onChange: (value: Place | null) => void
  disabled: boolean
  id: string
}) {
  const [query, setQuery] = useState(place?.name ?? '')
  const [results, setResults] = useState<Place[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  useEffect(() => {
    if (!place) return
    controller.current?.abort()
    setQuery(place.name)
    setResults([])
    setActive(-1)
    setError('')
    setOpen(false)
    setLoading(false)
  }, [place])
  useEffect(() => {
    if (!open || query.length < 2 || query === place?.name || results.length > 0) return
    const timer = setTimeout(() => {
      controller.current?.abort()
      const abort = new AbortController()
      controller.current = abort
      setLoading(true)
      setError('')
      setResults([])
      api<{ results: Place[] }>(`/api/geocode?q=${encodeURIComponent(query)}`, {
        signal: abort.signal,
      })
        .then((data) => {
          if (!abort.signal.aborted) {
            setResults(data.results)
            setActive(-1)
            if (!data.results.length) setError('No places found. Try a city name.')
          }
        })
        .catch((err) => {
          if (!abort.signal.aborted) setError(err.message)
        })
        .finally(() => {
          if (!abort.signal.aborted) setLoading(false)
        })
    }, 400)
    return () => {
      clearTimeout(timer)
      controller.current?.abort()
      setLoading(false)
    }
  }, [query, open, place, results.length])
  function select(item: Place) {
    onChange(item)
    setQuery(item.name)
    setOpen(false)
    setResults([])
  }
  return (
    <div className="place-field">
      <label htmlFor={id}>{label}</label>
      <div className="input-icon">
        <MapPin size={17} aria-hidden="true" />
        <input
          id={id}
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open && results.length > 0}
          aria-controls={`${id}-results`}
          aria-activedescendant={
            open && active >= 0 && active < results.length ? `${id}-${active}` : undefined
          }
          placeholder="Search a city or town"
          value={query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            setQuery(e.target.value)
            onChange(null)
            setOpen(true)
            setResults([])
            setActive(-1)
            setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              setActive(-1)
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              setOpen(true)
              if (!results.length) {
                setActive(-1)
                return
              }
              setActive(
                e.key === 'ArrowDown'
                  ? Math.min(results.length - 1, active + 1)
                  : active < 0
                    ? results.length - 1
                    : Math.max(0, active - 1),
              )
            }
            if (e.key === 'Enter' && open && active >= 0 && results[active]) {
              e.preventDefault()
              select(results[active])
            }
          }}
        />
        {loading ? (
          <LoaderCircle className="spin" size={15} />
        ) : (
          <Search size={15} className="search-icon" />
        )}
      </div>
      {open && (results.length > 0 || error) && (
        <div
          className="search-dropdown"
          id={`${id}-results`}
          role="listbox"
          aria-label={`${label} search results`}
        >
          {error && <p role="status">{error}</p>}
          {results.map((item, i) => (
            <button
              type="button"
              role="option"
              aria-selected={active === i}
              id={`${id}-${i}`}
              key={`${item.latitude}-${item.longitude}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(item)}
            >
              <MapPin size={15} />
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
