import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, ChevronDown, Trash2, Download } from 'lucide-react'
import { getHistory, clearHistory, getResultBlob, timeAgo, type HistoryEntry } from '../../lib/history'
import { downloadBlob } from '../../lib/utils'
import { cn } from '../../lib/utils'

export function HistoryPanel() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()

  const refresh = useCallback(() => {
    setEntries(getHistory())
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener('jet-history-update', refresh)
    return () => window.removeEventListener('jet-history-update', refresh)
  }, [refresh])

  if (entries.length === 0) return null

  const handleRedownload = (entry: HistoryEntry) => {
    const blob = getResultBlob(entry.id)
    if (blob) {
      downloadBlob(blob, entry.fileName)
    }
  }

  return (
    <div className="border-t border-zinc-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-3 py-2 text-[13px] text-zinc-600 hover:bg-zinc-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock size={14} />
          <span>History ({entries.length})</span>
        </div>
        <ChevronDown size={14} className={cn('transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="px-2 pb-2">
          <div className="flex justify-end mb-1">
            <button
              onClick={clearHistory}
              className="text-[10px] text-zinc-400 hover:text-red-500 flex items-center gap-0.5 transition-colors"
            >
              <Trash2 size={10} /> Clear
            </button>
          </div>
          <div className="max-h-52 overflow-y-auto space-y-0.5">
            {entries.map((entry) => {
              const hasBlob = !!getResultBlob(entry.id)
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer group"
                  onClick={() => navigate(entry.toolPath)}
                >
                  <img
                    src={entry.thumbnail}
                    alt=""
                    className="w-8 h-8 rounded object-cover bg-zinc-100 border border-zinc-200 shrink-0"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-zinc-700 truncate">{entry.fileName}</p>
                    <p className="text-[10px] text-zinc-400">
                      {entry.toolName} &middot; {timeAgo(entry.timestamp)}
                    </p>
                  </div>
                  {hasBlob && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRedownload(entry) }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-blue-600 transition-all"
                      title="Re-download"
                    >
                      <Download size={12} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
