/**
 * Universal PDF download and sharing utility.
 * Optimised for Desktop, Android, and iOS Safari / iPhone.
 *
 * Why iOS Safari shows `about:blank`:
 * 1. Opening `window.open('about:blank', '_blank')` synchronously and later trying to set
 *    `location.href = blobUrl` causes Safari to block cross-window navigation after asynchronous
 *    rendering (html2canvas / jsPDF), leaving a frozen blank white tab showing "about:blank".
 * 2. On iOS Safari, simulated anchor `.click()` downloads on `blob:` URLs often fail silently.
 * 3. Navigating to a `blob:` URL across tabs in iOS Safari triggers popup/script restrictions.
 *
 * Solution:
 * - On iOS / Apple devices with Web Share API support:
 *   Use `navigator.share({ files: [file], title: file.name })`.
 *   This invokes the native iOS share sheet ("Save to Files", "AirDrop", "Print", etc.)
 *   with zero about:blank popups and zero failed downloads.
 * - If user cancels the iOS share sheet, we exit gracefully.
 * - Fallback for iOS if Web Share is unsupported or fails:
 *   Navigate the CURRENT window directly (`window.location.href = url`), opening iOS's native PDF preview.
 * - On Desktop / Android: standard hidden anchor tag with download attribute.
 */
export async function downloadPdfFile(file: File): Promise<void> {
  const isIOS =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

  // 1. Mobile Web Share API with File support (Primary for iPhone / Safari / iPad)
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: file.name,
        })
        return
      }
    } catch (err: unknown) {
      // If user dismissed / cancelled iOS share sheet, return silently
      if ((err as Error)?.name === 'AbortError') {
        return
      }
      console.warn('Share API error, trying download fallback:', err)
    }
  }

  // 2. Blob URL creation
  const url = URL.createObjectURL(file)

  // 3. Fallback for iOS when Web Share is unsupported or failed:
  // Navigate current window directly — NEVER open about:blank!
  if (isIOS) {
    window.location.href = url
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    return
  }

  // 4. Desktop & Android Chrome fallback: hidden anchor download
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()

  setTimeout(() => {
    try {
      if (document.body.contains(link)) {
        document.body.removeChild(link)
      }
      URL.revokeObjectURL(url)
    } catch {
      // Ignore cleanup error
    }
  }, 2000)
}
