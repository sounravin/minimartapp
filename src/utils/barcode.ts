import JsBarcode from 'jsbarcode';

// Audio beep synthesizer using Web Audio API for fast barcode scan sound
export function playScanBeep() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, audioCtx.currentTime); // Beep frequency
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch (err) {
    console.warn('Audio Context not allowed or supported', err);
  }
}

// Render barcode to an SVG or Canvas element
export function renderBarcode(element: SVGElement | HTMLCanvasElement, code: string) {
  if (!element || !code) return;
  try {
    JsBarcode(element, code, {
      format: 'CODE128',
      lineColor: '#1e293b',
      width: 2,
      height: 50,
      displayValue: true,
      fontSize: 14,
      margin: 8,
    });
  } catch (e) {
    console.error('Barcode rendering error:', e);
  }
}
