// ─────────────────────────────────────────────────────────────────────────────
// Vector PDF renderer
//
// Draws a ReportDocument straight onto an A4 page using jsPDF's text and vector
// primitives. Nothing is rasterised, so the output is selectable, searchable,
// crisp at any zoom, and a fraction of the size of a screenshot export.
//
// The layout engine measures every row before it draws it, so a row is never
// sliced in half by a page break. Table headers repeat on continuation pages
// and total rows always stay attached to their table.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  PdfCell,
  PdfColumn,
  PdfRow,
  PdfTableSection,
  ReportDocument,
} from './reportModel';

// ── Page geometry (all millimetres) ──────────────────────────────────────────

const PAGE_W = 210;
const PAGE_H = 297;

const MARGIN = { top: 16, right: 16, bottom: 14, left: 16 };
const FOOTER_BAND = 12;

const CONTENT_LEFT = MARGIN.left;
const CONTENT_RIGHT = PAGE_W - MARGIN.right;
const CONTENT_W = CONTENT_RIGHT - CONTENT_LEFT;
const CONTENT_BOTTOM = PAGE_H - MARGIN.bottom - FOOTER_BAND;

// ── Palette ──────────────────────────────────────────────────────────────────

type RGB = [number, number, number];

const C = {
  brand: [26, 47, 168] as RGB, // #1A2FA8
  ink: [26, 26, 46] as RGB, // #1A1A2E
  body: [45, 48, 68] as RGB,
  muted: [128, 134, 156] as RGB,
  hairline: [226, 229, 238] as RGB,
  zebra: [247, 248, 251] as RGB,
  headBg: [26, 26, 46] as RGB,
  white: [255, 255, 255] as RGB,
  totalBg: [236, 243, 237] as RGB,
  warnBg: [255, 246, 235] as RGB,
  warnInk: [176, 84, 8] as RGB,
  negInk: [193, 42, 42] as RGB,
  tagBg: [232, 240, 254] as RGB,
};

// ── Type scale (points) ──────────────────────────────────────────────────────

const T = {
  eyebrow: 7.2,
  masthead: 19,
  metaLabel: 6.2,
  metaValue: 8.4,
  sectionTitle: 10.5,
  sectionSub: 7.4,
  tableHead: 6.9,
  body: 8.6,
  note: 6.9,
  tag: 6.2,
  runHead: 7.2,
  footer: 7.2,
};

const PT_TO_MM = 25.4 / 72;
const lineHeight = (pt: number, factor = 1.28) => pt * PT_TO_MM * factor;

// ── Table metrics ────────────────────────────────────────────────────────────

const CELL_PAD_X = 2.6;
const CELL_PAD_Y = 2.3;
const MIN_ROW_H = 7.6;
const HEAD_ROW_H = 8.4;

// ─────────────────────────────────────────────────────────────────────────────
// Currency safety
//
// jsPDF's built-in fonts are WinAnsi encoded, which has no glyph for ₦, ₵, ₹ and
// friends — they'd render as garbage. Since the app lets people type the
// currency freely, fall back to the ISO code for anything outside Latin-1.
// ─────────────────────────────────────────────────────────────────────────────

const SYMBOL_TO_CODE: Record<string, string> = {
  '€': 'EUR',
  '₦': 'NGN',
  '₵': 'GHS',
  '₹': 'INR',
  '₱': 'PHP',
  '₩': 'KRW',
  '₪': 'ILS',
  '₫': 'VND',
  '₴': 'UAH',
  '₸': 'KZT',
  '₽': 'RUB',
  '₺': 'TRY',
  '฿': 'THB',
  '₡': 'CRC',
  '₲': 'PYG',
  '₭': 'LAK',
  '₮': 'MNT',
};

export function safeCurrency(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return '';
  const mapped = s.replace(
    /[^\x00-\xFF]/g,
    (ch) => SYMBOL_TO_CODE[ch] ?? '',
  );
  return mapped.trim() || 'CUR';
}

/** Strip any remaining non-Latin-1 characters so nothing renders as tofu. */
function latin1(s: string): string {
  return String(s ?? '').replace(/[^\x00-\xFF]/g, (ch) => {
    if (SYMBOL_TO_CODE[ch]) return SYMBOL_TO_CODE[ch];
    if (ch === '–' || ch === '—' || ch === '−') return '-';
    if (ch === '’' || ch === '‘') return "'";
    if (ch === '“' || ch === '”') return '"';
    if (ch === '…') return '...';
    if (ch === '→') return '->';
    if (ch === '⚠') return '!';
    return '';
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderer
// ─────────────────────────────────────────────────────────────────────────────

type Doc = any; // jsPDF instance — typed loosely to avoid a hard import

class ReportRenderer {
  private doc: Doc;
  private y = MARGIN.top;
  private docModel: ReportDocument;

  constructor(doc: Doc, model: ReportDocument) {
    this.doc = doc;
    this.docModel = model;
  }

  // ── low-level text helper ──────────────────────────────────────────────────

  private text(
    str: string,
    x: number,
    y: number,
    opts: {
      size?: number;
      style?: 'normal' | 'bold' | 'italic';
      color?: RGB;
      align?: 'left' | 'right';
      charSpace?: number;
      right?: number;
    } = {},
  ) {
    const {
      size = T.body,
      style = 'normal',
      color = C.body,
      align = 'left',
      charSpace = 0,
      right,
    } = opts;

    const d = this.doc;
    d.setFont('helvetica', style);
    d.setFontSize(size);
    d.setTextColor(color[0], color[1], color[2]);

    const clean = latin1(str);

    if (align === 'right' && right !== undefined) {
      // Compute the width ourselves: jsPDF's own right-align ignores charSpace.
      const w = d.getTextWidth(clean) + charSpace * Math.max(0, clean.length - 1);
      d.text(clean, right - w, y, { baseline: 'top', charSpace });
    } else {
      d.text(clean, x, y, { baseline: 'top', charSpace });
    }
  }

  private measureText(str: string, size: number, style: 'normal' | 'bold') {
    const d = this.doc;
    d.setFont('helvetica', style);
    d.setFontSize(size);
    return d.getTextWidth(latin1(str));
  }

  private wrap(str: string, maxW: number, size: number, style: 'normal' | 'bold'): string[] {
    const d = this.doc;
    d.setFont('helvetica', style);
    d.setFontSize(size);
    const out = d.splitTextToSize(latin1(str), maxW);
    return Array.isArray(out) ? out : [out];
  }

  private fill(x: number, y: number, w: number, h: number, color: RGB) {
    const d = this.doc;
    d.setFillColor(color[0], color[1], color[2]);
    d.rect(x, y, w, h, 'F');
  }

  private rule(x1: number, y1: number, x2: number, color: RGB, weight = 0.2) {
    const d = this.doc;
    d.setDrawColor(color[0], color[1], color[2]);
    d.setLineWidth(weight);
    d.line(x1, y1, x2, y1);
  }

  // ── page furniture ─────────────────────────────────────────────────────────

  private newPage() {
    this.doc.addPage();
    this.y = MARGIN.top;
    this.drawRunningHeader();
  }

  private drawRunningHeader() {
    const m = this.docModel;
    this.text(m.businessName, CONTENT_LEFT, this.y, {
      size: T.runHead,
      style: 'bold',
      color: C.muted,
    });
    this.text(`${m.documentTitle} - ${m.periodLabel}`, 0, this.y, {
      size: T.runHead,
      color: C.muted,
      align: 'right',
      right: CONTENT_RIGHT,
    });
    this.y += lineHeight(T.runHead) + 2.2;
    this.rule(CONTENT_LEFT, this.y, CONTENT_RIGHT, C.hairline, 0.2);
    this.y += 6;
  }

  /** Drawn last, once the total page count is known. */
  private drawFooters() {
    const d = this.doc;
    const total = d.getNumberOfPages();
    const m = this.docModel;
    const y = PAGE_H - MARGIN.bottom - 5;

    for (let p = 1; p <= total; p++) {
      d.setPage(p);
      this.rule(CONTENT_LEFT, y - 3, CONTENT_RIGHT, C.hairline, 0.2);
      this.text(`${m.businessName} - ${m.documentTitle}`, CONTENT_LEFT, y, {
        size: T.footer,
        color: C.muted,
      });
      this.text(`Page ${p} of ${total}`, 0, y, {
        size: T.footer,
        color: C.muted,
        align: 'right',
        right: CONTENT_RIGHT,
      });
    }
  }

  // ── masthead ───────────────────────────────────────────────────────────────

  private drawMasthead() {
    const m = this.docModel;

    this.text(m.documentTitle.toUpperCase(), CONTENT_LEFT, this.y, {
      size: T.eyebrow,
      style: 'bold',
      color: C.muted,
      charSpace: 0.55,
    });
    this.y += lineHeight(T.eyebrow) + 1.6;

    this.text(m.businessName || 'Report', CONTENT_LEFT, this.y, {
      size: T.masthead,
      style: 'bold',
      color: C.brand,
    });
    this.y += lineHeight(T.masthead) + 2.4;

    this.rule(CONTENT_LEFT, this.y, CONTENT_RIGHT, C.brand, 0.7);
    this.y += 5;

    // Meta strip — small uppercase labels above their values, evenly spaced.
    const items = m.meta.filter((i) => i.value);
    if (items.length) {
      const colW = CONTENT_W / items.length;
      const labelY = this.y;
      const valueY = this.y + lineHeight(T.metaLabel) + 0.6;

      items.forEach((item, i) => {
        const x = CONTENT_LEFT + colW * i;
        this.text(item.label.toUpperCase(), x, labelY, {
          size: T.metaLabel,
          style: 'bold',
          color: C.muted,
          charSpace: 0.4,
        });
        const lines = this.wrap(item.value, colW - 3, T.metaValue, 'normal');
        lines.slice(0, 2).forEach((ln, li) => {
          this.text(ln, x, valueY + li * lineHeight(T.metaValue), {
            size: T.metaValue,
            style: 'bold',
            color: C.ink,
          });
        });
      });

      this.y = valueY + lineHeight(T.metaValue) * 2 + 1;
      this.rule(CONTENT_LEFT, this.y, CONTENT_RIGHT, C.hairline, 0.2);
      this.y += 8;
    }
  }

  // ── table measurement ──────────────────────────────────────────────────────

  private colWidths(columns: PdfColumn[]): number[] {
    const sum = columns.reduce((s, c) => s + c.width, 0) || 1;
    return columns.map((c) => (c.width / sum) * CONTENT_W);
  }

  private rowHeight(row: PdfRow, columns: PdfColumn[], widths: number[]): number {
    let tallest = 0;
    row.cells.forEach((cell, i) => {
      const w = (widths[i] ?? CONTENT_W) - CELL_PAD_X * 2;
      const bold = row.variant === 'total';
      const tagW = cell.tag ? this.measureText(cell.tag, T.tag, 'bold') + 4 : 0;
      const lines = this.wrap(cell.text, Math.max(6, w - tagW), T.body, bold ? 'bold' : 'normal');
      let h = lines.length * lineHeight(T.body);
      if (cell.note) {
        const noteLines = this.wrap(cell.note, Math.max(6, w), T.note, 'normal');
        h += noteLines.length * lineHeight(T.note) + 0.6;
      }
      tallest = Math.max(tallest, h);
    });
    return Math.max(MIN_ROW_H, tallest + CELL_PAD_Y * 2);
  }

  // ── table drawing ──────────────────────────────────────────────────────────

  /** Caption shown above a table header that has spilled onto a new page. */
  private drawContinuationCaption(title: string) {
    this.text(`${title} (continued)`, CONTENT_LEFT, this.y, {
      size: T.sectionSub,
      style: 'bold',
      color: C.muted,
    });
    this.y += lineHeight(T.sectionSub) + 2.4;
  }

  private drawTableHead(columns: PdfColumn[], widths: number[]) {
    const y = this.y;
    this.fill(CONTENT_LEFT, y, CONTENT_W, HEAD_ROW_H, C.headBg);

    let x = CONTENT_LEFT;
    columns.forEach((col, i) => {
      const w = widths[i];
      const label = col.header.toUpperCase();
      const ty = y + (HEAD_ROW_H - lineHeight(T.tableHead)) / 2;
      if (col.align === 'right') {
        this.text(label, 0, ty, {
          size: T.tableHead,
          style: 'bold',
          color: C.white,
          charSpace: 0.35,
          align: 'right',
          right: x + w - CELL_PAD_X,
        });
      } else {
        this.text(label, x + CELL_PAD_X, ty, {
          size: T.tableHead,
          style: 'bold',
          color: C.white,
          charSpace: 0.35,
        });
      }
      x += w;
    });

    this.y += HEAD_ROW_H;
  }

  private drawRow(
    row: PdfRow,
    columns: PdfColumn[],
    widths: number[],
    height: number,
    zebra: boolean,
  ) {
    const y = this.y;
    const variant = row.variant ?? 'default';

    // Background
    if (variant === 'total') this.fill(CONTENT_LEFT, y, CONTENT_W, height, C.totalBg);
    else if (variant === 'outstanding') this.fill(CONTENT_LEFT, y, CONTENT_W, height, C.warnBg);
    else if (zebra) this.fill(CONTENT_LEFT, y, CONTENT_W, height, C.zebra);

    // Rule above total rows
    if (variant === 'total') this.rule(CONTENT_LEFT, y, CONTENT_RIGHT, C.ink, 0.45);

    const inkFor: RGB =
      variant === 'outstanding' ? C.warnInk : variant === 'negative' ? C.negInk : C.ink;
    const bold = variant === 'total';

    let x = CONTENT_LEFT;
    columns.forEach((col, i) => {
      const cell: PdfCell = row.cells[i] ?? { text: '' };
      const w = widths[i];
      const inner = w - CELL_PAD_X * 2;
      const tagW = cell.tag ? this.measureText(cell.tag, T.tag, 'bold') + 4 : 0;
      const lines = this.wrap(
        cell.text,
        Math.max(6, inner - tagW),
        T.body,
        bold ? 'bold' : 'normal',
      );
      let ty = y + CELL_PAD_Y;

      lines.forEach((ln, li) => {
        if (col.align === 'right') {
          this.text(ln, 0, ty, {
            size: T.body,
            style: bold ? 'bold' : 'normal',
            color: inkFor,
            align: 'right',
            right: x + w - CELL_PAD_X,
          });
        } else {
          this.text(ln, x + CELL_PAD_X, ty, {
            size: T.body,
            style: bold ? 'bold' : 'normal',
            color: inkFor,
          });
          // Tag pill sits after the first line only
          if (li === 0 && cell.tag) {
            const lw = this.measureText(ln, T.body, bold ? 'bold' : 'normal');
            const px = x + CELL_PAD_X + lw + 1.8;
            const pw = this.measureText(cell.tag, T.tag, 'bold') + 2.6;
            const ph = lineHeight(T.tag) + 1;
            this.doc.setFillColor(C.tagBg[0], C.tagBg[1], C.tagBg[2]);
            this.doc.roundedRect(px, ty - 0.3, pw, ph, 0.7, 0.7, 'F');
            this.text(cell.tag, px + 1.3, ty + 0.2, {
              size: T.tag,
              style: 'bold',
              color: C.brand,
            });
          }
        }
        ty += lineHeight(T.body);
      });

      if (cell.note) {
        this.wrap(cell.note, inner, T.note, 'normal').forEach((ln) => {
          this.text(ln, x + CELL_PAD_X, ty + 0.4, {
            size: T.note,
            color: C.muted,
          });
          ty += lineHeight(T.note);
        });
      }

      x += w;
    });

    // Hairline under every body row
    if (variant !== 'total') {
      this.rule(CONTENT_LEFT, y + height, CONTENT_RIGHT, C.hairline, 0.2);
    }

    this.y += height;
  }

  private drawTable(section: PdfTableSection) {
    const widths = this.colWidths(section.columns);

    // Keep the title with its header and at least one row — no orphaned headings.
    const titleH =
      lineHeight(T.sectionTitle) +
      (section.subtitle ? lineHeight(T.sectionSub) + 0.8 : 0) +
      3.2;
    const firstRow = section.rows[0] ?? section.footer?.[0];
    const firstRowH = firstRow ? this.rowHeight(firstRow, section.columns, widths) : MIN_ROW_H;

    if (this.y + titleH + HEAD_ROW_H + firstRowH > CONTENT_BOTTOM) this.newPage();

    // Section heading
    this.text(section.title, CONTENT_LEFT, this.y, {
      size: T.sectionTitle,
      style: 'bold',
      color: C.ink,
    });
    this.y += lineHeight(T.sectionTitle);
    if (section.subtitle) {
      this.text(section.subtitle, CONTENT_LEFT, this.y, {
        size: T.sectionSub,
        color: C.muted,
      });
      this.y += lineHeight(T.sectionSub) + 0.8;
    }
    this.y += 3.2;

    this.drawTableHead(section.columns, widths);

    const continueOnNewPage = () => {
      this.newPage();
      this.drawContinuationCaption(section.title);
      this.drawTableHead(section.columns, widths);
    };

    // Body rows — measured individually, never split across a page.
    section.rows.forEach((row, i) => {
      const h = this.rowHeight(row, section.columns, widths);
      if (this.y + h > CONTENT_BOTTOM) continueOnNewPage();
      this.drawRow(row, section.columns, widths, h, i % 2 === 1);
    });

    // Footer rows travel as one block so a total never lands alone on a page.
    const footer = section.footer ?? [];
    if (footer.length) {
      const heights = footer.map((r) => this.rowHeight(r, section.columns, widths));
      const blockH = heights.reduce((s, h) => s + h, 0);
      if (this.y + blockH > CONTENT_BOTTOM) continueOnNewPage();
      footer.forEach((row, i) => {
        this.drawRow(row, section.columns, widths, heights[i], false);
      });
    }

    this.y += 9;
  }

  // ── entry point ────────────────────────────────────────────────────────────

  render() {
    const m = this.docModel;
    this.drawMasthead();

    m.sections.forEach((section) => {
      if (section.kind === 'rule') {
        if (this.y + 10 > CONTENT_BOTTOM) return; // a rule alone never justifies a page
        this.y += 1;
        this.rule(CONTENT_LEFT, this.y, CONTENT_RIGHT, C.hairline, 0.2);
        this.y += 8;
        return;
      }

      if (section.kind === 'note') {
        const lines = this.wrap(section.text, CONTENT_W, T.body, 'normal');
        const h = lines.length * lineHeight(T.body) + 8;
        if (this.y + h > CONTENT_BOTTOM) this.newPage();
        lines.forEach((ln) => {
          this.text(ln, CONTENT_LEFT, this.y, { size: T.body, color: C.muted });
          this.y += lineHeight(T.body);
        });
        this.y += 8;
        return;
      }

      this.drawTable(section);
    });

    this.drawFooters();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function drawReport(doc: Doc, model: ReportDocument) {
  doc.setProperties({
    title: `${model.businessName} - ${model.documentTitle} (${model.periodLabel})`,
    subject: `${model.documentTitle} for ${model.periodLabel}`,
    author: model.businessName,
    creator: model.businessName,
  });
  new ReportRenderer(doc, model).render();
}

/** Builds the PDF in the browser and triggers the download. */
export async function downloadReportPdf(model: ReportDocument, filename: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  drawReport(doc, model);
  doc.save(filename);
}
