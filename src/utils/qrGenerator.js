import QRCode from 'qrcode';

/**
 * Generate SVG string representation of QR code (lossless vector)
 */
export async function generateSvgQr(text, options = {}) {
  const {
    colorDark = '#0f172a',
    colorLight = '#ffffff',
    errorCorrectionLevel = 'M',
    margin = 2
  } = options;

  return new Promise((resolve, reject) => {
    QRCode.toString(
      text,
      {
        type: 'svg',
        errorCorrectionLevel,
        margin,
        color: {
          dark: colorDark,
          light: colorLight
        }
      },
      (err, string) => {
        if (err) reject(err);
        else resolve(string);
      }
    );
  });
}

/**
 * Render QR directly into an HTML Canvas element
 */
export async function renderToCanvas(canvas, text, options = {}) {
  const {
    colorDark = '#0f172a',
    colorLight = '#ffffff',
    errorCorrectionLevel = 'M',
    margin = 2,
    width = 320
  } = options;

  return new Promise((resolve, reject) => {
    QRCode.toCanvas(
      canvas,
      text,
      {
        width,
        errorCorrectionLevel,
        margin,
        color: {
          dark: colorDark,
          light: colorLight
        }
      },
      err => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

/**
 * Export QR code as downloadable PNG at desired resolution
 */
export async function downloadQrPng(text, filename = 'qivlink-qr.png', size = 1024, options = {}) {
  const {
    colorDark = '#0f172a',
    colorLight = '#ffffff',
    errorCorrectionLevel = 'M',
    margin = 2
  } = options;

  const dataUrl = await QRCode.toDataURL(text, {
    width: size,
    errorCorrectionLevel,
    margin,
    color: {
      dark: colorDark,
      light: colorLight
    }
  });

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Export QR code as downloadable SVG vector
 */
export async function downloadQrSvg(text, filename = 'qivlink-qr.svg', options = {}) {
  const svgString = await generateSvgQr(text, options);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy high-res QR code image directly to system clipboard
 */
export async function copyQrToClipboard(text, size = 512, options = {}) {
  const {
    colorDark = '#0f172a',
    colorLight = '#ffffff',
    errorCorrectionLevel = 'M',
    margin = 2
  } = options;

  const dataUrl = await QRCode.toDataURL(text, {
    width: size,
    errorCorrectionLevel,
    margin,
    color: {
      dark: colorDark,
      light: colorLight
    }
  });

  const res = await fetch(dataUrl);
  const blob = await res.blob();
  
  if (navigator.clipboard && window.ClipboardItem) {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    return true;
  } else {
    throw new Error('Clipboard image write is not supported in this browser environment');
  }
}
