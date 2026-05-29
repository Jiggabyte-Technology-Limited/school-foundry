import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const buildDir = path.join(repoRoot, 'build', 'presentations');
const outputPptx = path.join(buildDir, 'uncle-pilot-deck.pptx');
const sourceJsx = path.join(buildDir, 'uncle-pilot-deck-source.mjs');
const logoPath = path.join(repoRoot, 'public', 'img', 'schoolfoundry-logo.png');
const iconPath = path.join(repoRoot, 'public', 'img', 'schoolfoundry-icon.png');
const artifactToolPath = path.join(
  'C:\\Users\\sewar\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\@oai\\artifact-tool\\dist\\artifact_tool.mjs'
);
const { Presentation, PresentationFile, fr } = await import(pathToFileURL(artifactToolPath).href);

const COLORS = {
  bg: '#f5f4ef',
  paper: '#ffffff',
  ink: '#111827',
  muted: '#4b5563',
  border: '#e5e7eb',
  accent: '#f97316',
  accentSoft: '#fff2e8',
  warm: '#f8ede1',
  success: '#0f766e',
  danger: '#b91c1c',
};

const FONT = 'Aptos';
const TITLE_FONT = 'Aptos Display';

function setText(shape, text, opts = {}) {
  shape.text = text;
  shape.text.typeface = opts.typeface ?? FONT;
  shape.text.fontSize = opts.fontSize ?? 20;
  shape.text.color = opts.color ?? COLORS.ink;
  shape.text.bold = opts.bold ?? false;
  shape.text.italic = opts.italic ?? false;
  shape.text.alignment = opts.align ?? 'left';
  shape.text.verticalAlignment = opts.valign ?? 'top';
  shape.text.wrap = opts.wrap ?? 'square';
  shape.text.autoFit = opts.autoFit ?? 'shrinkText';
  shape.text.insets = opts.insets ?? { top: 10, right: 12, bottom: 10, left: 12 };
  return shape;
}

async function addShape(slide, spec, text, textOpts = {}) {
  const shape = await slide.shapes.add(spec);
  if (text !== undefined) {
    setText(shape, text, textOpts);
  }
  return shape;
}

async function addCard(slide, { x, y, w, h, fill = COLORS.paper, line = COLORS.border, radius = 18, text, textOpts }) {
  return addShape(
    slide,
    {
      geometry: 'roundRect',
      position: { left: x, top: y, width: w, height: h },
      fill: { type: 'solid', color: fill },
      line: { style: 'solid', fill: line, width: 1.25 },
      borderRadius: radius,
    },
    text,
    textOpts
  );
}

async function addRect(slide, { x, y, w, h, fill = COLORS.paper, line = COLORS.border, text, textOpts }) {
  return addShape(
    slide,
    {
      geometry: 'rect',
      position: { left: x, top: y, width: w, height: h },
      fill: { type: 'solid', color: fill },
      line: { style: 'solid', fill: line, width: 1.25 },
    },
    text,
    textOpts
  );
}

async function addPill(slide, { x, y, w, h, fill = COLORS.accentSoft, line = COLORS.accent, text, color = COLORS.accent }) {
  return addCard(slide, {
    x,
    y,
    w,
    h,
    fill,
    line,
    radius: 999,
    text,
    textOpts: {
      fontSize: 13,
      color,
      bold: true,
      align: 'center',
      valign: 'middle',
      insets: { top: 6, right: 10, bottom: 6, left: 10 },
    },
  });
}

async function addTitle(slide, title, subtitle, slideNo) {
  await addRect(slide, { x: 0, y: 0, w: 1280, h: 14, fill: COLORS.accent, line: COLORS.accent });
  await addShape(
    slide,
    {
      geometry: 'rect',
      position: { left: 64, top: 42, width: 1080, height: 72 },
      fill: { type: 'solid', color: COLORS.bg },
      line: { style: 'solid', fill: COLORS.bg, width: 0.1 },
    },
    title,
    { fontSize: 28, bold: true, typeface: TITLE_FONT, color: COLORS.ink, insets: { top: 0, right: 0, bottom: 0, left: 0 } }
  );
  if (subtitle) {
    await addShape(
      slide,
      {
        geometry: 'rect',
        position: { left: 64, top: 86, width: 1080, height: 42 },
        fill: { type: 'solid', color: COLORS.bg },
        line: { style: 'solid', fill: COLORS.bg, width: 0.1 },
      },
      subtitle,
      { fontSize: 14, color: COLORS.muted, insets: { top: 0, right: 0, bottom: 0, left: 0 } }
    );
  }
  await addShape(
    slide,
    {
      geometry: 'rect',
      position: { left: 1180, top: 34, width: 36, height: 36 },
      fill: { type: 'solid', color: COLORS.paper },
      line: { style: 'solid', fill: COLORS.border, width: 1 },
    },
    String(slideNo).padStart(2, '0'),
    {
      fontSize: 13,
      bold: true,
      color: COLORS.accent,
      align: 'center',
      valign: 'middle',
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    }
  );
}

async function addLogo(slide, { x, y, w, h, icon = false }) {
  const pathToUse = icon ? iconPath : logoPath;
  await slide.images.add({
    path: pathToUse,
    position: { left: x, top: y, width: w, height: h },
    fit: 'contain',
  });
}

async function addFooter(slide, label) {
  await addShape(
    slide,
    {
      geometry: 'rect',
      position: { left: 64, top: 670, width: 1152, height: 1 },
      fill: { type: 'solid', color: COLORS.border },
      line: { style: 'solid', fill: COLORS.border, width: 0.5 },
    }
  );
  await addShape(
    slide,
    {
      geometry: 'rect',
      position: { left: 64, top: 678, width: 500, height: 20 },
      fill: { type: 'solid', color: COLORS.bg },
      line: { style: 'solid', fill: COLORS.bg, width: 0.1 },
    },
    label,
    { fontSize: 10, color: COLORS.muted, insets: { top: 0, right: 0, bottom: 0, left: 0 } }
  );
}

async function addBadgeLine(slide, items, x, y, gap = 12) {
  let cursor = x;
  for (const item of items) {
    const width = Math.max(96, Math.min(220, item.length * 8 + 28));
    await addPill(slide, { x: cursor, y, w: width, h: 32, text: item });
    cursor += width + gap;
  }
}

async function addBulletCard(slide, { x, y, w, h, heading, bullets, fill = COLORS.paper, accent = COLORS.accent }) {
  await addCard(slide, { x, y, w, h, fill, line: COLORS.border });
  await addShape(
    slide,
    {
      geometry: 'rect',
      position: { left: x + 18, top: y + 18, width: w - 36, height: 32 },
      fill: { type: 'solid', color: fill },
      line: { style: 'solid', fill, width: 0.1 },
    },
    heading,
    { fontSize: 21, bold: true, typeface: TITLE_FONT, color: COLORS.ink, insets: { top: 0, right: 0, bottom: 0, left: 0 } }
  );
  await addShape(
    slide,
    {
      geometry: 'rect',
      position: { left: x + 18, top: y + 58, width: w - 36, height: h - 74 },
      fill: { type: 'solid', color: fill },
      line: { style: 'solid', fill, width: 0.1 },
    },
    bullets.map(b => `• ${b}`).join('\n'),
    { fontSize: 16, color: COLORS.muted, insets: { top: 0, right: 0, bottom: 0, left: 0 } }
  );
  await addRect(slide, { x: x + 18, y: y + h - 20, w: 64, h: 4, fill: accent, line: accent });
}

async function buildDeck() {
  await mkdir(buildDir, { recursive: true });

  const pres = Presentation.create();

  // Slide 1
  {
    const slide = pres.slides.add();
    slide.setViewportSize(1280, 720);
    slide.background.fill = { type: 'solid', color: COLORS.bg };
    await addLogo(slide, { x: 942, y: 70, w: 210, h: 56 });
    await addShape(
      slide,
      {
        geometry: 'rect',
        position: { left: 64, top: 156, width: 760, height: 120 },
        fill: { type: 'solid', color: COLORS.bg },
        line: { style: 'solid', fill: COLORS.bg, width: 0.1 },
      },
      'School Foundry',
      { fontSize: 56, bold: true, typeface: TITLE_FONT, color: COLORS.ink, insets: { top: 0, right: 0, bottom: 0, left: 0 } }
    );
    await addShape(
      slide,
      {
        geometry: 'rect',
        position: { left: 64, top: 240, width: 720, height: 60 },
        fill: { type: 'solid', color: COLORS.bg },
        line: { style: 'solid', fill: COLORS.bg, width: 0.1 },
      },
      'Offline school office software for payments, receipts, statements, and class lists.',
      { fontSize: 24, color: COLORS.muted, insets: { top: 0, right: 0, bottom: 0, left: 0 } }
    );
    await addShape(
      slide,
      {
        geometry: 'rect',
        position: { left: 64, top: 312, width: 650, height: 60 },
        fill: { type: 'solid', color: COLORS.bg },
        line: { style: 'solid', fill: COLORS.bg, width: 0.1 },
      },
      'Simple local-first administration for schools that cannot afford downtime.',
      { fontSize: 18, color: COLORS.ink, insets: { top: 0, right: 0, bottom: 0, left: 0 } }
    );
    await addBadgeLine(slide, ['Offline reliability', 'Receipting', 'Statements', 'Class lists'], 64, 406);

    await addCard(slide, {
      x: 812,
      y: 150,
      w: 404,
      h: 390,
      fill: COLORS.paper,
      line: COLORS.border,
      text: '',
    });
    await addLogo(slide, { x: 900, y: 200, w: 216, h: 70, icon: false });
    await addShape(
      slide,
      {
        geometry: 'rect',
        position: { left: 860, top: 305, width: 300, height: 40 },
        fill: { type: 'solid', color: COLORS.paper },
        line: { style: 'solid', fill: COLORS.paper, width: 0.1 },
      },
      'Built for schools that need to keep working when the internet does not.',
      { fontSize: 18, bold: true, color: COLORS.ink, align: 'center', insets: { top: 0, right: 0, bottom: 0, left: 0 } }
    );
    await addShape(
      slide,
      {
        geometry: 'rect',
        position: { left: 858, top: 370, width: 306, height: 120 },
        fill: { type: 'solid', color: COLORS.accentSoft },
        line: { style: 'solid', fill: COLORS.accent, width: 1 },
      },
      'Pilot focus:\n• Fast learner lookup\n• One-step payment capture\n• Print-ready outputs\n• Local backups',
      { fontSize: 16, color: COLORS.ink, insets: { top: 18, right: 18, bottom: 18, left: 18 } }
    );
    await addFooter(slide, 'School Foundry pilot deck');
    slide.speakerNotes.text = 'Open with the core promise: the office keeps moving even when the internet does not.';
  }

  // Slide 2
  {
    const slide = pres.slides.add();
    slide.setViewportSize(1280, 720);
    slide.background.fill = { type: 'solid', color: COLORS.bg };
    await addTitle(slide, 'The Problem', 'What schools live with today', 2);
    await addBulletCard(slide, {
      x: 64,
      y: 150,
      w: 550,
      h: 220,
      heading: 'Office reality',
      bullets: [
        'Payments are tracked in spreadsheets, notebooks, and memory',
        'Receipts take too long to issue or reconcile',
        'Statements are slow to prepare and easy to get wrong',
      ],
    });
    await addBulletCard(slide, {
      x: 666,
      y: 150,
      w: 550,
      h: 220,
      heading: 'Operational drag',
      bullets: [
        'Class lists drift out of date',
        'Internet outages break the office rhythm',
        'Staff spend too much time hunting for balances and proof',
      ],
      accent: COLORS.danger,
    });
    await addCard(slide, { x: 64, y: 400, w: 1152, h: 160, fill: COLORS.paper, line: COLORS.border });
    await addShape(
      slide,
      {
        geometry: 'rect',
        position: { left: 92, top: 430, width: 1096, height: 20 },
        fill: { type: 'solid', color: COLORS.paper },
        line: { style: 'solid', fill: COLORS.paper, width: 0.1 },
      },
      'What this costs the school',
      { fontSize: 22, bold: true, typeface: TITLE_FONT, color: COLORS.ink, insets: { top: 0, right: 0, bottom: 0, left: 0 } }
    );
    await addShape(
      slide,
      {
        geometry: 'rect',
        position: { left: 92, top: 470, width: 1096, height: 60 },
        fill: { type: 'solid', color: COLORS.paper },
        line: { style: 'solid', fill: COLORS.paper, width: 0.1 },
      },
      'Time, accuracy, and trust. Every manual receipt, every misplaced balance, and every outage makes the office feel slower and less reliable.',
      { fontSize: 18, color: COLORS.muted, insets: { top: 0, right: 0, bottom: 0, left: 0 } }
    );
    await addFooter(slide, 'The problem slide');
    slide.speakerNotes.text = 'Keep this grounded in real office pain, not software jargon.';
  }

  // Slide 3
  {
    const slide = pres.slides.add();
    slide.setViewportSize(1280, 720);
    slide.background.fill = { type: 'solid', color: COLORS.bg };
    await addTitle(slide, 'How the Platform Fits Together', 'One system with five jobs', 3);

    const center = await addCard(slide, { x: 470, y: 250, w: 340, h: 160, fill: COLORS.ink, line: COLORS.ink });
    setText(center, 'School Foundry', {
      fontSize: 34,
      bold: true,
      color: '#ffffff',
      align: 'center',
      valign: 'middle',
      insets: { top: 20, right: 20, bottom: 20, left: 20 },
    });

    const nodes = [
      { x: 74, y: 160, w: 250, h: 100, title: 'Learner registry', body: 'Fast search and account lookup' },
      { x: 74, y: 322, w: 250, h: 100, title: 'Payments', body: 'Record money and update balances' },
      { x: 74, y: 484, w: 250, h: 100, title: 'Receipts', body: 'Print proof immediately' },
      { x: 956, y: 160, w: 250, h: 100, title: 'Class lists', body: 'Office-ready lists and exports' },
      { x: 956, y: 322, w: 250, h: 100, title: 'Backup & control', body: 'Recovery, logs, settings, training' },
    ];

    const shapes = [];
    for (const node of nodes) {
      const card = await addCard(slide, { x: node.x, y: node.y, w: node.w, h: node.h, fill: COLORS.paper, line: COLORS.border });
      setText(card, `${node.title}\n${node.body}`, {
        fontSize: 18,
        color: COLORS.ink,
        bold: false,
        align: 'center',
        valign: 'middle',
        insets: { top: 12, right: 16, bottom: 12, left: 16 },
      });
      shapes.push(card);
    }

    for (const node of shapes.slice(0, 2)) {
      await slide.shapes.connect(center, node, {
        kind: 'straight',
        fromSide: 'left',
        toSide: 'right',
        line: { style: 'solid', fill: COLORS.accent, width: 2 },
        head: { type: 'arrow', width: 'med', length: 'med' },
      });
    }
    await slide.shapes.connect(center, shapes[2], {
      kind: 'straight',
      fromSide: 'left',
      toSide: 'right',
      line: { style: 'solid', fill: COLORS.accent, width: 2 },
      head: { type: 'arrow', width: 'med', length: 'med' },
    });
    await slide.shapes.connect(center, shapes[3], {
      kind: 'straight',
      fromSide: 'right',
      toSide: 'left',
      line: { style: 'solid', fill: COLORS.accent, width: 2 },
      head: { type: 'arrow', width: 'med', length: 'med' },
    });
    await slide.shapes.connect(center, shapes[4], {
      kind: 'straight',
      fromSide: 'right',
      toSide: 'left',
      line: { style: 'solid', fill: COLORS.accent, width: 2 },
      head: { type: 'arrow', width: 'med', length: 'med' },
    });

    await addShape(
      slide,
      {
        geometry: 'rect',
        position: { left: 448, top: 438, width: 384, height: 28 },
        fill: { type: 'solid', color: COLORS.bg },
        line: { style: 'solid', fill: COLORS.bg, width: 0.1 },
      },
      'It behaves like an office system, not a feature list.',
      { fontSize: 14, color: COLORS.muted, align: 'center', insets: { top: 0, right: 0, bottom: 0, left: 0 } }
    );
    await addFooter(slide, 'Platform map');
    slide.speakerNotes.text = 'Show the product as an operating system for the office, not a feature list.';
  }

  // Slide 4
  {
    const slide = pres.slides.add();
    slide.setViewportSize(1280, 720);
    slide.background.fill = { type: 'solid', color: COLORS.bg };
    await addTitle(slide, 'From Search to Payment', 'A daily workflow that removes friction', 4);

    await addCard(slide, { x: 64, y: 156, w: 330, h: 470, fill: COLORS.paper, line: COLORS.border });
    await addShape(slide, { geometry: 'rect', position: { left: 88, top: 182, width: 120, height: 24 }, fill: { type: 'solid', color: COLORS.paper }, line: { style: 'solid', fill: COLORS.paper, width: 0.1 } }, 'Search learner', { fontSize: 18, bold: true, color: COLORS.ink, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
    await addCard(slide, { x: 88, y: 220, w: 282, h: 52, fill: COLORS.accentSoft, line: COLORS.accent, radius: 14, text: 'Type a name or ID', textOpts: { fontSize: 16, color: COLORS.accent, bold: true, align: 'center', valign: 'middle', insets: { top: 0, right: 0, bottom: 0, left: 0 } } });
    await addCard(slide, { x: 88, y: 292, w: 282, h: 50, fill: COLORS.bg, line: COLORS.border, radius: 14, text: 'N. Dube  •  Grade 7', textOpts: { fontSize: 15, color: COLORS.ink, align: 'center', valign: 'middle', insets: { top: 0, right: 0, bottom: 0, left: 0 } } });
    await addCard(slide, { x: 88, y: 352, w: 282, h: 50, fill: COLORS.bg, line: COLORS.border, radius: 14, text: 'A. Ncube  •  Grade 8', textOpts: { fontSize: 15, color: COLORS.ink, align: 'center', valign: 'middle', insets: { top: 0, right: 0, bottom: 0, left: 0 } } });
    await addCard(slide, { x: 88, y: 412, w: 282, h: 50, fill: COLORS.bg, line: COLORS.border, radius: 14, text: 'M. Phiri  •  Grade 6', textOpts: { fontSize: 15, color: COLORS.ink, align: 'center', valign: 'middle', insets: { top: 0, right: 0, bottom: 0, left: 0 } } });
    await addShape(slide, { geometry: 'rect', position: { left: 88, top: 488, width: 282, height: 110 }, fill: { type: 'solid', color: COLORS.warm }, line: { style: 'solid', fill: COLORS.accent, width: 1 } }, 'Found learner\nOpen account immediately\nSee current balance and last payment', { fontSize: 16, color: COLORS.ink, align: 'center', valign: 'middle' });

    await addCard(slide, { x: 438, y: 156, w: 390, h: 470, fill: COLORS.paper, line: COLORS.border });
    await addShape(slide, { geometry: 'rect', position: { left: 462, top: 182, width: 220, height: 24 }, fill: { type: 'solid', color: COLORS.paper }, line: { style: 'solid', fill: COLORS.paper, width: 0.1 } }, 'Account view', { fontSize: 18, bold: true, color: COLORS.ink, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
    await addCard(slide, { x: 462, y: 220, w: 342, h: 90, fill: COLORS.ink, line: COLORS.ink, radius: 18, text: 'Current balance\nR 1,240 owing', textOpts: { fontSize: 28, bold: true, color: '#ffffff', align: 'center', valign: 'middle' } });
    await addCard(slide, { x: 462, y: 328, w: 105, h: 94, fill: COLORS.accentSoft, line: COLORS.accent, text: 'Term\nCurrent', textOpts: { fontSize: 16, bold: true, color: COLORS.accent, align: 'center', valign: 'middle' } });
    await addCard(slide, { x: 579, y: 328, w: 105, h: 94, fill: COLORS.accentSoft, line: COLORS.accent, text: 'Last paid\n3 days ago', textOpts: { fontSize: 15, bold: true, color: COLORS.accent, align: 'center', valign: 'middle' } });
    await addCard(slide, { x: 696, y: 328, w: 108, h: 94, fill: COLORS.accentSoft, line: COLORS.accent, text: 'Status\nActive', textOpts: { fontSize: 16, bold: true, color: COLORS.accent, align: 'center', valign: 'middle' } });
    await addShape(slide, { geometry: 'rect', position: { left: 462, top: 442, width: 342, height: 150 }, fill: { type: 'solid', color: COLORS.bg }, line: { style: 'solid', fill: COLORS.border, width: 1 } }, 'Recent activity\n• Payment recorded: R 300\n• Statement printed\n• Fee balance updated', { fontSize: 16, color: COLORS.muted });

    await addCard(slide, { x: 862, y: 156, w: 354, h: 470, fill: COLORS.paper, line: COLORS.border });
    await addShape(slide, { geometry: 'rect', position: { left: 886, top: 182, width: 200, height: 24 }, fill: { type: 'solid', color: COLORS.paper }, line: { style: 'solid', fill: COLORS.paper, width: 0.1 } }, 'Record payment', { fontSize: 18, bold: true, color: COLORS.ink, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
    await addCard(slide, { x: 886, y: 220, w: 306, h: 52, fill: COLORS.bg, line: COLORS.border, radius: 14, text: 'Amount: R 300', textOpts: { fontSize: 16, bold: true, color: COLORS.ink, align: 'left', valign: 'middle' } });
    await addCard(slide, { x: 886, y: 284, w: 306, h: 52, fill: COLORS.bg, line: COLORS.border, radius: 14, text: 'Method: Cash / EFT / Mobile', textOpts: { fontSize: 16, color: COLORS.ink, align: 'left', valign: 'middle' } });
    await addCard(slide, { x: 886, y: 348, w: 306, h: 74, fill: COLORS.accentSoft, line: COLORS.accent, radius: 14, text: 'Save payment\nthen go straight to proof', textOpts: { fontSize: 18, bold: true, color: COLORS.accent, align: 'center', valign: 'middle' } });
    await addCard(slide, { x: 886, y: 438, w: 306, h: 150, fill: COLORS.ink, line: COLORS.ink, radius: 18, text: 'Result\nBalance updates\nReceipt prints\nStatement remains current', textOpts: { fontSize: 18, bold: true, color: '#ffffff', align: 'center', valign: 'middle' } });

    await addFooter(slide, 'Daily workflow');
    slide.speakerNotes.text = 'The value is speed. The staff should feel like the app removes friction, not adds steps.';
  }

  // Slide 5
  {
    const slide = pres.slides.add();
    slide.setViewportSize(1280, 720);
    slide.background.fill = { type: 'solid', color: COLORS.bg };
    await addTitle(slide, 'Receipts, Statements, and Class Lists', 'Outputs staff can produce without leaving the office flow', 5);

    await addCard(slide, { x: 64, y: 156, w: 600, h: 470, fill: COLORS.paper, line: COLORS.border });
    await addShape(slide, { geometry: 'rect', position: { left: 88, top: 182, width: 250, height: 24 }, fill: { type: 'solid', color: COLORS.paper }, line: { style: 'solid', fill: COLORS.paper, width: 0.1 } }, 'Statement preview', { fontSize: 20, bold: true, color: COLORS.ink, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
    await addCard(slide, { x: 88, y: 220, w: 552, h: 340, fill: COLORS.bg, line: COLORS.border, radius: 16 });
    await addShape(slide, { geometry: 'rect', position: { left: 112, top: 244, width: 504, height: 24 }, fill: { type: 'solid', color: COLORS.bg }, line: { style: 'solid', fill: COLORS.bg, width: 0.1 } }, 'School Foundry Statement', { fontSize: 26, bold: true, typeface: TITLE_FONT, color: COLORS.ink, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
    await addShape(slide, { geometry: 'rect', position: { left: 112, top: 286, width: 504, height: 200 }, fill: { type: 'solid', color: COLORS.bg }, line: { style: 'solid', fill: COLORS.bg, width: 0.1 } }, 'Learner: N. Dube\nAccount balance: R 1,240 owing\nPayments this term: R 900\nLast payment: R 300 on 24 May\n\nUse this for a print-ready statement that the office can hand over immediately.', { fontSize: 17, color: COLORS.muted, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
    await addPill(slide, { x: 112, y: 510, w: 112, h: 34, text: 'Print', fill: COLORS.accentSoft, line: COLORS.accent });
    await addPill(slide, { x: 236, y: 510, w: 126, h: 34, text: 'PDF export', fill: COLORS.warm, line: COLORS.accent });
    await addPill(slide, { x: 374, y: 510, w: 134, h: 34, text: 'Excel export', fill: COLORS.warm, line: COLORS.accent });
    await addPill(slide, { x: 520, y: 510, w: 120, h: 34, text: 'Receipt', fill: COLORS.accentSoft, line: COLORS.accent });

    await addCard(slide, { x: 694, y: 156, w: 522, h: 470, fill: COLORS.paper, line: COLORS.border });
    await addShape(slide, { geometry: 'rect', position: { left: 718, top: 182, width: 200, height: 24 }, fill: { type: 'solid', color: COLORS.paper }, line: { style: 'solid', fill: COLORS.paper, width: 0.1 } }, 'Class list + exports', { fontSize: 20, bold: true, color: COLORS.ink, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
    await addShape(slide, { geometry: 'rect', position: { left: 718, top: 226, width: 474, height: 242 }, fill: { type: 'solid', color: COLORS.paper }, line: { style: 'solid', fill: COLORS.border, width: 1 } }, 'Learner\tBalance\tStatus\nN. Dube\tR 1,240\tOwing\nA. Ncube\tR 0\tPaid\nM. Phiri\tR 480\tOwing\nT. Moyo\tR 150\tLate\nS. Banda\tR 0\tPaid\n\nExcel and PDF exports are first-class outputs.', { fontSize: 16, color: COLORS.ink, insets: { top: 18, right: 18, bottom: 18, left: 18 } });
    await addShape(slide, { geometry: 'rect', position: { left: 718, top: 488, width: 474, height: 124 }, fill: { type: 'solid', color: COLORS.accentSoft }, line: { style: 'solid', fill: COLORS.accent, width: 1 } }, 'Why this matters\nReceipts, statements, and class lists are ready when the office needs them - no separate spreadsheet wrangling.', { fontSize: 18, color: COLORS.ink, bold: true, align: 'center', valign: 'middle' });
    await addFooter(slide, 'Outputs and export flows');
    slide.speakerNotes.text = 'Make it clear that output is part of the product, not a side feature.';
  }

  // Slide 6
  {
    const slide = pres.slides.add();
    slide.setViewportSize(1280, 720);
    slide.background.fill = { type: 'solid', color: COLORS.bg };
    await addTitle(slide, 'Why Offline Wins', 'The strongest reason to buy this system', 6);

    const offlineItems = [
      { x: 64, title: 'No internet dependency', body: 'The office keeps working during outages and weak connectivity.', accent: COLORS.accent },
      { x: 438, title: 'Local data ownership', body: 'Data stays on the school machine and backup drive.', accent: COLORS.success },
      { x: 812, title: 'Fast local printing', body: 'Receipts and statements go straight to the printer.', accent: COLORS.danger },
    ];
    for (const item of offlineItems) {
      await addBulletCard(slide, { x: item.x, y: 160, w: 344, h: 180, heading: item.title, bullets: [item.body], accent: item.accent });
    }

    await addCard(slide, { x: 64, y: 380, w: 1152, h: 220, fill: COLORS.paper, line: COLORS.border });
    const chain = [
      { x: 112, label: 'Laptop app' },
      { x: 330, label: 'SQLite file' },
      { x: 548, label: 'Receipt printer' },
      { x: 766, label: 'Backup drive' },
      { x: 984, label: 'Restore when needed' },
    ];
    const chainShapes = [];
    for (const step of chain) {
      const box = await addCard(slide, { x: step.x, y: 444, w: 154, h: 92, fill: COLORS.bg, line: COLORS.border, radius: 16, text: step.label, textOpts: { fontSize: 18, bold: true, color: COLORS.ink, align: 'center', valign: 'middle' } });
      chainShapes.push(box);
    }
    for (let i = 0; i < chainShapes.length - 1; i += 1) {
      await slide.shapes.connect(chainShapes[i], chainShapes[i + 1], {
        kind: 'straight',
        fromSide: 'right',
        toSide: 'left',
        line: { style: 'solid', fill: COLORS.accent, width: 2 },
        head: { type: 'arrow', width: 'med', length: 'med' },
      });
    }
    await addFooter(slide, 'Offline value');
    slide.speakerNotes.text = 'This is the strongest reason to buy. Say it plainly and with confidence.';
  }

  // Slide 7
  {
    const slide = pres.slides.add();
    slide.setViewportSize(1280, 720);
    slide.background.fill = { type: 'solid', color: COLORS.bg };
    await addTitle(slide, 'Why This Pays Back', 'School value on one side, business value on the other', 7);
    await addBulletCard(slide, {
      x: 64,
      y: 160,
      w: 530,
      h: 410,
      heading: 'Value for the school',
      bullets: [
        'Faster office service',
        'Fewer receipting mistakes',
        'Cleaner audit trail',
        'Better parent trust',
        'Less reconciliation stress',
      ],
      accent: COLORS.success,
    });
    await addBulletCard(slide, {
      x: 686,
      y: 160,
      w: 530,
      h: 410,
      heading: 'Value for the business',
      bullets: [
        'One-time deployment creates the first sale',
        'Training and support create ongoing revenue',
        'Offline bundles increase the average order value',
        'Cloud sync becomes the next upsell',
      ],
      accent: COLORS.accent,
    });
    await addShape(slide, { geometry: 'rect', position: { left: 64, top: 592, width: 1152, height: 50 }, fill: { type: 'solid', color: COLORS.paper }, line: { style: 'solid', fill: COLORS.border, width: 1 } }, 'The deck should feel like a practical purchase, not a speculative software demo.', { fontSize: 16, color: COLORS.muted, align: 'center', valign: 'middle' });
    await addFooter(slide, 'Product-to-financial linkage');
    slide.speakerNotes.text = 'Tie product value to commercial value without sounding pushy.';
  }

  // Slide 8
  {
    const slide = pres.slides.add();
    slide.setViewportSize(1280, 720);
    slide.background.fill = { type: 'solid', color: COLORS.bg };
    await addTitle(slide, 'Admin Control Without Chaos', 'The system stays safe without becoming hard to use', 8);
    const controls = [
      { x: 64, y: 160, title: 'User accounts', body: 'Roles and permissions' },
      { x: 438, y: 160, title: 'Activity logs', body: 'Audit trail for changes' },
      { x: 812, y: 160, title: 'Branding and settings', body: 'School identity and defaults' },
      { x: 64, y: 336, title: 'Backup and restore', body: 'Recovery when things go wrong' },
      { x: 438, y: 336, title: 'Maintenance tools', body: 'Reset, repair, and recover' },
      { x: 812, y: 336, title: 'Built-in user guide', body: 'Training support for staff' },
    ];
    for (const c of controls) {
      await addCard(slide, { x: c.x, y: c.y, w: 344, h: 138, fill: COLORS.paper, line: COLORS.border });
      await addShape(slide, { geometry: 'rect', position: { left: c.x + 18, top: c.y + 18, width: 220, height: 28 }, fill: { type: 'solid', color: COLORS.paper }, line: { style: 'solid', fill: COLORS.paper, width: 0.1 } }, c.title, { fontSize: 19, bold: true, color: COLORS.ink, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
      await addShape(slide, { geometry: 'rect', position: { left: c.x + 18, top: c.y + 58, width: 300, height: 40 }, fill: { type: 'solid', color: COLORS.paper }, line: { style: 'solid', fill: COLORS.paper, width: 0.1 } }, c.body, { fontSize: 16, color: COLORS.muted, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
    }
    await addShape(slide, { geometry: 'rect', position: { left: 64, top: 508, width: 1152, height: 102 }, fill: { type: 'solid', color: COLORS.accentSoft }, line: { style: 'solid', fill: COLORS.accent, width: 1 } }, 'The administrator gets control. The office staff gets a simple flow. That separation is what makes the product safe at small scale and usable at real scale.', { fontSize: 18, color: COLORS.ink, align: 'center', valign: 'middle' });
    await addFooter(slide, 'Admin controls');
    slide.speakerNotes.text = 'The system needs to be easy for office staff, but still safe for the administrator.';
  }

  // Slide 9
  {
    const slide = pres.slides.add();
    slide.setViewportSize(1280, 720);
    slide.background.fill = { type: 'solid', color: COLORS.bg };
    await addTitle(slide, 'What the Offline Bundle Includes', 'A practical first-step offer that is easy to understand', 9);
    await addBulletCard(slide, {
      x: 64,
      y: 160,
      w: 548,
      h: 420,
      heading: 'Bundle',
      bullets: [
        'Desktop app install',
        'Local database setup',
        'Branding setup',
        'Staff training',
        'Receipting and statements',
        'PDF and Excel export workflow',
        'Backup guidance',
      ],
      accent: COLORS.accent,
    });
    await addBulletCard(slide, {
      x: 668,
      y: 160,
      w: 548,
      h: 420,
      heading: 'Optional later',
      bullets: [
        'Cloud sync',
        'Remote access',
        'Parent portal',
        'Messaging add-ons',
      ],
      accent: COLORS.success,
    });
    await addShape(slide, { geometry: 'rect', position: { left: 64, top: 604, width: 1152, height: 34 }, fill: { type: 'solid', color: COLORS.paper }, line: { style: 'solid', fill: COLORS.border, width: 1 } }, 'Frame the offline bundle as the practical first step. Cloud comes later if the school wants it.', { fontSize: 15, color: COLORS.muted, align: 'center', valign: 'middle' });
    await addFooter(slide, 'Offline bundle offer');
    slide.speakerNotes.text = 'Frame the offline bundle as the practical first step. Cloud comes later if the school wants it.';
  }

  // Slide 10
  {
    const slide = pres.slides.add();
    slide.setViewportSize(1280, 720);
    slide.background.fill = { type: 'solid', color: COLORS.bg };
    await addTitle(slide, 'Roadmap', 'Keep the first win simple, then expand from there', 10);
    const milestones = [
      { x: 96, label: 'Now', body: 'Reliable offline office workflow', fill: COLORS.paper, line: COLORS.border, accent: COLORS.accent },
      { x: 436, label: 'Next', body: 'Cloud edition for remote access and multi-device use', fill: COLORS.paper, line: COLORS.border, accent: COLORS.success },
      { x: 776, label: 'Later', body: 'Parent-facing features and central reporting', fill: COLORS.paper, line: COLORS.border, accent: COLORS.ink },
    ];
    const boxes = [];
    for (const m of milestones) {
      const box = await addCard(slide, { x: m.x, y: 230, w: 284, h: 236, fill: m.fill, line: m.line });
      setText(box, `${m.label}\n${m.body}`, {
        fontSize: 26,
        bold: true,
        color: COLORS.ink,
        align: 'center',
        valign: 'middle',
        insets: { top: 20, right: 20, bottom: 20, left: 20 },
      });
      boxes.push(box);
      await addRect(slide, { x: m.x + 28, y: 250, w: 60, h: 5, fill: m.accent, line: m.accent });
    }
    await slide.shapes.connect(boxes[0], boxes[1], {
      kind: 'straight',
      fromSide: 'right',
      toSide: 'left',
      line: { style: 'solid', fill: COLORS.accent, width: 2 },
      head: { type: 'arrow', width: 'med', length: 'med' },
    });
    await slide.shapes.connect(boxes[1], boxes[2], {
      kind: 'straight',
      fromSide: 'right',
      toSide: 'left',
      line: { style: 'solid', fill: COLORS.accent, width: 2 },
      head: { type: 'arrow', width: 'med', length: 'med' },
    });
    await addShape(slide, { geometry: 'rect', position: { left: 64, top: 520, width: 1152, height: 90 }, fill: { type: 'solid', color: COLORS.warm }, line: { style: 'solid', fill: COLORS.accent, width: 1 } }, 'The first win is the offline install. Everything else should grow from real usage, not from a roadmap fantasy.', { fontSize: 18, color: COLORS.ink, align: 'center', valign: 'middle' });
    await addFooter(slide, 'Roadmap');
    slide.speakerNotes.text = 'Keep the roadmap short and credible. The first win is the offline install.';
  }

  // Slide 11
  {
    const slide = pres.slides.add();
    slide.setViewportSize(1280, 720);
    slide.background.fill = { type: 'solid', color: COLORS.bg };
    await addTitle(slide, 'What We Want From the Pilot', 'A real-school trial should tell us what to keep and what to improve', 11);
    await addBulletCard(slide, {
      x: 64,
      y: 164,
      w: 1152,
      h: 256,
      heading: 'We need to learn',
      bullets: [
        'Is it easy for office staff to use?',
        'Are the outputs clear enough?',
        'Does printing work with the school setup?',
        'Does the account view feel fast?',
        'What should improve first?',
      ],
      accent: COLORS.accent,
    });
    await addShape(slide, { geometry: 'rect', position: { left: 64, top: 456, width: 1152, height: 124 }, fill: { type: 'solid', color: COLORS.paper }, line: { style: 'solid', fill: COLORS.border, width: 1 } }, 'Pilot ask\nInstall it in one office, run it for real work, and let the staff tell us what makes their day easier.', { fontSize: 22, color: COLORS.ink, bold: true, align: 'center', valign: 'middle' });
    await addShape(slide, { geometry: 'rect', position: { left: 64, top: 600, width: 1152, height: 30 }, fill: { type: 'solid', color: COLORS.bg }, line: { style: 'solid', fill: COLORS.bg, width: 0.1 } }, 'Pilot success is measured by clarity, speed, and trust - not by how much of the roadmap gets discussed.', { fontSize: 14, color: COLORS.muted, align: 'center', valign: 'middle' });
    await addFooter(slide, 'Pilot ask');
    slide.speakerNotes.text = 'Close with a real pilot question, not a generic marketing close.';
  }

  const pptx = await PresentationFile.exportPptx(pres);
  await pptx.save(outputPptx);
  await writeFile(sourceJsx, `// Generated by scripts/generate-uncle-presentation.mjs\n// Source deck rebuild notes live in docs/UNCLE_PRESENTATION_DRAFT.md\n`);
}

await buildDeck();
