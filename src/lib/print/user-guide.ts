/**
 * Shared types between the on-screen UserGuide and the printable PDF
 * snapshot. Defining them here keeps `lib/print` free of UI deps.
 */
export type GuideAudience = 'All users' | 'Admin only';

export interface PrintableGuideSection {
  id: string;
  group: string;
  title: string;
  audience: GuideAudience;
  summary: string;
  before: string[];
  steps: string[];
  after: string[];
  tips: string[];
  warnings?: string[];
}

export interface PrintableGuideOptions {
  schoolName: string;
  generatedAt: string; // ISO timestamp
  sections: PrintableGuideSection[];
  groupTitles: Record<string, string>;
  /** When true the document omits the screenshots/videos callout blocks. */
  printOnly?: boolean;
}

type Tone = 'neutral' | 'primary' | 'soft' | 'danger';

const TONE_PALETTE: Record<Tone, { bg: string; border: string; title: string; text: string }> = {
  neutral: {
    bg: '#f8fafc',
    border: '#e2e8f0',
    title: '#334155',
    text: '#1f2937',
  },
  primary: {
    bg: '#fff7ed',
    border: '#fed7aa',
    title: '#9a3412',
    text: '#1f2937',
  },
  soft: {
    bg: '#f0f9ff',
    border: '#bae6fd',
    title: '#0369a1',
    text: '#1f2937',
  },
  danger: {
    bg: '#fef2f2',
    border: '#fecaca',
    title: '#b91c1c',
    text: '#7f1d1d',
  },
};

function escapeHtml(value: string): string {
  const amp = String.fromCharCode(38);
  const lt = String.fromCharCode(60);
  const gt = String.fromCharCode(62);
  const quot = String.fromCharCode(34);
  const apos = String.fromCharCode(39);
  const entity = (name: string) => amp + name + ';';
  return value
    .replace(/&/g, entity('amp'))
    .replace(/</g, entity('lt'))
    .replace(/>/g, entity('gt'))
    .replace(/"/g, entity('#' + quot.charCodeAt(0)))
    .replace(/'/g, entity('#' + apos.charCodeAt(0)));
}

function infoBlock(title: string, items: string[], tone: Tone, numbered: boolean): string {
  const palette = TONE_PALETTE[tone];
  const inner = items
    .map(
      (item, index) => `
        <div class="row">
          <div class="bullet">${numbered ? String(index + 1) : '&bull;'}</div>
          <div class="item">${escapeHtml(item)}</div>
        </div>`
    )
    .join('');

  return `
    <section class="info" style="background:${palette.bg};border:1px solid ${palette.border};">
      <div class="info-title" style="color:${palette.title};">${escapeHtml(title)}</div>
      ${inner}
    </section>`;
}

/**
 * Build a self-contained HTML document for the printable user guide.
 * All styles are inlined so it renders identically via Electron's
 * printToPdf pipeline regardless of the host app's CSS variables.
 *
 * The school name is always sourced from the live `app_settings.school_name`
 * row at the moment of printing — so after a DB restore/import the next
 * print uses the imported name automatically.
 */
export function buildPrintableGuideHtml(options: PrintableGuideOptions): string {
  const { schoolName, generatedAt, sections, groupTitles, printOnly = true } = options;
  const displayName = schoolName && schoolName.trim() ? schoolName.trim() : 'SchoolFoundry';

  const orderedGroups = Array.from(new Set(sections.map(s => s.group)));

  const body = orderedGroups
    .map(groupTitle => {
      const groupSections = sections.filter(s => s.group === groupTitle);
      const articles = groupSections
        .map(section => {
          const audienceBg = section.audience === 'Admin only' ? '#fee2e2' : '#e0f2fe';
          const audienceColor = section.audience === 'Admin only' ? '#b91c1c' : '#0369a1';

          return `
            <article class="card" id="${escapeHtml(section.id)}">
              <header class="card-head">
                <div>
                  <span class="badge" style="background:${audienceBg};color:${audienceColor};">
                    ${escapeHtml(section.audience)}
                  </span>
                  <h3>${escapeHtml(section.title)}</h3>
                  <p class="summary">${escapeHtml(section.summary)}</p>
                </div>
              </header>
              <div class="card-body">
                ${infoBlock('Before you start', section.before, 'neutral', false)}
                ${infoBlock('Steps', section.steps, 'primary', true)}
                ${
                  printOnly
                    ? ''
                    : infoBlock(
                        'Screenshots and video',
                        [
                          'Drop screenshots into the screenshots folder and a short video or GIF into the videos folder for this tutorial.',
                        ],
                        'soft',
                        false
                      )
                }
                ${infoBlock('After you finish', section.after, 'neutral', false)}
                ${infoBlock('Tips', section.tips, 'soft', false)}
                ${
                  section.warnings && section.warnings.length > 0
                    ? infoBlock('Important warnings', section.warnings, 'danger', false)
                    : ''
                }
              </div>
            </article>`;
        })
        .join('');

      return `
        <section class="group">
          <h2>${escapeHtml(groupTitles[groupTitle] ?? groupTitle)}</h2>
          ${articles}
        </section>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>SchoolFoundry User Guide &mdash; ${escapeHtml(displayName)}</title>
<style>
  @page { size: A4; margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 28px 32px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #0f172a;
    line-height: 1.55;
    background: #fff;
  }
  .cover {
    border-bottom: 1px solid #fed7aa;
    padding-bottom: 18px;
    margin-bottom: 24px;
  }
  .cover .row { display: flex; align-items: center; gap: 16px; }
  .cover img { width: 56px; height: 56px; }
  .cover h1 { margin: 0; font-size: 26px; line-height: 1.15; }
  .cover h2 { margin: 4px 0 0; font-size: 16px; color: #9a3412; font-weight: 600; }
  .meta {
    margin-top: 14px;
    font-size: 12px;
    color: #64748b;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }
  .meta strong { color: #1f2937; }
  .group { margin-bottom: 28px; page-break-inside: auto; }
  .group > h2 {
    margin: 0 0 14px;
    font-size: 18px;
    letter-spacing: -0.01em;
    color: #9a3412;
    border-left: 4px solid #f97316;
    padding-left: 10px;
  }
  .card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 20px 22px;
    margin-bottom: 18px;
    page-break-inside: avoid;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  }
  .card-head h3 { margin: 6px 0 8px; font-size: 20px; color: #0f172a; }
  .summary { margin: 0; color: #475569; max-width: 100%; font-size: 13px; }
  .badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .card-body { display: grid; gap: 14px; margin-top: 16px; }
  .info {
    border-radius: 12px;
    padding: 14px 16px;
    page-break-inside: avoid;
  }
  .info-title {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 8px;
  }
  .row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    margin-top: 6px;
  }
  .bullet {
    flex: 0 0 22px;
    width: 22px;
    height: 22px;
    border-radius: 999px;
    background: #fde68a;
    color: #9a3412;
    font-weight: 700;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1px;
  }
  .item { font-size: 13px; line-height: 1.55; color: #1f2937; }
  @media print {
    body { padding: 0; }
    .card { box-shadow: none; }
  }
</style>
</head>
<body>
  <section class="cover">
    <div class="row">
      <img src="/img/schoolfoundry-icon.png" alt="SchoolFoundry" />
      <div>
        <h1>SchoolFoundry User Guide</h1>
        <h2>${escapeHtml(displayName)}</h2>
      </div>
    </div>
    <div class="meta">
      <span><strong>School:</strong> ${escapeHtml(displayName)}</span>
      <span><strong>Generated:</strong> ${escapeHtml(generatedAt)}</span>
      <span><strong>Application:</strong> SchoolFoundry &mdash; Offline school fees manager</span>
    </div>
  </section>

  <main>
    ${body}
  </main>

  <footer style="margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">
    Generated by SchoolFoundry for ${escapeHtml(displayName)}. Confidential &mdash; for school administration use only.
  </footer>
</body>
</html>`;
}
