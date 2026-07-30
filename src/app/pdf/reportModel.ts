// ─────────────────────────────────────────────────────────────────────────────
// Report document model
//
// `generate()` in ReportTab builds one of these. Both the on-screen preview
// (HTML) and the exported PDF are rendered *from this model*, so the two can
// never drift apart. No layout information lives in here — only content.
// ─────────────────────────────────────────────────────────────────────────────

export type CellAlign = 'left' | 'right';

export interface PdfColumn {
  header: string;
  /** Share of the available content width, 0..1. Must sum to 1 across columns. */
  width: number;
  align?: CellAlign;
  /** Render values in a monospaced-feeling numeric style. */
  numeric?: boolean;
}

export interface PdfCell {
  text: string;
  /** Optional second line, set smaller and greyed — e.g. a transaction note. */
  note?: string;
  /** Optional small pill after the text — e.g. "BIZ". */
  tag?: string;
}

export type RowVariant =
  | 'default'
  | 'total'        // grand total: tinted, bold, ruled above
  | 'outstanding'  // amber: money still owed to us
  | 'negative';    // red: negative balance

export interface PdfRow {
  cells: PdfCell[];
  variant?: RowVariant;
}

export interface PdfTableSection {
  kind: 'table';
  title: string;
  subtitle?: string;
  columns: PdfColumn[];
  rows: PdfRow[];
  /** Total / summary rows, kept together and never split from the table. */
  footer?: PdfRow[];
}

export interface PdfNoteSection {
  kind: 'note';
  text: string;
}

export interface PdfRuleSection {
  kind: 'rule';
}

export type PdfSection = PdfTableSection | PdfNoteSection | PdfRuleSection;

export interface ReportMetaItem {
  label: string;
  value: string;
}

export interface ReportDocument {
  businessName: string;
  /** Eyebrow above the business name, e.g. "Financial Report". */
  documentTitle: string;
  /** Human date range, e.g. "01 Jul 26 – 30 Jul 26". */
  periodLabel: string;
  currency: string;
  /** Shown in the masthead strip: period, currency, filters, generated-at. */
  meta: ReportMetaItem[];
  sections: PdfSection[];
  generatedAt: Date;
}
