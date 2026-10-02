import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Info, Check, Trash2, Loader2 } from 'lucide-react'
import {
  type BarcodeSettings,
  type LabelSizeConfig,
  DEFAULT_LABEL_SIZES,
  getStoredCustomSizes,
  fetchLabelSizesFromDb,
  deleteLabelSizeFromDb,
  clearAllLabelSizesInDb,
  saveStoredBarcodeSettings,
} from '../../lib/barcode'
import { CreateCustomSizeModal } from './CreateCustomSizeModal'

interface BarcodeSettingsDrawerProps {
  isOpen: boolean
  onClose: () => void
  settings: BarcodeSettings
  onUpdateSettings: (newSettings: BarcodeSettings) => void
}

export const BarcodeSettingsDrawer: React.FC<BarcodeSettingsDrawerProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [customSizes, setCustomSizes] = useState<LabelSizeConfig[]>(getStoredCustomSizes())
  const [loading, setLoading] = useState(false)
  const [showCustomModal, setShowCustomModal] = useState(false)

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Prevent background scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Sync latest sizes from Supabase database when drawer opens
  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    fetchLabelSizesFromDb()
      .then((sizes) => {
        if (active) {
          setCustomSizes(sizes)
        }
      })
      .catch((err) => console.error('Failed to load sizes from Supabase:', err))
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [isOpen])

  const allSizes = [...DEFAULT_LABEL_SIZES, ...customSizes]

  // Auto-select first available size if current selected size is missing or invalid
  useEffect(() => {
    if (allSizes.length > 0 && !allSizes.some((s) => s.id === settings.selectedSizeId)) {
      handleSizeChange(allSizes[0].id)
    }
  }, [allSizes, settings.selectedSizeId])

  if (!isOpen) return null

  const handlePrinterChange = (type: 'label' | 'regular') => {
    const updated: BarcodeSettings = { ...settings, printerType: type }
    saveStoredBarcodeSettings(updated)
    onUpdateSettings(updated)
  }

  const handleSizeChange = (sizeId: string) => {
    const updated: BarcodeSettings = { ...settings, selectedSizeId: sizeId }
    saveStoredBarcodeSettings(updated)
    onUpdateSettings(updated)
  }

  const handleDeleteCustomSize = async (sizeId: string) => {
    const updatedCustom = customSizes.filter((s) => s.id !== sizeId)
    setCustomSizes(updatedCustom)
    if (settings.selectedSizeId === sizeId) {
      handleSizeChange(updatedCustom[0]?.id || '')
    }
    await deleteLabelSizeFromDb(sizeId)
  }

  const handleClearAll = async () => {
    if (window.confirm('Delete all saved barcode sizes from the database? You can then add your sizes manually.')) {
      setCustomSizes([])
      handleSizeChange('')
      await clearAllLabelSizesInDb()
    }
  }

  const handleFieldToggle = (
    field: 'showSalePrice' | 'showCompanyName' | 'showItemName' | 'showDiscount'
  ) => {
    const updated: BarcodeSettings = { ...settings, [field]: !settings[field] }
    saveStoredBarcodeSettings(updated)
    onUpdateSettings(updated)
  }

  return (
    <>
      {createPortal(
        <div 
          className="fixed inset-x-0 top-0 z-[9999] flex justify-end overflow-hidden"
          style={{ height: '100dvh', maxHeight: '100dvh' }}
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs -z-10" onClick={onClose} />
          <div className="relative z-10 w-full max-w-sm bg-white h-full max-h-[100dvh] shadow-2xl flex flex-col border-l border-gray-200 animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div 
              className="modal-header-safe flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#0B2559] text-white shrink-0"
              style={{ paddingTop: 'max(14px, calc(env(safe-area-inset-top, 0px) + 8px))' }}
            >
            <h3 className="text-sm font-black tracking-wide text-white">Barcode Settings</h3>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-6">
            {/* Section 1: Printer */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-gray-800">
                  Printer
                </span>
                <span className="text-[10px] text-gray-400 font-bold italic">
                  Select any 1 option
                </span>
              </div>
              <div className="space-y-2 bg-[#FBFAF6] p-3 rounded-xl border border-gray-200">
                <label className="flex items-center gap-2.5 text-xs font-bold text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="printerType"
                    checked={settings.printerType === 'label'}
                    onChange={() => handlePrinterChange('label')}
                    className="accent-[#0B2559] w-4 h-4 cursor-pointer"
                  />
                  Label Printer (Thermal)
                </label>
                <label className="flex items-center gap-2.5 text-xs font-bold text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="printerType"
                    checked={settings.printerType === 'regular'}
                    onChange={() => handlePrinterChange('regular')}
                    className="accent-[#0B2559] w-4 h-4 cursor-pointer"
                  />
                  Regular Printer (A4 Sheet)
                </label>
              </div>
            </div>

            {/* Section 2: Size */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-gray-800">
                    Size
                  </span>
                  {loading && <Loader2 size={12} className="animate-spin text-blue-600" />}
                  <span className="text-[10px] text-gray-400 font-bold italic">
                    Select any 1 option
                  </span>
                </div>
                {allSizes.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>
              <div className="space-y-2.5 bg-[#FBFAF6] p-3 rounded-xl border border-gray-200">
                {allSizes.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-xs font-bold text-gray-600">No barcode sizes recorded</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Click &ldquo;Add Custom Size&rdquo; below to record your physical label roll dimensions manually.</p>
                  </div>
                ) : (
                  allSizes.map((size) => (
                    <div
                      key={size.id}
                      className="flex items-center justify-between gap-2 text-xs font-bold text-gray-700 hover:text-black"
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                        <input
                          type="radio"
                          name="labelSize"
                          checked={settings.selectedSizeId === size.id}
                          onChange={() => handleSizeChange(size.id)}
                          className="accent-[#0B2559] w-4 h-4 cursor-pointer shrink-0"
                        />
                        <span className="truncate">{size.name}</span>
                      </label>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {size.isCustom && (
                          <span className="text-[9px] font-black uppercase tracking-wider bg-[#0B2559] text-[#D4AF37] px-1.5 py-0.5 rounded">
                            Custom
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteCustomSize(size.id)
                          }}
                          className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                          title={`Delete ${size.name}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}

                <button
                  type="button"
                  onClick={() => setShowCustomModal(true)}
                  className="mt-2 flex items-center gap-1.5 text-xs font-black text-blue-600 hover:text-blue-800 hover:underline pt-2 border-t border-gray-200 w-full cursor-pointer"
                >
                  <Plus size={13} />
                  Add Custom Size <Info size={12} className="text-gray-400" />
                </button>
              </div>
            </div>

            {/* Section 3: Additional Fields */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-gray-800">
                  Additional Fields
                </span>
              </div>
              <div className="space-y-2.5 bg-[#FBFAF6] p-3 rounded-xl border border-gray-200">
                <label className="flex items-center gap-2.5 text-xs font-bold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showSalePrice}
                    onChange={() => handleFieldToggle('showSalePrice')}
                    className="accent-[#0B2559] w-4 h-4 rounded cursor-pointer"
                  />
                  Sale Price (₹)
                </label>
                <label className="flex items-center gap-2.5 text-xs font-bold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showCompanyName}
                    onChange={() => handleFieldToggle('showCompanyName')}
                    className="accent-[#0B2559] w-4 h-4 rounded cursor-pointer"
                  />
                  Company Name (Madhura Tex)
                </label>
                <label className="flex items-center gap-2.5 text-xs font-bold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showItemName}
                    onChange={() => handleFieldToggle('showItemName')}
                    className="accent-[#0B2559] w-4 h-4 rounded cursor-pointer"
                  />
                  Item Name
                </label>
                <label className="flex items-center gap-2.5 text-xs font-bold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showDiscount}
                    onChange={() => handleFieldToggle('showDiscount')}
                    className="accent-[#0B2559] w-4 h-4 rounded cursor-pointer"
                  />
                  Discount / MRP
                </label>
              </div>
            </div>
          </div>

          {/* Drawer Footer */}
          <div 
            className="modal-footer-safe p-3 sm:p-4 border-t border-gray-200 bg-white shrink-0"
            style={{ paddingBottom: 'max(14px, calc(env(safe-area-inset-bottom, 0px) + 12px))' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-[#0B2559] text-[#D4AF37] border border-[#D4AF37] font-black text-xs uppercase tracking-wider hover:bg-[#123E94] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Check size={14} /> Done
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

      {showCustomModal && (
        <CreateCustomSizeModal
          isOpen={showCustomModal}
          onClose={() => setShowCustomModal(false)}
          onCreated={(newSize) => {
            setCustomSizes(getStoredCustomSizes())
            handleSizeChange(newSize.id)
          }}
        />
      )}
    </>
  )
}
