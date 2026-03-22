import { useCallback, useRef, useState, type DragEvent } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '../../lib/utils'

interface FileDropzoneProps {
  onFiles: (files: File[]) => void
  accept?: string
  multiple?: boolean
  label?: string
  description?: string
  className?: string
  expanded?: boolean
}

export function FileDropzone({
  onFiles,
  accept,
  multiple = false,
  label = 'Drop files here or click to browse',
  description,
  className,
  expanded = false,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrag = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragIn = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragOut = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      const files = Array.from(e.dataTransfer.files)
      if (files.length) onFiles(multiple ? files : [files[0]])
    },
    [onFiles, multiple]
  )

  const handleClick = () => inputRef.current?.click()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length) onFiles(files)
    e.target.value = ''
  }

  return (
    <div
      onClick={handleClick}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={cn(
        'border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors',
        expanded ? 'p-12 min-h-[300px] flex items-center justify-center' : 'p-10',
        isDragging
          ? 'border-blue-400 bg-blue-50'
          : 'border-zinc-300 hover:border-zinc-400 bg-zinc-50/50',
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />
      <div className="flex flex-col items-center">
        <Upload className="mb-3 text-zinc-400" size={expanded ? 48 : 32} />
        <p className={cn('font-medium text-zinc-700', expanded ? 'text-base' : 'text-sm')}>{label}</p>
        {description && (
          <p className={cn('text-zinc-500 mt-1', expanded ? 'text-sm' : 'text-xs')}>{description}</p>
        )}
      </div>
    </div>
  )
}
