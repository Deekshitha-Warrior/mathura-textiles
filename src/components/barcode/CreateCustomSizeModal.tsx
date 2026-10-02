import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Info, Loader2 } from 'lucide-react'
import { type LabelSizeConfig, createLabelSizeInDb, getAllLabelSizes } from '../../lib/barcode'

interface CreateCustomSizeModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (newSize: LabelSizeConfig) => void
}

export const CreateCustomSizeModal: React.FC<CreateCustomSizeModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('')
  const [labelsPerRow, setLabelsPerRow] = useState<number>(1)
  const [widthMm, setWidthMm] = useState<string>('50')
  const [heightMm, setHeightMm] = useState<string>('38')
  const [horizontalGapMm, setHorizontalGapMm] = useState<string>('2')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Close on Escape key & lock body scrolling when open
  useEffect(() => {
    if (!isOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Please enter a custom size name')
      return
    }

    const allExisting = getAllLabelSizes()
    const duplicate = allExisting.find(
      s => s.name.trim().toLowerCase() === trimmedName.toLowerCase()
    )
    if (duplicate) {
      setError(`A label size with the name "${trimmedName}" already exists. Please choose a distinct name.`)
      return
    }

    const w = parseFloat(widthMm)
    const h = parseFloat(heightMm)
    const g = parseFloat(horizontalGapMm) || 0

    if (isNaN(w) || w <= 0 || isNaN(h) || h <= 0) {
      setError('Please enter valid width and height dimensions in mm')
      return
    }

    const duplicateDim = allExisting.find(
      s => s.widthMm === w && s.heightMm === h && s.labelsPerRow === labelsPerRow
    )
    if (duplicateDim) {
      setError(`A label size with dimensions ${w} × ${h} mm (${labelsPerRow} per row) already exists: "${duplicateDim.name}".`)
      return
    }

    setSubmitting(true)
    try {
      const newSizeConfig = await createLabelSizeInDb({
        name: trimmedName,
        labelsPerRow,
        widthMm: w,
        heightMm: h,
        horizontalGapMm: g,
        isCustom: true,
      })

      onCreated(newSizeConfig)
      onClose()
    } catch (err: any) {
      console.error('Failed to create custom size in DB:', err)
      if (
        err?.message?.includes('duplicate key') ||
        err?.message?.includes('unique constraint') ||
        err?.code === '23505'
      ) {
        setError(`A label size with name "${trimmedName}" already exists in Supabase.`)
      } else {
        setError(err?.message || 'Failed to save label size to database.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const numWidth = parseFloat(widthMm) || 50
  const numHeight = parseFloat(heightMm) || 25
  const numGap = parseFloat(horizontalGapMm) || 2

  return createPortal(
    <div 
      className="mobile-modal-overlay p-0 sm:p-4 animate-in fade-in duration-150"
      style={{ height: '100dvh', maxHeight: '100dvh' }}
    >
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm -z-10" onClick={onClose} />
      <div className="mobile-modal-card relative z-10 bg-white rounded-none sm:rounded-2xl max-w-2xl border-0 sm:border border-[#E5E7EB] shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header - fixed top */}
        <div 
          className="modal-header-safe flex items-center justify-between px-4 py-3 sm:px-6 sm:py-3.5 border-b border-gray-200 bg-[#0B2559] text-white shrink-0"
          style={{ paddingTop: 'max(14px, calc(env(safe-area-inset-top, 0px) + 8px))' }}
        >
          <h3 className="text-base font-black tracking-wide text-white">Create Custom Size</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Scrollable form body */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6">
            {/* Info banner */}
            <div className="mb-3.5 flex items-start gap-2.5 rounded-xl bg-blue-50/80 border border-blue-200 px-3.5 py-2 text-xs text-blue-900 font-semibold">
              <Info size={15} className="text-blue-600 shrink-0 mt-0.5" />
              <span>For best results in generic flow, configure labels in Printer Settings as well</span>
            </div>

            {error && (
              <div className="mb-3.5 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2 text-xs font-bold text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              {/* Left Column: Form inputs */}
              <div className="space-y-2.5">
                <div>
                  <label htmlFor="custom-size-name" className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
                    Custom Size Name
                  </label>
                  <input
                    id="custom-size-name"
                    name="customSizeName"
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. custom 50x38"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-gray-300 bg-[#FBFAF6] text-xs font-bold text-gray-900 outline-none focus:border-[#0B2559] focus:bg-white"
                  />
                </div>

                <div>
                  <label htmlFor="custom-size-labels-per-row" className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
                    Labels Per Row
                  </label>
                  <select
                    id="custom-size-labels-per-row"
                    name="labelsPerRow"
                    value={labelsPerRow}
                    onChange={(e) => setLabelsPerRow(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-xl border border-gray-300 bg-[#FBFAF6] text-xs font-bold text-gray-900 outline-none focus:border-[#0B2559] focus:bg-white"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="custom-size-width" className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
                    Label Width (mm)
                  </label>
                  <input
                    id="custom-size-width"
                    name="widthMm"
                    type="number"
                    step="0.1"
                    required
                    placeholder="50"
                    value={widthMm}
                    onChange={(e) => setWidthMm(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-gray-300 bg-[#FBFAF6] text-xs font-bold text-gray-900 outline-none focus:border-[#0B2559] focus:bg-white"
                  />
                </div>

                <div>
                  <label htmlFor="custom-size-height" className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
                    Label Height (mm)
                  </label>
                  <input
                    id="custom-size-height"
                    name="heightMm"
                    type="number"
                    step="0.1"
                    required
                    placeholder="38"
                    value={heightMm}
                    onChange={(e) => setHeightMm(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-gray-300 bg-[#FBFAF6] text-xs font-bold text-gray-900 outline-none focus:border-[#0B2559] focus:bg-white"
                  />
                </div>

                <div>
                  <label htmlFor="custom-size-gap" className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
                    Horizontal Gap (mm)
                  </label>
                  <input
                    id="custom-size-gap"
                    name="horizontalGapMm"
                    type="number"
                    step="0.1"
                    placeholder="2"
                    value={horizontalGapMm}
                    onChange={(e) => setHorizontalGapMm(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-gray-300 bg-[#FBFAF6] text-xs font-bold text-gray-900 outline-none focus:border-[#0B2559] focus:bg-white"
                  />
                  <p className="mt-1 text-[10px] text-gray-500 font-medium">
                    ℹ Use 0 when label size is configured in printer settings
                  </p>
                </div>
              </div>

              {/* Right Column: Visual Interactive Preview matching screenshot */}
              <div className="flex flex-col items-center justify-center h-full">
                <span className="text-[11px] font-black uppercase tracking-wider text-gray-600 mb-2">
                  Preview ({labelsPerRow})
                </span>
                <div className="w-full min-h-[190px] rounded-2xl bg-[#FFF9E6] border border-[#E2E8F0] p-4 flex items-center justify-center relative shadow-inner overflow-hidden">
                  {/* Labels Layout */}
                  <div className="flex items-center justify-center gap-3">
                    {Array.from({ length: labelsPerRow }).map((_, idx) => (
                      <div
                        key={idx}
                        className="bg-white rounded-xl border border-gray-300 p-2.5 shadow-md flex flex-col items-center justify-center text-center relative"
                        style={{
                          width: labelsPerRow === 1 ? '150px' : labelsPerRow === 2 ? '105px' : '80px',
                          height: '120px',
                        }}
                      >
                        {/* Dimension Indicators on first label */}
                        {idx === 0 && (
                          <>
                            <span className="absolute -left-2 top-1/2 -translate-y-1/2 -rotate-90 bg-gray-600 text-white text-[8px] font-bold px-1 rounded shadow">
                              {numHeight}mm
                            </span>
                            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 bg-gray-600 text-white text-[8px] font-bold px-1 rounded shadow">
                              {numWidth}mm
                            </span>
                          </>
                        )}
                        <span className="text-[9px] font-black text-gray-700 tracking-wider">Header</span>
                        {/* Mini Barcode lines */}
                        <div className="my-1 flex items-center gap-[1.5px] h-6 px-1">
                          <div className="w-[1.5px] h-full bg-black" />
                          <div className="w-[1px] h-full bg-black" />
                          <div className="w-[2.5px] h-full bg-black" />
                          <div className="w-[1px] h-full bg-black" />
                          <div className="w-[2px] h-full bg-black" />
                          <div className="w-[1px] h-full bg-black" />
                          <div className="w-[3px] h-full bg-black" />
                          <div className="w-[1px] h-full bg-black" />
                          <div className="w-[2px] h-full bg-black" />
                          <div className="w-[1px] h-full bg-black" />
                        </div>
                        <span className="text-[8px] font-mono font-bold text-gray-600">Item Code</span>
                        <span className="text-[8px] text-gray-500 font-medium">Line 1</span>
                        <span className="text-[8px] text-gray-500 font-medium">Line 2</span>
                      </div>
                    ))}
                  </div>

                  {labelsPerRow > 1 && numGap > 0 && (
                    <span className="absolute top-3 right-3 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                      Gap: {numGap}mm
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Action - fixed at bottom of modal */}
          <div 
            className="modal-footer-safe flex items-center justify-end gap-3 border-t border-gray-200 px-4 py-3 sm:px-6 sm:py-3.5 bg-gray-50/80 shrink-0"
            style={{ paddingBottom: 'max(12px, calc(env(safe-area-inset-bottom, 0px) + 10px))' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 sm:px-6 py-2 rounded-xl bg-[#0B2559] border border-[#D4AF37] text-[#D4AF37] text-xs font-black uppercase tracking-wider hover:bg-[#123E94] transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting && <Loader2 size={13} className="animate-spin" />}
              {submitting ? 'Saving...' : 'Save Custom Size'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

