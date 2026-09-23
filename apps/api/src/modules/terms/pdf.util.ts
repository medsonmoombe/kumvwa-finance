import PDFDocument from 'pdfkit';

/**
 * Renders a terms document as a simple A4 PDF: bold title, grey subtitle
 * (version + publication date), then the plain-text body. Terms bodies are
 * plain text by design (the same string serves app screens, the console and
 * this PDF), so no rich layout is needed — just readable, printable text.
 */
export function textToPdf(
  title: string,
  subtitle: string,
  body: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(15).font('Helvetica-Bold').text(title);
    doc.fontSize(9).font('Helvetica').fillColor('#666666').text(subtitle);
    doc.moveDown(0.8).fillColor('#000000');
    doc.fontSize(10).font('Helvetica').text(body, { lineGap: 4 });
    doc.end();
  });
}
