import type { PrintDocumentOptions } from './types';

export async function printDocument(options: PrintDocumentOptions): Promise<string | null> {
  try {
    console.log('[print-service] Calling printToPdf with:', {
      filename: options.filename,
      title: options.title,
      htmlLength: options.html.length,
    });
    const result = await window.api.printToPdf({
      html: options.html,
      filename: options.filename,
      title: options.title,
    });

    console.log('[print-service] printToPdf result:', result);

    if (result.success && result.filePath) {
      console.log('[print-service] PDF generated successfully, opening:', result.filePath);
      await window.api.openFileForPrint(result.filePath);
      return result.filePath;
    } else {
      console.error('[print-service] PDF generation failed:', result.error);
      return null;
    }
  } catch (err) {
    console.error('[print-service] Print error:', err);
    return null;
  }
}
