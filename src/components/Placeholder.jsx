export default function Placeholder({ id, name, persona }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-96 gap-4 text-center">
      <div className="w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center">
        <span className="text-2xl font-bold text-indigo-600">{id}</span>
      </div>
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{name}</h2>
        <p className="mt-1 text-sm text-gray-500">{persona}</p>
      </div>
      <p className="text-xs text-gray-400 italic mt-2">Screen placeholder — content coming in Steps 2–5</p>
    </div>
  )
}
