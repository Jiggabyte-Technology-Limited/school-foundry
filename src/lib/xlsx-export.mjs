import JSZip from 'jszip';

const XML_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnLetter(columnIndex) {
  let n = columnIndex;
  let letters = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function sanitizeSheetName(name) {
  const cleaned = String(name || 'Sheet1')
    .replace(/[\[\]\*\/\\\?\:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 31) || 'Sheet1';
}

function buildCellXml(cellRef, value, styleId = 0, type = 'string') {
  if (value === null || value === undefined || value === '') {
    return `<c r="${cellRef}" s="${styleId}"/>`;
  }

  if (type === 'number' || type === 'currency' || type === 'integer') {
    const numeric = Number(value);
    return `<c r="${cellRef}" s="${styleId}"><v>${Number.isFinite(numeric) ? numeric : 0}</v></c>`;
  }

  if (type === 'formula') {
    return `<c r="${cellRef}" s="${styleId}"><f>${escapeXml(value)}</f></c>`;
  }

  return `<c r="${cellRef}" t="inlineStr" s="${styleId}"><is><t>${escapeXml(value)}</t></is></c>`;
}

function buildRowXml(rowNumber, cells) {
  const rowXml = cells
    .map(({ ref, value, styleId, type }) => buildCellXml(ref, value, styleId, type))
    .join('');
  return `<row r="${rowNumber}">${rowXml}</row>`;
}

function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${XML_NS}">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="#,##0.00"/>
    <numFmt numFmtId="165" formatCode="yyyy-mm-dd"/>
  </numFmts>
  <fonts count="4">
    <font><sz val="11"/><name val="Arial"/></font>
    <font><b/><sz val="16"/><name val="Arial"/></font>
    <font><i/><sz val="11"/><color rgb="FF6B7280"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF97316"/><bgColor rgb="FFF97316"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left/><right/><top/><bottom style="thin"><color rgb="FFE5E7EB"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="9">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1">
      <alignment horizontal="center"/>
    </xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1">
      <alignment horizontal="center"/>
    </xf>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFill="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1">
      <alignment horizontal="right"/>
    </xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1">
      <alignment horizontal="right"/>
    </xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1">
      <alignment horizontal="left"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1">
      <alignment horizontal="left"/>
    </xf>
  </cellXfs>
</styleSheet>`;
}

function buildWorkbookXml(sheetName) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${XML_NS}" xmlns:r="${REL_NS}">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

function buildWorkbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKG_REL_NS}">
  <Relationship Id="rId1" Type="${REL_NS}/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="${REL_NS}/styles" Target="styles.xml"/>
</Relationships>`;
}

function buildRootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKG_REL_NS}">
  <Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function buildContentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;
}

function buildSheetXml(spec) {
  const columnCount = spec.columns.length;
  const topRows = spec.topRows || [];
  const summaryRows = spec.summaryRows || [];
  const dataStartRow = topRows.length + 2;
  const headerRowNumber = topRows.length + 1;
  const dataEndRow = dataStartRow + spec.rows.length - 1;

  const rows = [];
  let currentRow = 1;

  for (const topRow of topRows) {
    const cells = [];
    const mergedCells = topRow.mergeAcross ?? columnCount - 1;
    cells.push({
      ref: `A${currentRow}`,
      value: topRow.value,
      styleId: topRow.styleId ?? 1,
      type: 'string',
    });
    rows.push(buildRowXml(currentRow, cells));
    if (mergedCells > 0) {
      spec.merges.push(`A${currentRow}:${columnLetter(mergedCells + 1)}${currentRow}`);
    }
    currentRow++;
  }

  const headerCells = spec.columns.map((column, index) => ({
    ref: `${columnLetter(index + 1)}${currentRow}`,
    value: column.header,
    styleId: 3,
    type: 'string',
  }));
  rows.push(buildRowXml(currentRow, headerCells));
  currentRow++;

  spec.rows.forEach((row, rowIndex) => {
    const cells = spec.columns.map((column, index) => {
      const value = row[column.key];
      let type = 'string';
      let styleId = 4;
      if (column.type === 'currency') {
        type = 'currency';
        styleId = 6;
      } else if (column.type === 'number') {
        type = 'number';
        styleId = 5;
      } else if (column.type === 'integer') {
        type = 'integer';
        styleId = 5;
      } else if (column.type === 'formula') {
        type = 'formula';
        styleId = 5;
      }
      return {
        ref: `${columnLetter(index + 1)}${currentRow}`,
        value,
        styleId,
        type,
      };
    });
    rows.push(buildRowXml(currentRow, cells));
    currentRow++;
  });

  if (summaryRows.length > 0) {
    currentRow += 1;
    for (const summaryRow of summaryRows) {
      const cells = [
        {
          ref: `A${currentRow}`,
          value: summaryRow.label,
          styleId: summaryRow.labelStyleId ?? 7,
          type: 'string',
        },
        {
          ref: `B${currentRow}`,
          value: summaryRow.value,
          styleId: summaryRow.valueStyleId ?? 6,
          type: summaryRow.valueType ?? 'string',
        },
      ];
      rows.push(buildRowXml(currentRow, cells));
      currentRow++;
    }
  }

  const lastRow = currentRow - 1;
  const lastColumn = columnLetter(columnCount);
  const colWidths = spec.columns
    .map((column, index) =>
      column.width
        ? `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`
        : ''
    )
    .join('');
  const mergeXml =
    spec.merges.length > 0
      ? `<mergeCells count="${spec.merges.length}">${spec.merges.map(mergeRef => `<mergeCell ref="${mergeRef}"/>`).join('')}</mergeCells>`
      : '';
  const freezeXml = spec.freezeRows
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${spec.freezeRows}" topLeftCell="A${spec.freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const autoFilterXml = spec.autoFilter && spec.rows.length > 0
    ? `<autoFilter ref="A${headerRowNumber}:${lastColumn}${dataEndRow}"/>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${XML_NS}" xmlns:r="${REL_NS}">
  ${freezeXml}
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${colWidths}</cols>
  <sheetData>${rows.join('')}</sheetData>
  ${mergeXml}
  ${autoFilterXml}
</worksheet>`;
}

export async function buildWorkbookBytes(spec) {
  const zip = new JSZip();
  const safeSheetName = sanitizeSheetName(spec.sheetName);
  const merges = [];
  const sheetXml = buildSheetXml({ ...spec, merges });

  zip.file('[Content_Types].xml', buildContentTypesXml());
  zip.file('_rels/.rels', buildRootRelsXml());
  zip.file('xl/workbook.xml', buildWorkbookXml(safeSheetName));
  zip.file('xl/_rels/workbook.xml.rels', buildWorkbookRelsXml());
  zip.file('xl/styles.xml', buildStylesXml());
  zip.file('xl/worksheets/sheet1.xml', sheetXml);

  return zip.generateAsync({ type: 'uint8array' });
}

export function textCell(value, width = 18) {
  return { value, type: 'text', width };
}

export function currencyCell(value, width = 16) {
  return { value, type: 'currency', width };
}

export function numberCell(value, width = 12) {
  return { value, type: 'number', width };
}
