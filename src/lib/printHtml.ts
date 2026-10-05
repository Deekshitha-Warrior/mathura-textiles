/**
 * Prints a standalone HTML document.
 *
 * On mobile devices (iOS Safari, Android Chrome, etc.), iframes and window.open
 * are unreliable: iOS Safari reloads or crashes when an iframe calls .print(),
 * and blocks window.open popups by default. Android Chrome prints zero-size iframes
 * as blank pages.
 *
 * For mobile / touch devices, we inject a dedicated print container directly into the
 * current document, styled with @media print to hide all other content, and call
 * window.print() synchronously within the active user-gesture event.
 *
 * On desktop, we continue using an isolated hidden iframe so no UI flicker occurs.
 */

function printInPage(html: string): void {
  // Remove any leftover print elements from previous prints
  const prevArea = document.getElementById('thermal-receipt-print-area')
  if (prevArea) prevArea.remove()
  const prevStyle = document.getElementById('thermal-receipt-print-style')
  if (prevStyle) prevStyle.remove()

  // Parse incoming HTML
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const bodyContent = doc.body.innerHTML

  let extractedStyles = ''
  doc.querySelectorAll('style').forEach(s => {
    if (s.textContent) {
      extractedStyles += s.textContent + '\n'
    }
  })

  // Create isolated print stylesheet
  const styleEl = document.createElement('style')
  styleEl.id = 'thermal-receipt-print-style'
  styleEl.textContent = `
    @media screen {
      #thermal-receipt-print-area {
        display: none !important;
        visibility: hidden !important;
        position: fixed !important;
        left: -9999px !important;
        top: -9999px !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    }
    @media print {
      @page {
        size: 80mm auto !important;
        margin: 0 !important;
      }
      html, body {
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body > *:not(#thermal-receipt-print-area) {
        display: none !important;
      }
      #thermal-receipt-print-area {
        display: block !important;
        visibility: visible !important;
        position: static !important;
        width: 80mm !important;
        max-width: 80mm !important;
        margin: 0 !important;
        padding: 4mm !important;
        background: #ffffff !important;
        color: #000000 !important;
        box-sizing: border-box !important;
      }
      ${extractedStyles}
    }
  `
  document.head.appendChild(styleEl)

  // Create print content element
  const printArea = document.createElement('div')
  printArea.id = 'thermal-receipt-print-area'
  printArea.innerHTML = bodyContent
  document.body.appendChild(printArea)

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    try {
      printArea.remove()
      styleEl.remove()
      window.removeEventListener('afterprint', cleanup)
    } catch {
      /* ignore cleanup error */
    }
  }

  window.addEventListener('afterprint', cleanup)

  // Must call window.print() synchronously inside the user gesture handler for iOS Safari
  try {
    window.focus()
    window.print()
  } catch (err) {
    console.warn('[printHtml] In-page print error:', err)
  } finally {
    // Fallback cleanup in case afterprint does not fire
    setTimeout(cleanup, 1000)
  }
}

export function printHtmlDocument(html: string): void {
  const isMobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  if (isMobile) {
    printInPage(html)
    return
  }

  // Desktop: use hidden iframe
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;'
  frame.setAttribute('aria-hidden', 'true')
  frame.setAttribute('tabindex', '-1')
  document.body.appendChild(frame)

  const doc = frame.contentWindow?.document
  if (!doc) {
    frame.remove()
    // Fallback to in-page if iframe document fails
    printInPage(html)
    return
  }
  doc.open()
  doc.write(html)
  doc.close()

  const cleanup = () => {
    try { frame.remove() } catch { /* ignore */ }
  }
  setTimeout(() => {
    try {
      if (frame.contentWindow) {
        frame.contentWindow.onafterprint = cleanup
        frame.contentWindow.focus()
        frame.contentWindow.print()
      }
    } catch (err) {
      console.warn('[printHtml] Print error:', err)
      cleanup()
      printInPage(html)
    } finally {
      setTimeout(cleanup, 2000)
    }
  }, 300)
}
