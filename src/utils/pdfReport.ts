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

// Colores de Marca Pollo Crispy (Rojo #c0392b y Amarillo/Dorado #f59e0b)
const RED_PRIMARY: [number, number, number] = [192, 57, 43]    // #c0392b - Rojo Principal
const YELLOW_ACCENT: [number, number, number] = [245, 158, 11] // #f59e0b - Amarillo/Dorado
const SOFT_RED_BG: [number, number, number] = [254, 242, 242]  // #fef2f2 - Fondo Fila Alterna (Rojo suave)
const SOFT_YELLOW_BG: [number, number, number] = [254, 243, 199] // #fef3c7 - Fondo Caja Resumen (Amarillo suave)

/**
 * Genera un PDF horizontal profesional para reportes de Pollo Crispy con colores Rojo y Amarillo.
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

  const logoData = await loadLogoAsDataUrl()

  const drawHeader = (pageNum: number, totalPages: number) => {
    // Encabezado Rojo
    doc.setFillColor(RED_PRIMARY[0], RED_PRIMARY[1], RED_PRIMARY[2])
    doc.rect(0, 0, PAGE_W, 28, 'F')

    // Franja Amarilla decorativa inferior
    doc.setFillColor(YELLOW_ACCENT[0], YELLOW_ACCENT[1], YELLOW_ACCENT[2])
    doc.rect(0, 27, PAGE_W, 1.5, 'F')

    // Logo
    if (logoData) {
      try { doc.addImage(logoData, 'PNG', MARGIN, 4, 20, 20) } catch { /* ignore */ }
    }

    // Nombre del negocio (Blanco)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('POLLO CRISPY', MARGIN + (logoData ? 24 : 0), 14)

    // Subtítulo (Amarillo Claro)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(254, 243, 199)
    doc.text(header.title, MARGIN + (logoData ? 24 : 0), 21)

    // Información derecha
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
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

    // Pie de página con línea roja
    doc.setDrawColor(RED_PRIMARY[0], RED_PRIMARY[1], RED_PRIMARY[2])
    doc.setLineWidth(0.5)
    doc.line(MARGIN, PAGE_H - 10, PAGE_W - MARGIN, PAGE_H - 10)
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text('Pollo Crispy — Sistema POS', MARGIN, PAGE_H - 5)

    doc.setTextColor(30, 30, 30)
  }

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
      fillColor: RED_PRIMARY,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: SOFT_RED_BG,
    },
    columnStyles: colStyles,
    didDrawPage: () => {
      drawHeader(doc.getCurrentPageInfo().pageNumber, 1)
    },
    showHead: 'everyPage',
  }

  autoTable(doc, tableOptions)

  // Sección de Resumen
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

    // Caja de resumen Amarilla con borde Rojo
    doc.setFillColor(SOFT_YELLOW_BG[0], SOFT_YELLOW_BG[1], SOFT_YELLOW_BG[2])
    doc.setDrawColor(RED_PRIMARY[0], RED_PRIMARY[1], RED_PRIMARY[2])
    doc.setLineWidth(0.5)
    doc.roundedRect(MARGIN, currentY - 5, CONTENT_W, summary.length * 7 + 12, 3, 3, 'FD')

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(RED_PRIMARY[0], RED_PRIMARY[1], RED_PRIMARY[2])
    doc.text('RESUMEN DEL REPORTE', MARGIN + 5, currentY + 2)

    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    summary.forEach((row, idx) => {
      const y = currentY + 9 + idx * 7
      doc.setFont('helvetica', row.bold ? 'bold' : 'normal')
      if (row.bold) {
        doc.setTextColor(RED_PRIMARY[0], RED_PRIMARY[1], RED_PRIMARY[2])
      } else {
        doc.setTextColor(30, 30, 30)
      }
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

  const today = new Date()
  const dateTag = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`
  const defaultFilename = `Reporte_${header.title.replace(/\s+/g, '_')}_${dateTag}.pdf`
  doc.save(filename || defaultFilename)
}

/**
 * Abre el PDF en una ventana nueva para impresión directa con colores Rojo y Amarillo.
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
    doc.setFillColor(RED_PRIMARY[0], RED_PRIMARY[1], RED_PRIMARY[2])
    doc.rect(0, 0, PAGE_W, 28, 'F')

    doc.setFillColor(YELLOW_ACCENT[0], YELLOW_ACCENT[1], YELLOW_ACCENT[2])
    doc.rect(0, 27, PAGE_W, 1.5, 'F')

    if (logoData) {
      try { doc.addImage(logoData, 'PNG', MARGIN, 4, 20, 20) } catch { /* ignore */ }
    }
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('POLLO CRISPY', MARGIN + (logoData ? 24 : 0), 14)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(254, 243, 199)
    doc.text(header.title, MARGIN + (logoData ? 24 : 0), 21)

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    const rightX = PAGE_W - MARGIN
    doc.text(`Generado: ${nowStr()}`, rightX, 9, { align: 'right' })
    if (header.startDate || header.endDate) {
      doc.text(`Período: ${formatDateStr(header.startDate)} — ${formatDateStr(header.endDate)}`, rightX, 15, { align: 'right' })
    }
    if (header.branchName) {
      doc.text(`Sucursal: ${header.branchName}`, rightX, 21, { align: 'right' })
    }

    doc.setDrawColor(RED_PRIMARY[0], RED_PRIMARY[1], RED_PRIMARY[2])
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
    headStyles: { fillColor: RED_PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: SOFT_RED_BG },
    columnStyles: colStyles,
    didDrawPage: () => drawHeader(doc.getCurrentPageInfo().pageNumber, 1),
    showHead: 'everyPage',
  })

  if (summary && summary.length > 0) {
    const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || 150
    const currentY = Math.min(finalY + 10, PAGE_H - 60)
    doc.setFillColor(SOFT_YELLOW_BG[0], SOFT_YELLOW_BG[1], SOFT_YELLOW_BG[2])
    doc.setDrawColor(RED_PRIMARY[0], RED_PRIMARY[1], RED_PRIMARY[2])
    doc.roundedRect(MARGIN, currentY - 5, CONTENT_W, summary.length * 7 + 12, 3, 3, 'FD')
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(RED_PRIMARY[0], RED_PRIMARY[1], RED_PRIMARY[2])
    doc.text('RESUMEN DEL REPORTE', MARGIN + 5, currentY + 2)
    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    summary.forEach((row, idx) => {
      const y = currentY + 9 + idx * 7
      doc.setFont('helvetica', row.bold ? 'bold' : 'normal')
      if (row.bold) {
        doc.setTextColor(RED_PRIMARY[0], RED_PRIMARY[1], RED_PRIMARY[2])
      } else {
        doc.setTextColor(30, 30, 30)
      }
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
