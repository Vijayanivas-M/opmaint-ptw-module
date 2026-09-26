import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import CreatePermitForm from './CreatePermitForm'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PermitStatus =
  | 'draft'
  | 'pending_area'
  | 'pending_safety'
  | 'approved'
  | 'active'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'expired'

type PermitType = 'hot_work' | 'confined_space' | 'working_at_height' | 'electrical'

interface Permit {
  id: string
  permit_number: string
  permit_type: PermitType
  status: PermitStatus
  work_description: string
  location: string
  planned_start: string
  planned_end: string
  // Hot-work extension (null for other types)
  hot_work_type: string | null
  fire_watch_required: boolean | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert snake_case enum values to human-readable labels */
function formatPermitType(type: PermitType): string {
  const labels: Record<PermitType, string> = {
    hot_work: 'Hot Work',
    confined_space: 'Confined Space',
    working_at_height: 'Working at Height',
    electrical: 'Electrical',
  }
  return labels[type] ?? type
}

/** Returns Tailwind classes + label for each status */
function statusBadge(status: PermitStatus): { label: string; classes: string } {
  const map: Record<PermitStatus, { label: string; classes: string }> = {
    draft:          { label: 'Draft',           classes: 'bg-gray-100 text-gray-600 ring-gray-300' },
    pending_area:   { label: 'Pending Area',    classes: 'bg-yellow-50 text-yellow-700 ring-yellow-300' },
    pending_safety: { label: 'Pending Safety',  classes: 'bg-amber-50 text-amber-700 ring-amber-300' },
    approved:       { label: 'Approved',        classes: 'bg-blue-50 text-blue-700 ring-blue-300' },
    active:         { label: 'Active',          classes: 'bg-green-50 text-green-700 ring-green-300' },
    completed:      { label: 'Completed',       classes: 'bg-teal-50 text-teal-700 ring-teal-300' },
    rejected:       { label: 'Rejected',        classes: 'bg-red-50 text-red-700 ring-red-300' },
    cancelled:      { label: 'Cancelled',       classes: 'bg-slate-100 text-slate-500 ring-slate-300' },
    expired:        { label: 'Expired',         classes: 'bg-orange-50 text-orange-700 ring-orange-300' },
  }
  return map[status] ?? { label: status, classes: 'bg-gray-100 text-gray-600 ring-gray-300' }
}

/** Icon per permit type (emoji keeps it dependency-free) */
function permitTypeIcon(type: PermitType): string {
  const icons: Record<PermitType, string> = {
    hot_work: '🔥',
    confined_space: '🏗️',
    working_at_height: '🪜',
    electrical: '⚡',
  }
  return icons[type] ?? '📋'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl bg-white p-5 shadow-lg shadow-slate-200/60 ring-1 ring-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <div className="h-4 w-28 rounded-lg bg-slate-200" />
        <div className="h-6 w-20 rounded-full bg-slate-200" />
      </div>
      <div className="mb-2 h-5 w-40 rounded-lg bg-slate-200" />
      <div className="h-3 w-32 rounded-lg bg-slate-100" />
    </div>
  )
}

function PermitCard({ permit }: { permit: Permit }) {
  const badge = statusBadge(permit.status)
  const icon = permitTypeIcon(permit.permit_type)

  return (
    <div className="group rounded-xl bg-white p-5 shadow-lg shadow-slate-200/60 ring-1 ring-slate-100 transition-all duration-200 hover:shadow-xl hover:shadow-slate-200/80 hover:ring-slate-200 hover:-translate-y-0.5 active:scale-[0.99]">
      {/* Top row: permit number + status badge */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold tracking-wide text-gray-400">
          {permit.permit_number}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${badge.classes}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Permit type */}
      <div className="mb-1 flex items-center gap-2">
        <span className="text-lg leading-none">{icon}</span>
        <h2 className="text-base font-semibold text-gray-800">
          {formatPermitType(permit.permit_type)}
        </h2>
      </div>

      {/* Work description — truncated */}
      <p className="mb-3 line-clamp-2 text-sm text-gray-500">
        {permit.work_description}
      </p>

      {/* Footer row: location + date */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-50 pt-3 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span>📍</span>
          {permit.location}
        </span>
        <span className="flex items-center gap-1">
          <span>🕐</span>
          {formatDate(permit.planned_start)}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Permit Dashboard Page
// ---------------------------------------------------------------------------

function PermitDashboard() {
  const [permits, setPermits] = useState<Permit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const fetchPermits = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/permits`, {
          signal: controller.signal,
        })
        if (!res.ok) {
          throw new Error(`Server responded with ${res.status} ${res.statusText}`)
        }
        const json = (await res.json()) as { permits: Permit[] }
        setPermits(json.permits)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError((err as Error).message ?? 'An unexpected error occurred.')
      } finally {
        setLoading(false)
      }
    }

    void fetchPermits()

    // Cleanup: cancel the in-flight request if component unmounts
    return () => controller.abort()
  }, [])

  return (
    <div className="min-h-screen pb-20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/80 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-blue-500">
              Permit to Work
            </p>
            <h1 className="text-xl font-bold text-gray-900">Permit Dashboard</h1>
          </div>
          <Link
            to="/create"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
          >
            <span className="text-base leading-none">+</span>
            <span>New Permit</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-2xl px-4 py-5">
        {/* Prominent Mobile-Friendly Banner Button */}
        <div className="mb-6">
          <Link
            to="/create"
            className="flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white shadow-md transition hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-2xl">
                🔥
              </div>
              <div className="text-left">
                <p className="text-base font-bold">Create New Permit</p>
                <p className="text-xs text-blue-100">Hot Work safety authorization</p>
              </div>
            </div>
            <span className="rounded-xl bg-white/20 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
              Start &rarr;
            </span>
          </Link>
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="rounded-2xl bg-red-50 p-5 ring-1 ring-red-100">
            <p className="mb-1 font-semibold text-red-700">Failed to load permits</p>
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 active:scale-95"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && permits.length === 0 && (
          <div className="rounded-xl bg-white py-16 text-center shadow-lg shadow-slate-200/60 ring-1 ring-slate-100">
            <p className="text-5xl">📋</p>
            <p className="mt-4 font-semibold text-slate-700">No permits yet</p>
            <p className="mt-1 text-sm text-slate-400">
              Create your first permit via the button above to see it here.
            </p>
          </div>
        )}

        {/* Permit list */}
        {!loading && !error && permits.length > 0 && (
          <>
            <p className="mb-3 text-sm text-gray-400">
              {permits.length} permit{permits.length !== 1 ? 's' : ''} found
            </p>
            <div className="space-y-3">
              {permits.map((permit) => (
                <PermitCard key={permit.id} permit={permit} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root App with React Router
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 to-white px-4 py-8">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PermitDashboard />} />
          <Route path="/create" element={<CreatePermitForm />} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}