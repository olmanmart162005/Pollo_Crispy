import * as XLSX from 'xlsx'

export interface ExcelColumn {
  header: string
  key: string
  width?: number
}

/**
 * Exporta datos a un archivo Excel (.xlsx) con nombre de archivo y hoja personalizada.
 */
export function exportToExcel(
  filename: string,
  sheetName: string,
  data: Record<string, any>[],
  columns?: ExcelColumn[]
) {
  let formattedData = data

  if (columns && columns.length > 0) {
    formattedData = data.map(item => {
      const row: Record<string, any> = {}
      columns.forEach(col => {
        row[col.header] = item[col.key] !== undefined && item[col.key] !== null ? item[col.key] : ''
      })
      return row
    })
  }

  const worksheet = XLSX.utils.json_to_sheet(formattedData)

  if (columns && columns.length > 0) {
    worksheet['!cols'] = columns.map(c => ({ wch: c.width || 18 }))
  }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31))

  const cleanFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  XLSX.writeFile(workbook, cleanFilename)
}
