export function getBasePrintStyles(): string {
  return `
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12px;
        line-height: 1.4;
        color: #000;
        background: #fff;
      }
      @page {
        size: A4;
        margin: 10mm;
      }
    </style>
  `;
}
