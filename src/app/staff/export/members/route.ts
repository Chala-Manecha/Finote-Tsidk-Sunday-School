import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import QRCode from 'qrcode';
import { getStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SCHOOL_NAME, isDeptCode, DEPT_NAME } from '@/lib/constants';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { EXPORT_TEMPLATES, cellsFor, type MemberFilters } from '@/lib/member-export';
import { loadMembers } from '@/lib/member-load';

export const runtime = 'nodejs';

/** Member export: Excel (.xlsx) or a ZIP of QR images. Posted from the member list's export window. */
export async function POST(req: Request) {
  const staff = await getStaff();
  if (!staff) return new Response('ፈቃድ የለዎትም።', { status: 401 });
  const fd = await req.formData();
  const g = (k: string) => String(fd.get(k) ?? '').trim();
  const format = g('format') === 'qr' ? 'qr' : 'xlsx';
  const scope = (['all', 'filtered', 'selected'] as const).find((x) => x === g('scope')) ?? 'filtered';
  const dept = isDeptCode(g('dept')) ? g('dept') : undefined;
  const filters: MemberFilters = { q: g('q') || undefined, status: g('status') || undefined, work: g('work') || undefined,
    group: g('group') || undefined, type: g('type') || undefined, inactive: g('inactive') || undefined };
  const ids = fd.getAll('ids').map(String);
  const cols = fd.getAll('cols').map(String);

  const supabase = await createClient();
  const [rows, { data: groups }] = await Promise.all([
    loadMembers(supabase, { scope, filters, dept, ids }),
    supabase.from('age_groups').select('code, name'),
  ]);
  const origin = new URL(req.url).origin;
  const ctx = { groupName: new Map((groups ?? []).map((x) => [x.code as string, x.name as string])), verifyBase: origin };
  const stamp = todayIsoAddis();
  const base = `members-${stamp}${dept ? `-${dept}` : ''}`;

  if (format === 'qr') {
    const zip = new JSZip();
    for (const m of rows) {
      const png = await QRCode.toBuffer(`${origin}/verify?c=${encodeURIComponent(m.reg_no)}`, { type: 'png', width: 600, margin: 2, errorCorrectionLevel: 'M' });
      const safe = `${m.reg_no.replace(/[^A-Za-z0-9-]/g, '')}_${m.full_name}`.replace(/[\\/:*?"<>|]/g, '').slice(0, 80);
      zip.file(`${safe}.png`, png);
    }
    const body = await zip.generateAsync({ type: 'uint8array' });
    return new Response(body as unknown as BodyInit, {
      headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${base}-qr.zip"` },
    });
  }

  const chosen = cols.length ? cols : EXPORT_TEMPLATES[0].cols;
  const { headers, body } = cellsFor(rows, chosen, ctx);
  const wb = new ExcelJS.Workbook();
  wb.creator = SCHOOL_NAME;
  const ws = wb.addWorksheet('አባላት', { views: [{ state: 'frozen', ySplit: 3 }] });
  const font = { name: 'Nyala', size: 12 };
  ws.mergeCells(1, 1, 1, Math.max(headers.length, 1));
  ws.getCell(1, 1).value = `${SCHOOL_NAME} — የአባላት ዝርዝር${dept ? ` (${DEPT_NAME[dept]})` : ''}`;
  ws.getCell(1, 1).font = { ...font, size: 15, bold: true, color: { argb: 'FF1B3D55' } };
  ws.mergeCells(2, 1, 2, Math.max(headers.length, 1));
  ws.getCell(2, 1).value = `የተዘጋጀበት፦ ${formatEc(stamp)} · ${rows.length} አባላት`;
  ws.getCell(2, 1).font = { ...font, size: 11, color: { argb: 'FF5A6B78' } };
  const head = ws.addRow(['ተ.ቁ', ...headers]);
  head.eachCell((c) => {
    c.font = { ...font, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F78B5' } };
    c.alignment = { vertical: 'middle', wrapText: true };
  });
  head.height = 24;
  body.forEach((r, i) => {
    const row = ws.addRow([i + 1, ...r]);
    row.eachCell((c) => {
      c.font = font;
      c.alignment = { vertical: 'top', wrapText: true };
      if (i % 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF6FC' } };
    });
  });
  ws.columns.forEach((c, i) => {
    const longest = Math.max(...[i === 0 ? 'ተ.ቁ' : headers[i - 1], ...body.map((r) => String(i === 0 ? '' : r[i - 1] ?? ''))].map((x) => x.length));
    c.width = Math.min(Math.max(i === 0 ? 6 : 12, longest + 2), 48);
  });
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: headers.length + 1 } };
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${base}.xlsx"`,
    },
  });
}
