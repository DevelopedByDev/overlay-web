/**
 * GFM pipe tables are strict: many models (including smaller OSS weights) emit rows without
 * pipes, or break bullets/lines across rows, which breaks the renderer. Keep in sync with
 * post-processing in `markdown-table-fix.ts`.
 */
export const TABLE_FORMAT_INSTRUCTION = [
  'Markdown tables (GitHub-Flavored / pipe syntax) — follow exactly or do not use a table:',
  '- Header row: every cell is between pipes, e.g. | Rank | Country | GDP |.',
  '- Next row must be a separator with the same number of cells, e.g. | --- | --- | --- |.',
  '- Every following data row must use the same pipe structure: start with |, end with |, same number of | cells as the header.',
  '- Do not start a line with • - * or a number list inside a table unless that entire line is still a full pipe row. Wrong: a line with only “• High-value …” and no leading | — that breaks the table.',
  '- Do not press Enter for a new line inside a table cell. GFM does not support multiline cells that way — the next line becomes a broken row. Put extra lines in the same cell on one pipe-row using <br /> between phrases.',
  '- Multiple bullets or factor lines in one table cell belong on one row: separate items with <br /> inside the cell, e.g. | Drivers | • a <br /> • b <br /> factor c |.',
  '- If a cell needs long text, keep it on one pipe-row; use <br /> for line breaks inside the cell. Do not let stray lines fall outside the pipe grid.',
  '- Prefer fewer, wider columns over a 7+ column table that will wrap badly; put extra detail in a bullet list below the table if needed.',
].join('\n')
