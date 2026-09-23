import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const TEST_REQUESTER_ID = '6936c864-7040-40e9-8811-082a764f8402';

const HOT_WORK_OPTIONS = [
  { value: 'welding', label: 'Welding' },
  { value: 'cutting', label: 'Cutting / Burning' },
  { value: 'grinding', label: 'Grinding' },
  { value: 'brazing', label: 'Brazing / Soldering' },
  { value: 'open_flame', label: 'Open Flame' },
  { value: 'other', label: 'Other Hot Work' },
];

export default function CreatePermitForm() {
  const navigate = useNavigate();

  // Helper to format ISO datetime-local strings
  const now = new Date();
  const later = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const toLocalISO = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [workDescription, setWorkDescription] = useState('');
  const [location, setLocation] = useState('');
  const [hotWorkType, setHotWorkType] = useState('welding');
  const [fireWatchName, setFireWatchName] = useState('');
  const [plannedStart, setPlannedStart] = useState(toLocalISO(now));
  const [plannedEnd, setPlannedEnd] = useState(toLocalISO(later));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      permit_type: 'hot_work',
      requester_id: TEST_REQUESTER_ID,
      work_description: workDescription.trim(),
      location: location.trim(),
      planned_start: new Date(plannedStart).toISOString(),
      planned_end: new Date(plannedEnd).toISOString(),
      hot_work_type: hotWorkType,
      fire_watch_required: Boolean(fireWatchName.trim()),
      fire_watch_name: fireWatchName.trim() || undefined,
      fire_blanket_used: true,
      flammable_gas_cleared: true,
    };

    try {
      const response = await fetch(`http://${window.location.hostname}:3000/api/permits/hot-work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      // Navigate back to dashboard on success
      navigate('/');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while creating the permit.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/80 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
              New Application
            </p>
            <h1 className="text-xl font-bold text-gray-900">Create Hot Work Permit</h1>
          </div>
          <Link
            to="/"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
          >
            Cancel
          </Link>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="mx-auto max-w-2xl px-4 py-6">
        {error && (
          <div className="mb-6 rounded-2xl bg-red-50 p-4 ring-1 ring-red-200">
            <div className="flex items-start gap-2">
              <span className="text-lg">⚠️</span>
              <div>
                <h3 className="text-sm font-semibold text-red-800">Submission Error</h3>
                <p className="mt-0.5 text-xs text-red-600">{error}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card: Work Details */}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <span>📍</span> General Details
            </h2>

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-xs font-medium text-gray-600 mb-1">
                Work Location *
              </label>
              <input
                id="location"
                type="text"
                required
                placeholder="e.g. Plant Area B - Boiler Room"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            {/* Work Description */}
            <div>
              <label htmlFor="work_description" className="block text-xs font-medium text-gray-600 mb-1">
                Description of Work *
              </label>
              <textarea
                id="work_description"
                required
                rows={3}
                placeholder="Describe the tasks, tools to be used, and equipment involved..."
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          {/* Card: Hot Work Specifics */}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <span>🔥</span> Hot Work Specifications
            </h2>

            {/* Hot Work Type Select */}
            <div>
              <label htmlFor="hot_work_type" className="block text-xs font-medium text-gray-600 mb-1">
                Hot Work Classification *
              </label>
              <select
                id="hot_work_type"
                value={hotWorkType}
                onChange={(e) => setHotWorkType(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                {HOT_WORK_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Fire Watch Personnel */}
            <div>
              <label htmlFor="fire_watch_name" className="block text-xs font-medium text-gray-600 mb-1">
                Designated Fire Watch Attendant
              </label>
              <input
                id="fire_watch_name"
                type="text"
                placeholder="e.g. John Doe (HSE Certified)"
                value={fireWatchName}
                onChange={(e) => setFireWatchName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
              <p className="mt-1 text-xs text-gray-400">
                Leaving this populated will automatically designate a required fire watch.
              </p>
            </div>
          </div>

          {/* Card: Schedule */}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <span>⏱️</span> Schedule Times
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="planned_start" className="block text-xs font-medium text-gray-600 mb-1">
                  Planned Start *
                </label>
                <input
                  id="planned_start"
                  type="datetime-local"
                  required
                  value={plannedStart}
                  onChange={(e) => setPlannedStart(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label htmlFor="planned_end" className="block text-xs font-medium text-gray-600 mb-1">
                  Planned End *
                </label>
                <input
                  id="planned_end"
                  type="datetime-local"
                  required
                  value={plannedEnd}
                  onChange={(e) => setPlannedEnd(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-amber-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Submitting Permit...</span>
                </>
              ) : (
                <>
                  <span>🔥</span>
                  <span>Submit Hot Work Permit</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
