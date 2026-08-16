import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AutoTableOptions = Record<string, any>

interface ReportHeader {
  title: string
  subtitle?: string
  startDate?: string
  endDate?: string
  branchName?: string
}

interface TableColumn {
  header: string
  dataKey: string
  width?: number
  align?: 'left' | 'center' | 'right'
}

interface SummaryRow {
  label: string
  value: string
  bold?: boolean
}

/**
 * Carga el logo de Pollo Crispy como Data URL para usarlo en jsPDF.
 * Funciona tanto en desarrollo (Vite dev server) como en producción.
 */
async function loadLogoAsDataUrl(): Promise<string | null> {
  try {
    const response = await fetch('/LogoCrispyBueno.png')
    if (!response.ok) return null
    const blob = await response.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function formatDateStr(dateStr?: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function nowStr() {
  const now = new Date()
  return now.toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + now.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

/**
 * Genera un PDF horizontal profesional para reportes de Pollo Crispy.
 */
export async function generateReport(
  header: ReportHeader,
  columns: TableColumn[],
  rows: Record<string, string | number>[],
  summary?: SummaryRow[],
  filename?: string
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const PAGE_W = doc.internal.pageSize.getWidth()   // 297mm
  const PAGE_H = doc.internal.pageSize.getHeight()  // 210mm
  const MARGIN = 15
  const CONTENT_W = PAGE_W - MARGIN * 2

  // ── Cargar logo ──────────────────────────────────────────────
  const logoData = await loadLogoAsDataUrl()

  // ── Función para dibujar encabezado en cada página ──────────
  const drawHeader = (pageNum: number, totalPages: number) => {
    // Fondo naranja en el encabezado
    doc.setFillColor(234, 88, 12)   // orange-600
    doc.rect(0, 0, PAGE_W, 28, 'F')

    // Logo
    if (logoData) {
      try { doc.addImage(logoData, 'PNG', MARGIN, 4, 20, 20) } catch { /* ignore */ }
    }

    // Nombre del negocio
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('POLLO CRISPY', MARGIN + (logoData ? 24 : 0), 14)

    // Subtítulo (nombre del reporte)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(header.title, MARGIN + (logoData ? 24 : 0), 20)

    // Información derecha
    doc.setFontSize(8)
    const rightX = PAGE_W - MARGIN
    doc.text(`Generado: ${nowStr()}`, rightX, 9, { align: 'right' })
    if (header.startDate || header.endDate) {
      const rangeText = `Período: ${formatDateStr(header.startDate)} — ${formatDateStr(header.endDate)}`
      doc.text(rangeText, rightX, 15, { align: 'right' })
    }
    if (header.branchName) {
      doc.text(`Sucursal: ${header.branchName}`, rightX, 21, { align: 'right' })
    }

    // Número de página — esquina inferior derecha
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(8)
    doc.text(`Página ${pageNum} de ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 5, { align: 'right' })

    // Pie de página
    doc.setDrawColor(234, 88, 12)
    doc.setLineWidth(0.5)
    doc.line(MARGIN, PAGE_H - 10, PAGE_W - MARGIN, PAGE_H - 10)
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text('Pollo Crispy — Sistema POS', MARGIN, PAGE_H - 5)

    // Restaurar color de texto
    doc.setTextColor(30, 30, 30)
  }

  // ── Preparar columnas y filas para autoTable ─────────────────
  const tableColumns = columns.map(c => ({
    header: c.header,
    dataKey: c.dataKey,
  }))

  const tableBody = rows.map(row =>
    columns.reduce((acc, col) => {
      const val = row[col.dataKey]
      acc[col.dataKey] = val !== undefined && val !== null ? String(val) : '—'
      return acc
    }, {} as Record<string, string>)
  )

  // Calcular ancho de cada columna
  const colStyles: Record<string, { halign?: 'left' | 'center' | 'right'; cellWidth?: number }> = {}
  const totalSpecified = columns.reduce((s, c) => s + (c.width || 0), 0)
  const autoWidth = totalSpecified > 0
    ? undefined
    : Math.floor(CONTENT_W / columns.length)

  columns.forEach((col) => {
    colStyles[col.dataKey] = {
      halign: col.align || 'left',
      ...(col.width ? { cellWidth: col.width } : autoWidth ? { cellWidth: autoWidth } : {}),
    }
  })

  // ── Generar tabla ────────────────────────────────────────────
  const tableOptions: AutoTableOptions = {
    columns: tableColumns,
    body: tableBody,
    startY: 35,
    margin: { left: MARGIN, right: MARGIN, top: 35, bottom: 18 },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [229, 231, 235],
      lineWidth: 0.3,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [234, 88, 12],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [255, 247, 237],
    },
    columnStyles: colStyles,
    didDrawPage: () => {
      // Page number will be corrected in the post-processing loop below
      drawHeader(doc.getCurrentPageInfo().pageNumber, 1)
    },
    showHead: 'everyPage',
  }

  autoTable(doc, tableOptions)

  // ── Sección de resumen ───────────────────────────────────────
  if (summary && summary.length > 0) {
    const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || 150

    const summaryY = finalY + 10
    if (summaryY + summary.length * 7 + 20 > PAGE_H - 15) {
      doc.addPage()
      drawHeader(
        doc.getNumberOfPages(),
        doc.getNumberOfPages()
      )
    }

    const currentY = summaryY > PAGE_H - 60 ? 40 : summaryY

    // Caja de resumen
    doc.setFillColor(255, 247, 237)
    doc.setDrawColor(234, 88, 12)
    doc.setLineWidth(0.5)
    doc.roundedRect(MARGIN, currentY - 5, CONTENT_W, summary.length * 7 + 12, 3, 3, 'FD')

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(234, 88, 12)
    doc.text('RESUMEN', MARGIN + 5, currentY + 2)

    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    summary.forEach((row, idx) => {
      const y = currentY + 9 + idx * 7
      doc.setFont('helvetica', row.bold ? 'bold' : 'normal')
      doc.text(row.label, MARGIN + 5, y)
      doc.text(row.value, PAGE_W - MARGIN - 5, y, { align: 'right' })
    })
  }

  // ── Repasar todos los encabezados (para la paginación correcta) ──
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    // Re-dibujar número de página correcto
    doc.setFillColor(255, 255, 255)
    doc.rect(PAGE_W - MARGIN - 40, PAGE_H - 10, 45, 8, 'F')
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(8)
    doc.text(`Página ${i} de ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 5, { align: 'right' })
  }

  // ── Descargar ────────────────────────────────────────────────
  const today = new Date()
  const dateTag = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`
  const defaultFilename = `Reporte_${header.title.replace(/\s+/g, '_')}_${dateTag}.pdf`
  doc.save(filename || defaultFilename)
}

/**
 * Abre el PDF en una ventana nueva para impresión directa.
 */
export async function printReport(
  header: ReportHeader,
  columns: TableColumn[],
  rows: Record<string, string | number>[],
  summary?: SummaryRow[]
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const PAGE_W = doc.internal.pageSize.getWidth()
  const PAGE_H = doc.internal.pageSize.getHeight()
  const MARGIN = 15
  const CONTENT_W = PAGE_W - MARGIN * 2

  const logoData = await loadLogoAsDataUrl()

  const drawHeader = (pageNum: number, totalPages: number) => {
    doc.setFillColor(234, 88, 12)
    doc.rect(0, 0, PAGE_W, 28, 'F')
    if (logoData) {
      try { doc.addImage(logoData, 'PNG', MARGIN, 4, 20, 20) } catch { /* ignore */ }
    }
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('POLLO CRISPY', MARGIN + (logoData ? 24 : 0), 14)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(header.title, MARGIN + (logoData ? 24 : 0), 20)
    doc.setFontSize(8)
    const rightX = PAGE_W - MARGIN
    doc.text(`Generado: ${nowStr()}`, rightX, 9, { align: 'right' })
    if (header.startDate || header.endDate) {
      doc.text(`Período: ${formatDateStr(header.startDate)} — ${formatDateStr(header.endDate)}`, rightX, 15, { align: 'right' })
    }
    doc.setDrawColor(234, 88, 12)
    doc.setLineWidth(0.5)
    doc.line(MARGIN, PAGE_H - 10, PAGE_W - MARGIN, PAGE_H - 10)
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text('Pollo Crispy — Sistema POS', MARGIN, PAGE_H - 5)
    doc.text(`Página ${pageNum} de ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 5, { align: 'right' })
    doc.setTextColor(30, 30, 30)
  }

  const tableColumns = columns.map(c => ({ header: c.header, dataKey: c.dataKey }))
  const tableBody = rows.map(row =>
    columns.reduce((acc, col) => {
      acc[col.dataKey] = row[col.dataKey] !== undefined ? String(row[col.dataKey]) : '—'
      return acc
    }, {} as Record<string, string>)
  )

  const colStyles: Record<string, { halign?: 'left' | 'center' | 'right' }> = {}
  columns.forEach(col => { colStyles[col.dataKey] = { halign: col.align || 'left' } })

  autoTable(doc, {
    columns: tableColumns,
    body: tableBody,
    startY: 35,
    margin: { left: MARGIN, right: MARGIN, top: 35, bottom: 18 },
    styles: { fontSize: 8, cellPadding: 3, lineColor: [229, 231, 235], lineWidth: 0.3 },
    headStyles: { fillColor: [234, 88, 12], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [255, 247, 237] },
    columnStyles: colStyles,
    didDrawPage: () => drawHeader(doc.getCurrentPageInfo().pageNumber, 1),
    showHead: 'everyPage',
  })

  if (summary && summary.length > 0) {
    const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || 150
    const currentY = Math.min(finalY + 10, PAGE_H - 60)
    doc.setFillColor(255, 247, 237)
    doc.setDrawColor(234, 88, 12)
    doc.roundedRect(MARGIN, currentY - 5, CONTENT_W, summary.length * 7 + 12, 3, 3, 'FD')
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(234, 88, 12)
    doc.text('RESUMEN', MARGIN + 5, currentY + 2)
    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    summary.forEach((row, idx) => {
      const y = currentY + 9 + idx * 7
      doc.setFont('helvetica', row.bold ? 'bold' : 'normal')
      doc.text(row.label, MARGIN + 5, y)
      doc.text(row.value, PAGE_W - MARGIN - 5, y, { align: 'right' })
    })
  }

  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFillColor(255, 255, 255)
    doc.rect(PAGE_W - MARGIN - 40, PAGE_H - 10, 45, 8, 'F')
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(8)
    doc.text(`Página ${i} de ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 5, { align: 'right' })
  }

  // Imprimir directamente
  const blobUrl = URL.createObjectURL(doc.output('blob'))
  const win = window.open(blobUrl, '_blank')
  if (win) {
    win.onload = () => {
      setTimeout(() => {
        win.print()
      }, 500)
    }
  }
}
