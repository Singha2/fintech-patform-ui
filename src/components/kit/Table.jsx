export default function Table({ columns = [], rows = [] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-gray-400 text-sm">
        No data yet
      </div>
    )
  }

  return (
    <>
      {/* Mobile: stacked cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((row, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-sm">
            {columns.map((col) => (
              <div key={col.key} className="flex items-start justify-between gap-2 py-1.5 border-b border-gray-100 last:border-0">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-shrink-0 w-28">
                  {col.label}
                </span>
                <span className="text-gray-700 text-right">
                  {col.render ? col.render(row) : (row[col.key] ?? '—')}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Desktop: normal table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-gray-700">
                    {col.render ? col.render(row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
