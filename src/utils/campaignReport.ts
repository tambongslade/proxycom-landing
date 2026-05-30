// Campaign report generation utilities.
// Dependency-free: builds aggregate stats from campaign records and produces
// both a CSV export and a print-ready (Save as PDF) HTML report.

export interface ReportMediaFile {
  id: number;
  original_name: string;
  duration_seconds?: number;
  size_bytes?: number;
}

export interface ReportRecord {
  id: number;
  status: string;
  submission_date: string;
  start_date: string;
  end_date: string;
  validation_comment?: string | null;
  radioStation: { id: number; name: string };
  audioFiles?: ReportMediaFile[];
  videoFiles?: ReportMediaFile[];
}

export interface StationBreakdown {
  id: number;
  name: string;
  total: number;
  validated: number;
  pending: number;
  rejected: number;
  audioCount: number;
  videoCount: number;
  airtimeSeconds: number;
  lastSubmission: string | null;
}

export interface CampaignStats {
  totalRecords: number;
  validated: number;
  pending: number;
  rejected: number;
  stationCount: number;
  audioCount: number;
  videoCount: number;
  airtimeSeconds: number;
  firstDate: string | null;
  lastDate: string | null;
  stations: StationBreakdown[];
}

const normalizeStatus = (status: string): 'validated' | 'pending' | 'rejected' | 'other' => {
  const s = (status || '').toLowerCase();
  if (s === 'validated') return 'validated';
  if (s === 'pending') return 'pending';
  if (s === 'rejected') return 'rejected';
  return 'other';
};

export const buildCampaignStats = (records: ReportRecord[]): CampaignStats => {
  const stationMap = new Map<number, StationBreakdown>();
  let validated = 0;
  let pending = 0;
  let rejected = 0;
  let audioCount = 0;
  let videoCount = 0;
  let airtimeSeconds = 0;
  let firstTime = Infinity;
  let lastTime = -Infinity;

  records.forEach((r) => {
    const status = normalizeStatus(r.status);
    if (status === 'validated') validated++;
    else if (status === 'pending') pending++;
    else if (status === 'rejected') rejected++;

    const audios = r.audioFiles ?? [];
    const videos = r.videoFiles ?? [];
    const recAudioCount = audios.length;
    const recVideoCount = videos.length;
    const recAirtime = audios.reduce((sum, f) => sum + (f.duration_seconds || 0), 0)
      + videos.reduce((sum, f) => sum + (f.duration_seconds || 0), 0);

    audioCount += recAudioCount;
    videoCount += recVideoCount;
    airtimeSeconds += recAirtime;

    [r.start_date, r.end_date, r.submission_date].forEach((d) => {
      const t = new Date(d).getTime();
      if (!Number.isNaN(t)) {
        if (t < firstTime) firstTime = t;
        if (t > lastTime) lastTime = t;
      }
    });

    const stationId = r.radioStation?.id ?? -1;
    const stationName = r.radioStation?.name ?? 'Unknown';
    const existing = stationMap.get(stationId) ?? {
      id: stationId,
      name: stationName,
      total: 0,
      validated: 0,
      pending: 0,
      rejected: 0,
      audioCount: 0,
      videoCount: 0,
      airtimeSeconds: 0,
      lastSubmission: null as string | null,
    };
    existing.total++;
    if (status === 'validated') existing.validated++;
    else if (status === 'pending') existing.pending++;
    else if (status === 'rejected') existing.rejected++;
    existing.audioCount += recAudioCount;
    existing.videoCount += recVideoCount;
    existing.airtimeSeconds += recAirtime;
    if (
      !existing.lastSubmission ||
      new Date(r.submission_date).getTime() > new Date(existing.lastSubmission).getTime()
    ) {
      existing.lastSubmission = r.submission_date;
    }
    stationMap.set(stationId, existing);
  });

  const stations = Array.from(stationMap.values()).sort((a, b) => b.total - a.total);

  return {
    totalRecords: records.length,
    validated,
    pending,
    rejected,
    stationCount: stations.length,
    audioCount,
    videoCount,
    airtimeSeconds,
    firstDate: firstTime === Infinity ? null : new Date(firstTime).toISOString(),
    lastDate: lastTime === -Infinity ? null : new Date(lastTime).toISOString(),
    stations,
  };
};

export const formatAirtime = (totalSeconds: number): string => {
  if (!totalSeconds || totalSeconds < 1) return '0s';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 && h === 0) parts.push(`${s}s`);
  return parts.join(' ') || '0s';
};

const formatReportDate = (dateStr: string | null, locale = 'fr-FR'): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' });
};

const triggerDownload = (content: string, filename: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const csvCell = (value: string | number | null | undefined): string => {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const slugify = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'campagne';

export interface ReportLabels {
  csvHeaders: {
    recordId: string;
    station: string;
    status: string;
    submissionDate: string;
    startDate: string;
    endDate: string;
    audioFiles: string;
    videoFiles: string;
    airtime: string;
    comment: string;
  };
  statusLabels: { validated: string; pending: string; rejected: string; other: string };
  report: {
    title: string;
    generatedOn: string;
    client: string;
    period: string;
    summary: string;
    totalRecords: string;
    stations: string;
    validated: string;
    pending: string;
    rejected: string;
    audioSpots: string;
    videoSpots: string;
    totalAirtime: string;
    statusBreakdown: string;
    stationBreakdown: string;
    detailedRecords: string;
    print: string;
    noData: string;
  };
}

const statusLabel = (status: string, labels: ReportLabels): string => {
  const key = normalizeStatus(status);
  return labels.statusLabels[key];
};

export const exportCampaignCsv = (
  campaignName: string,
  records: ReportRecord[],
  labels: ReportLabels,
  locale = 'fr-FR',
) => {
  const h = labels.csvHeaders;
  const header = [
    h.recordId, h.station, h.status, h.submissionDate, h.startDate,
    h.endDate, h.audioFiles, h.videoFiles, h.airtime, h.comment,
  ];
  const rows = records.map((r) => {
    const audios = r.audioFiles ?? [];
    const videos = r.videoFiles ?? [];
    const airtime = audios.reduce((s, f) => s + (f.duration_seconds || 0), 0)
      + videos.reduce((s, f) => s + (f.duration_seconds || 0), 0);
    return [
      r.id,
      r.radioStation?.name ?? '',
      statusLabel(r.status, labels),
      formatReportDate(r.submission_date, locale),
      formatReportDate(r.start_date, locale),
      formatReportDate(r.end_date, locale),
      audios.length,
      videos.length,
      formatAirtime(airtime),
      r.validation_comment ?? '',
    ];
  });
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  // Prepend BOM so Excel reads UTF-8 accents correctly.
  triggerDownload('﻿' + csv, `rapport-${slugify(campaignName)}.csv`, 'text/csv;charset=utf-8;');
};

export const openCampaignPrintReport = (
  campaignName: string,
  records: ReportRecord[],
  labels: ReportLabels,
  clientName?: string,
  locale = 'fr-FR',
) => {
  const stats = buildCampaignStats(records);
  const L = labels.report;

  const generatedDate = new Date().toLocaleDateString(locale, {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const total = stats.totalRecords || 1;
  const pct = (n: number) => Math.round((n / total) * 100);

  const kpi = (value: string | number, label: string, accent: string) => `
    <div class="kpi">
      <div class="kpi-bar" style="background:${accent}"></div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-label">${label}</div>
    </div>`;

  const statusSegments = [
    { label: L.validated, count: stats.validated, color: '#16a34a' },
    { label: L.pending, count: stats.pending, color: '#d97706' },
    { label: L.rejected, count: stats.rejected, color: '#dc2626' },
  ].filter((s) => s.count > 0);

  const statusBar = statusSegments
    .map((s) => `<div class="seg" style="width:${pct(s.count)}%;background:${s.color}" title="${s.label}: ${s.count}"></div>`)
    .join('');

  const statusLegend = [
    { label: L.validated, count: stats.validated, color: '#16a34a' },
    { label: L.pending, count: stats.pending, color: '#d97706' },
    { label: L.rejected, count: stats.rejected, color: '#dc2626' },
  ]
    .map((s) => `<span class="legend"><i style="background:${s.color}"></i>${s.label}: <strong>${s.count}</strong> (${pct(s.count)}%)</span>`)
    .join('');

  const stationRows = stats.stations
    .map(
      (st) => `
      <tr>
        <td class="station-name">${escapeHtml(st.name)}</td>
        <td class="num">${st.total}</td>
        <td class="num"><span class="pill validated">${st.validated}</span></td>
        <td class="num"><span class="pill pending">${st.pending}</span></td>
        <td class="num"><span class="pill rejected">${st.rejected}</span></td>
        <td class="num">${st.audioCount}</td>
        <td class="num">${st.videoCount}</td>
        <td class="num">${formatAirtime(st.airtimeSeconds)}</td>
        <td>${formatReportDate(st.lastSubmission, locale)}</td>
      </tr>`,
    )
    .join('');

  const recordRows = records
    .slice()
    .sort((a, b) => new Date(b.submission_date).getTime() - new Date(a.submission_date).getTime())
    .map(
      (r) => `
      <tr>
        <td class="num">#${r.id}</td>
        <td>${escapeHtml(r.radioStation?.name ?? '')}</td>
        <td><span class="status-tag ${normalizeStatus(r.status)}">${statusLabel(r.status, labels)}</span></td>
        <td>${formatReportDate(r.submission_date, locale)}</td>
        <td>${formatReportDate(r.start_date, locale)} → ${formatReportDate(r.end_date, locale)}</td>
        <td class="num">${(r.audioFiles ?? []).length}</td>
        <td class="num">${(r.videoFiles ?? []).length}</td>
      </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="${locale.slice(0, 2)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(L.title)} — ${escapeHtml(campaignName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #1a1535;
    --brand: #6e42d3;
    --muted: #6b7280;
    --line: #e7e4f2;
    --bg-soft: #f7f6fc;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Poppins', system-ui, sans-serif;
    color: var(--ink);
    background: #fff;
    padding: 48px 56px;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc-head {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 3px solid var(--ink); padding-bottom: 22px; margin-bottom: 8px;
  }
  .brand-mark { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 13px; letter-spacing: 3px; text-transform: uppercase; color: var(--brand); }
  h1 { font-family: 'Space Grotesk', sans-serif; font-size: 30px; font-weight: 700; margin: 6px 0 4px; letter-spacing: -0.5px; }
  .doc-sub { color: var(--muted); font-size: 13px; }
  .meta { text-align: right; font-size: 12px; color: var(--muted); }
  .meta strong { display: block; color: var(--ink); font-size: 13px; font-weight: 600; }
  .meta-row { margin-bottom: 8px; }
  .section-title {
    font-family: 'Space Grotesk', sans-serif; font-size: 12px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 2px; color: var(--brand);
    margin: 36px 0 16px; display: flex; align-items: center; gap: 10px;
  }
  .section-title::after { content: ''; flex: 1; height: 1px; background: var(--line); }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .kpi {
    position: relative; background: var(--bg-soft); border: 1px solid var(--line);
    border-radius: 14px; padding: 18px 18px 16px; overflow: hidden;
  }
  .kpi-bar { position: absolute; top: 0; left: 0; width: 100%; height: 4px; }
  .kpi-value { font-family: 'Space Grotesk', sans-serif; font-size: 30px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1; }
  .kpi-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.8px; margin-top: 4px; }
  .status-block { background: var(--bg-soft); border: 1px solid var(--line); border-radius: 14px; padding: 22px; }
  .status-track { display: flex; height: 18px; border-radius: 999px; overflow: hidden; background: #ece9f6; }
  .status-track .seg { height: 100%; }
  .legend-row { display: flex; flex-wrap: wrap; gap: 22px; margin-top: 16px; font-size: 13px; color: var(--muted); }
  .legend { display: inline-flex; align-items: center; gap: 8px; }
  .legend i { width: 12px; height: 12px; border-radius: 4px; display: inline-block; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  thead th {
    text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.6px;
    color: var(--muted); font-weight: 600; padding: 10px 10px; border-bottom: 2px solid var(--line);
  }
  tbody td { padding: 11px 10px; border-bottom: 1px solid var(--line); vertical-align: middle; }
  tbody tr:nth-child(even) { background: #faf9fd; }
  .num { text-align: center; font-variant-numeric: tabular-nums; }
  th.num { text-align: center; }
  .station-name { font-weight: 600; }
  .pill { display: inline-block; min-width: 22px; padding: 2px 8px; border-radius: 999px; font-weight: 600; font-size: 11px; }
  .pill.validated { background: #dcfce7; color: #15803d; }
  .pill.pending { background: #fef3c7; color: #b45309; }
  .pill.rejected { background: #fee2e2; color: #b91c1c; }
  .status-tag { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: capitalize; }
  .status-tag.validated { background: #dcfce7; color: #15803d; }
  .status-tag.pending { background: #fef3c7; color: #b45309; }
  .status-tag.rejected { background: #fee2e2; color: #b91c1c; }
  .status-tag.other { background: #ede9fe; color: #6e42d3; }
  .empty { text-align: center; color: var(--muted); padding: 40px; font-style: italic; }
  .doc-foot { margin-top: 44px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 11px; color: var(--muted); display: flex; justify-content: space-between; }
  .print-btn {
    position: fixed; top: 20px; right: 20px; background: var(--brand); color: #fff;
    border: none; border-radius: 999px; padding: 12px 26px; font-family: 'Poppins', sans-serif;
    font-weight: 600; font-size: 14px; cursor: pointer; box-shadow: 0 8px 24px rgba(110,66,211,0.35);
  }
  @media print {
    body { padding: 0; }
    .print-btn { display: none; }
    .kpi, .status-block, tbody tr { break-inside: avoid; }
    thead { display: table-header-group; }
  }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">${escapeHtml(L.print)}</button>

  <header class="doc-head">
    <div>
      <div class="brand-mark">ProxyCom</div>
      <h1>${escapeHtml(campaignName)}</h1>
      <div class="doc-sub">${escapeHtml(L.title)}</div>
    </div>
    <div class="meta">
      <div class="meta-row"><span>${escapeHtml(L.generatedOn)}</span><strong>${generatedDate}</strong></div>
      ${clientName ? `<div class="meta-row"><span>${escapeHtml(L.client)}</span><strong>${escapeHtml(clientName)}</strong></div>` : ''}
      <div class="meta-row"><span>${escapeHtml(L.period)}</span><strong>${formatReportDate(stats.firstDate, locale)} → ${formatReportDate(stats.lastDate, locale)}</strong></div>
    </div>
  </header>

  ${records.length === 0 ? `<p class="empty">${escapeHtml(L.noData)}</p>` : `
  <div class="section-title">${escapeHtml(L.summary)}</div>
  <div class="kpis">
    ${kpi(stats.totalRecords, L.totalRecords, '#6e42d3')}
    ${kpi(stats.stationCount, L.stations, '#3a86ff')}
    ${kpi(stats.audioCount, L.audioSpots, '#2ec4b6')}
    ${kpi(stats.videoCount, L.videoSpots, '#ff7f50')}
    ${kpi(stats.validated, L.validated, '#16a34a')}
    ${kpi(stats.pending, L.pending, '#d97706')}
    ${kpi(stats.rejected, L.rejected, '#dc2626')}
    ${kpi(formatAirtime(stats.airtimeSeconds), L.totalAirtime, '#8338ec')}
  </div>

  <div class="section-title">${escapeHtml(L.statusBreakdown)}</div>
  <div class="status-block">
    <div class="status-track">${statusBar || '<div class="seg" style="width:100%;background:#ece9f6"></div>'}</div>
    <div class="legend-row">${statusLegend}</div>
  </div>

  <div class="section-title">${escapeHtml(L.stationBreakdown)}</div>
  <table>
    <thead>
      <tr>
        <th>${escapeHtml(L.stations)}</th>
        <th class="num">${escapeHtml(L.totalRecords)}</th>
        <th class="num">${escapeHtml(L.validated)}</th>
        <th class="num">${escapeHtml(L.pending)}</th>
        <th class="num">${escapeHtml(L.rejected)}</th>
        <th class="num">Audio</th>
        <th class="num">Video</th>
        <th class="num">${escapeHtml(L.totalAirtime)}</th>
        <th>${escapeHtml(labels.csvHeaders.submissionDate)}</th>
      </tr>
    </thead>
    <tbody>${stationRows}</tbody>
  </table>

  <div class="section-title">${escapeHtml(L.detailedRecords)}</div>
  <table>
    <thead>
      <tr>
        <th class="num">ID</th>
        <th>${escapeHtml(L.stations)}</th>
        <th>${escapeHtml(labels.csvHeaders.status)}</th>
        <th>${escapeHtml(labels.csvHeaders.submissionDate)}</th>
        <th>${escapeHtml(labels.csvHeaders.startDate)} / ${escapeHtml(labels.csvHeaders.endDate)}</th>
        <th class="num">Audio</th>
        <th class="num">Video</th>
      </tr>
    </thead>
    <tbody>${recordRows}</tbody>
  </table>
  `}

  <footer class="doc-foot">
    <span>ProxyCom · ${escapeHtml(L.title)}</span>
    <span>${escapeHtml(campaignName)}</span>
  </footer>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    // Popup blocked — fall back to downloading the HTML file.
    triggerDownload(html, `rapport-${slugify(campaignName)}.html`, 'text/html;charset=utf-8;');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
};

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
