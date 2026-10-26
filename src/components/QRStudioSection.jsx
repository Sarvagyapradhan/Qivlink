import React, { useState, useEffect, useRef } from 'react';
import { QrCode, Download, Copy, Check, Sliders, Shield, Palette } from 'lucide-react';
import { renderToCanvas, downloadQrPng, downloadQrSvg, copyQrToClipboard } from '../utils/qrGenerator.js';

const COLOR_PRESETS = [
  { name: 'Slate', dark: '#0f172a', light: '#ffffff' },
  { name: 'Midnight', dark: '#1e1b4b', light: '#ffffff' },
  { name: 'Forest', dark: '#064e3b', light: '#ffffff' },
  { name: 'Plum', dark: '#4c0519', light: '#ffffff' },
  { name: 'Cobalt', dark: '#1e3a8a', light: '#ffffff' },
  { name: 'Charcoal', dark: '#18181b', light: '#f4f4f5' }
];

export default function QRStudioSection({ initialValue = '', showToast }) {
  const [content, setContent] = useState(initialValue || window.location.origin);
  const [colorDark, setColorDark] = useState('#0f172a');
  const [colorLight, setColorLight] = useState('#ffffff');
  const [transparentBg, setTransparentBg] = useState(false);
  const [errorLevel, setErrorLevel] = useState('M');
  const [margin, setMargin] = useState(2);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const canvasRef = useRef(null);

  useEffect(() => {
    if (initialValue) {
      setContent(initialValue);
    }
  }, [initialValue]);

  // Re-render canvas whenever parameters change
  useEffect(() => {
    if (!canvasRef.current || !content) return;
    const finalLight = transparentBg ? '#00000000' : colorLight;

    renderToCanvas(canvasRef.current, content, {
      colorDark,
      colorLight: finalLight,
      errorCorrectionLevel: errorLevel,
      margin,
      width: 280
    }).catch(err => {
      console.warn('QR render error:', err);
    });
  }, [content, colorDark, colorLight, transparentBg, errorLevel, margin]);

  const handleDownloadPng = async () => {
    try {
      setIsExporting(true);
      const finalLight = transparentBg ? '#00000000' : colorLight;
      await downloadQrPng(content, 'qivlink-qr-1024.png', 1024, {
        colorDark,
        colorLight: finalLight,
        errorCorrectionLevel: errorLevel,
        margin
      });
      showToast('Offline PNG exported in 1024px', 'success');
    } catch (e) {
      showToast('Failed to export PNG', 'danger');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadSvg = async () => {
    try {
      setIsExporting(true);
      const finalLight = transparentBg ? '#00000000' : colorLight;
      await downloadQrSvg(content, 'qivlink-qr-vector.svg', {
        colorDark,
        colorLight: finalLight,
        errorCorrectionLevel: errorLevel,
        margin
      });
      showToast('Offline SVG vector downloaded', 'success');
    } catch (e) {
      showToast('Failed to export SVG', 'danger');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyClipboard = async () => {
    try {
      const finalLight = transparentBg ? '#00000000' : colorLight;
      await copyQrToClipboard(content, 512, {
        colorDark,
        colorLight: finalLight,
        errorCorrectionLevel: errorLevel,
        margin
      });
      setCopied(true);
      showToast('QR code copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      showToast('Could not copy to clipboard (try PNG download)', 'warning');
    }
  };

  return (
    <div className="qr-studio-wrapper">
      <div className="glass-panel">
        <div className="panel-header">
          <div className="panel-title-group">
            <div className="panel-icon-badge">
              <QrCode size={18} />
            </div>
            <div>
              <h2 className="panel-title">QR Studio</h2>
              <p className="panel-description">
                Generate offline vector SVG or high-resolution PNG.
              </p>
            </div>
          </div>
        </div>

        <div className="qr-studio-grid">
          {/* Controls Column */}
          <div className="qr-controls">
            <div className="form-group">
              <label htmlFor="qr-content" className="form-label">Data / Target URL</label>
              <input
                id="qr-content"
                type="text"
                className="input-text no-icon"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter URL or text to encode..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Color Presets</label>
              <div className="color-picker-grid">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className={`color-swatch-btn ${colorDark === preset.dark ? 'active' : ''}`}
                    style={{ backgroundColor: preset.dark }}
                    onClick={() => {
                      setColorDark(preset.dark);
                      setColorLight(preset.light);
                    }}
                    title={preset.name}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Foreground Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={colorDark}
                    onChange={(e) => setColorDark(e.target.value)}
                    style={{ width: '36px', height: '36px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }}
                  />
                  <span className="input-mono" style={{ fontSize: '0.84rem' }}>{colorDark}</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Error Correction</label>
                <select
                  className="input-text no-icon"
                  value={errorLevel}
                  onChange={(e) => setErrorLevel(e.target.value)}
                  style={{ padding: '8px 12px' }}
                >
                  <option value="L">Low (7% recovery)</option>
                  <option value="M">Medium (15% recovery)</option>
                  <option value="Q">Quartile (25% recovery)</option>
                  <option value="H">High (30% recovery)</option>
                </select>
              </div>
            </div>

            <div className="toggle-row">
              <div className="toggle-info">
                <span className="toggle-title">Transparent Background</span>
                <span className="toggle-desc">Ideal for overlaying on presentations, designs, or colored media</span>
              </div>
              <label className="switch-pill">
                <input
                  type="checkbox"
                  checked={transparentBg}
                  onChange={(e) => setTransparentBg(e.target.checked)}
                />
                <span className="slider-round" />
              </label>
            </div>
          </div>

          {/* Preview & Export Column */}
          <div className="qr-preview-panel">
            <div className="qr-canvas-holder">
              <canvas ref={canvasRef} />
            </div>

            <div className="qr-export-buttons">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleDownloadSvg}
                disabled={isExporting}
                title="Lossless SVG for vector design & print"
              >
                <Download size={14} />
                <span>SVG Vector</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleDownloadPng}
                disabled={isExporting}
                title="1024px High Resolution PNG"
              >
                <Download size={14} />
                <span>PNG (1024)</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCopyClipboard}
                title="Copy raster image directly to clipboard"
              >
                {copied ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div style={{ marginTop: '12px', fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>
              Rendered completely in-browser
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
