import { jsPDF } from 'jspdf'
import { BRAND_ADDRESS, BRAND_EN, BRAND_PHONE_DISPLAY, BRAND_PRIMARY_PHONE_DISPLAY } from './brand'
import { LOGO_BASE64 } from './logoBase64'
import { formatCurrency } from './retail'
import { formatPaymentLabel } from './payments'
import type { AdvanceOrder } from '../services/advanceOrderService'
import { formatPhoneDisplay } from './phone'
import { printHtmlDocument } from './printHtml'

const esc = (value: string) => value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] || char))

// jsPDF's built-in Helvetica font does not include the ₹ Unicode glyph (U+20B9).
// Using the Intl formatter directly causes the ₹ character to render as "1" or a
// replacement box in PDF viewers. This PDF-safe formatter outputs "Rs." instead.
const pdfMoney = (value: number): string => {
  const formatted = formatCurrency(value)
  // Replace leading ₹ (with optional non-breaking space) with "Rs. "
  return formatted.replace(/^[₹\u20b9]\s*/, 'Rs. ')
}

export function advanceReceiptPdf(order: AdvanceOrder) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setFillColor('#111111'); doc.rect(0, 0, 210, 5, 'F')
  try { doc.addImage(LOGO_BASE64, 'PNG', 16, 9, 16, 16) } catch (_err) { /* ignore missing logo */ }
  doc.setTextColor('#111111'); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(BRAND_EN.toUpperCase(), 38, 20)
  doc.setTextColor('#6B7280'); doc.setFontSize(8); doc.text('ADVANCE RECEIPT - NOT A TAX INVOICE', 38, 26)

  doc.setFont('helvetica', 'normal'); doc.text(BRAND_ADDRESS, 194, 20, { align: 'right', maxWidth: 76 }); doc.text(BRAND_PRIMARY_PHONE_DISPLAY, 194, 30, { align: 'right' })
  doc.setDrawColor('#D4AF37'); doc.line(16, 38, 194, 38)
  doc.setTextColor('#1F1F1F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(order.deposit_id, 16, 51)
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor('#6B7280'); doc.text(`Created: ${new Date(order.created_at).toLocaleString('en-IN')}`, 194, 51, { align: 'right' })
  const rows = [
    ['Customer', order.customer_name], ['Phone', formatPhoneDisplay(order.phone)], ['Address', order.address || '-'], ['Product', order.product_name],
    ['Category', order.category || '-'], ['Expected delivery', new Date(`${order.expected_delivery_date}T00:00:00`).toLocaleDateString('en-IN')],
  ]
  let y = 66
  rows.forEach(([label, value]) => { doc.setFont('helvetica', 'bold'); doc.setTextColor('#6B7280'); doc.text(label.toUpperCase(), 16, y); doc.setFont('helvetica', 'normal'); doc.setTextColor('#1F1F1F'); doc.text(String(value), 64, y, { maxWidth: 126 }); y += 10 })
  y += 4; doc.setFillColor('#FBFAF6'); doc.roundedRect(16, y, 178, 42, 3, 3, 'F')
  const money = [[ 'Total order amount', order.total_amount ], [ 'Deposit paid', order.deposit_amount ], [ 'Remaining balance', order.remaining_balance ]] as const
  money.forEach(([label, value], index) => { const rowY = y + 11 + index * 11; doc.setFont('helvetica', index === 2 ? 'bold' : 'normal'); doc.setTextColor(index === 2 ? '#B48811' : '#374151'); doc.text(label, 22, rowY); doc.text(pdfMoney(value), 188, rowY, { align: 'right' }) })
  doc.setFont('helvetica', 'bold'); doc.setTextColor('#b45309'); doc.setFontSize(9); doc.text('This receipt records an advance payment only. It is not a final invoice.', 105, y + 55, { align: 'center' })
  return new File([doc.output('blob')], `Advance-Receipt-${order.deposit_id}.pdf`, { type: 'application/pdf' })
}

export function printAdvanceReceipt(order: AdvanceOrder) {
  try {
    const paymentLabel = order.final_payment_method
      ? (order.final_payment_method === 'upi' ? 'UPI / QR' : order.final_payment_method === 'split' ? formatPaymentLabel('split', order.split_details) : order.final_payment_method.toUpperCase())
      : ''
    const depositPayment = paymentLabel || 'Cash'

    const dateStr = (() => {
      try {
        return new Date(order.created_at).toLocaleString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      } catch {
        return new Date(order.created_at).toLocaleDateString('en-IN')
      }
    })()

    const formatCustomerPhone = (phone?: string): string => {
      if (!phone) return ''
      const trimmed = phone.trim()
      const digits = trimmed.replace(/\D/g, '')
      if (digits.length === 12 && digits.startsWith('91')) {
        return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
      }
      if (digits.length === 10) {
        return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
      }
      return trimmed
    }

    const html = `<!doctype html>
<html lang="en" data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" spellcheck="false">
<head>
  <meta charset="utf-8">
  <meta name="grammarly" content="off">
  <meta name="robots" content="noindex,nofollow">
  <title>Receipt - ${esc(order.deposit_id)}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    @media print { @page { size: 80mm auto; margin: 0; } }
    * { box-sizing: border-box; margin: 0; padding: 0; font-weight: normal !important; }
    body {
      font-family: 'Courier New', Courier, monospace, sans-serif;
      font-size: 11px;
      color: #000;
      font-weight: normal;
      margin: 0;
      padding: 3mm 4mm;
      width: 80mm;
      box-sizing: border-box;
      line-height: 1.3;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .border-bottom { border-bottom: 1px dashed #000; padding-bottom: 3px; margin-bottom: 3px; }
    .border-top { border-top: 1px dashed #000; padding-top: 3px; margin-top: 3px; }
    .row { display: flex; justify-content: space-between; gap: 4px; padding: 1px 0; }
    .row span:first-child { flex-shrink: 0; }
    .row span:last-child { text-align: right; }
  </style>
</head>
<body>
  <div class="text-center" style="margin-bottom: 3px;">
    <div style="font-size: 24px; line-height: 1; margin: 0 auto 2px auto; letter-spacing: 1px;">M</div>
    <div style="font-size: 13px; letter-spacing: 1px;">${esc(BRAND_EN).toUpperCase()}</div>
    <div style="font-size: 9px; color: #333; letter-spacing: 0.5px;">ADVANCE RECEIPT</div>
    <div style="font-size: 8.5px; margin-top: 1px; line-height: 1.2;">${esc(BRAND_ADDRESS)}</div>
    <div style="font-size: 9px; margin-top: 1px;">Ph: ${esc(BRAND_PHONE_DISPLAY)}</div>
  </div>

  <div class="border-top border-bottom" style="font-size: 10.5px;">
    <div class="row"><span>Rcpt: #${esc(order.deposit_id)}</span><span>${dateStr}</span></div>
    <div class="row"><span>Name: ${esc(order.customer_name)}</span><span>Tel: ${esc(formatCustomerPhone(order.phone))}</span></div>
    ${order.address ? `<div style="font-size: 9.5px; color: #333;">Addr: ${esc(order.address)}</div>` : ''}
  </div>

  <div class="border-bottom" style="font-size: 10.5px;">
    <div class="row"><span>Item:</span><span style="max-width: 75%; word-break: break-word;">${esc(order.product_name)}${order.category ? ` (${esc(order.category)})` : ''}</span></div>
    <div class="row"><span>Due: ${esc(new Date(`${order.expected_delivery_date}T00:00:00`).toLocaleDateString('en-IN'))}</span><span>Pay: ${esc(depositPayment)}</span></div>
  </div>

  <div class="border-bottom" style="font-size: 11px;">
    <div class="row"><span>Total Amount</span><span>${esc(formatCurrency(order.total_amount))}</span></div>
    <div class="row"><span>Deposit Paid</span><span>${esc(formatCurrency(order.deposit_amount))}</span></div>
    <div class="row" style="font-size: 12px;"><span>Balance Due</span><span>${esc(formatCurrency(order.remaining_balance))}</span></div>
  </div>

  <div class="text-center" style="font-size: 9.5px; margin-top: 3px;">
    <div>Advance payment record. Thank you!</div>
  </div>
</body>
</html>`

    printHtmlDocument(html)
  } catch (err) {
    console.warn('[advanceReceipt] Failed to print advance receipt:', err)
  }
}

export function downloadFile(file: File) { const url = URL.createObjectURL(file); const link = document.createElement('a'); link.href = url; link.download = file.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 500) }

