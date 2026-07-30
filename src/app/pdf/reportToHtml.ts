// ─────────────────────────────────────────────────────────────────────────────
// HTML preview
//
// Renders the same ReportDocument the PDF renderer consumes, styled to match
// the exported page. What you see on screen is what lands in the PDF.
// ─────────────────────────────────────────────────────────────────────────────

import type { PdfRow, PdfTableSection, ReportDocument } from './reportModel';

function esc(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rowHtml(row: PdfRow, section: PdfTableSection): string {
  const cls =
    row.variant === 'total'
      ? 'rp-total'
      : row.variant === 'outstanding'
        ? 'rp-outstanding'
        : row.variant === 'negative'
          ? 'rp-negative'
          : '';

  const cells = section.columns
    .map((col, i) => {
      const cell = row.cells[i] ?? { text: '' };
      const align = col.align === 'right' ? ' style="text-align:right"' : '';
      const tag = cell.tag ? `<span class="rp-tag">${esc(cell.tag)}</span>` : '';
      const note = cell.note ? `<span class="rp-note">${esc(cell.note)}</span>` : '';
      return `<td${align}>${esc(cell.text)}${tag}${note}</td>`;
    })
    .join('');

  return `<tr class="${cls}">${cells}</tr>`;
}

function tableHtml(section: PdfTableSection): string {
  const heads = section.columns
    .map(
      (c) =>
        `<th style="width:${(c.width * 100).toFixed(1)}%;${c.align === 'right' ? 'text-align:right' : ''}">${esc(c.header)}</th>`,
    )
    .join('');

  const body = section.rows.map((r) => rowHtml(r, section)).join('');
  const foot = (section.footer ?? []).map((r) => rowHtml(r, section)).join('');

  return `<div class="rp-section">
    <div class="rp-section-title">${esc(section.title)}</div>
    ${section.subtitle ? `<div class="rp-section-sub">${esc(section.subtitle)}</div>` : ''}
    <table class="rp-table">
      <thead><tr>${heads}</tr></thead>
      <tbody>${body}</tbody>
      ${foot ? `<tfoot>${foot}</tfoot>` : ''}
    </table>
  </div>`;
}

export function reportToHtml(model: ReportDocument): string {
  const meta = model.meta
    .filter((m) => m.value)
    .map(
      (m) =>
        `<div class="rp-meta-item"><div class="rp-meta-label">${esc(m.label)}</div><div class="rp-meta-value">${esc(m.value)}</div></div>`,
    )
    .join('');

  const masthead = `<div class="rp-masthead">
    <div class="rp-eyebrow">${esc(model.documentTitle)}</div>
    <div class="rp-business">${esc(model.businessName || 'Report')}</div>
    <div class="rp-brandrule"></div>
    ${meta ? `<div class="rp-meta">${meta}</div>` : ''}
  </div>`;

  const body = model.sections
    .map((s) => {
      if (s.kind === 'rule') return '<hr class="rp-divider">';
      if (s.kind === 'note') return `<div class="rp-empty">${esc(s.text)}</div>`;
      return tableHtml(s);
    })
    .join('');

  return masthead + body;
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — kept in sync with the PDF palette and type scale.
// ─────────────────────────────────────────────────────────────────────────────

export const reportPreviewStyles = `
.rp-masthead { margin-bottom: 26px; }
.rp-eyebrow { font-size: 0.62rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #80869C; margin-bottom: 4px; }
.rp-business { font-size: 1.55rem; font-weight: 800; color: #1A2FA8; letter-spacing: -0.015em; line-height: 1.15; }
.rp-brandrule { height: 2.5px; background: #1A2FA8; margin: 8px 0 12px; }
.rp-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 10px; padding-bottom: 12px; border-bottom: 1px solid #E2E5EE; }
.rp-meta-label { font-size: 0.55rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #80869C; margin-bottom: 2px; }
.rp-meta-value { font-size: 0.74rem; font-weight: 700; color: #1A1A2E; }

.rp-section { margin-bottom: 26px; }
.rp-section-title { font-size: 0.95rem; font-weight: 800; color: #1A1A2E; letter-spacing: -0.01em; }
.rp-section-sub { font-size: 0.68rem; color: #80869C; margin: 2px 0 8px; font-weight: 500; }
.rp-divider { border: none; border-top: 1px solid #E2E5EE; margin: 26px 0; }
.rp-empty { text-align: center; padding: 40px 0; font-size: 0.82rem; color: #80869C; }

.rp-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; table-layout: fixed; }
.rp-table th { background: #1A1A2E; color: #fff; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; padding: 7px 8px; text-align: left; }
.rp-table td { padding: 7px 8px; border-bottom: 1px solid #E2E5EE; vertical-align: top; color: #1A1A2E; word-wrap: break-word; }
.rp-table tbody tr:nth-child(even) td { background: #F7F8FB; }
.rp-table tr.rp-total td { background: #ECF3ED; font-weight: 700; border-top: 1.5px solid #1A1A2E; border-bottom: none; }
.rp-table tr.rp-outstanding td { background: #FFF6EB; color: #B05408; }
.rp-table tr.rp-negative td { color: #C12A2A; }
.rp-note { display: block; font-size: 0.66rem; color: #80869C; margin-top: 1px; }
.rp-tag { display: inline-block; font-size: 0.58rem; font-weight: 800; background: #E8F0FE; color: #1A2FA8; border-radius: 3px; padding: 1px 5px; margin-left: 5px; vertical-align: 1px; }
`;
