declare module 'xlsx' {
  export function read(data: ArrayBuffer | Uint8Array, opts?: { type?: string }): WorkBook
  export interface WorkBook {
    SheetNames: string[]
    Sheets: Record<string, WorkSheet>
  }
  export interface WorkSheet {
    ['!ref']?: string
    [cell: string]: unknown
  }
  export const utils: {
    sheet_to_json<T = unknown>(
      worksheet: WorkSheet,
      opts?: { header?: number | string[]; range?: number | string; defval?: unknown }
    ): T[]
  }
}
