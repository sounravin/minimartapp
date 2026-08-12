import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, CheckCircle, Volume2, AlertCircle, RefreshCw, Barcode } from 'lucide-react';
import { playScanBeep } from '../utils/barcode';
import { Language } from '../types';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  language: Language;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  language,
}) => {
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [macroZoom, setMacroZoom] = useState<number>(1.5);
  const [availableCameras, setAvailableCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCamId, setSelectedCamId] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountedRef = useRef(false);
  const scanLockRef = useRef(false);
  const lastScanTimeRef = useRef(0);
  const lastScanCodeRef = useRef<string | null>(null);

  // Apply Macro focus & zoom constraints to active video track
  const applyMacroConstraints = async (zoomValue: number) => {
    try {
      const videoEl = document.querySelector('#camera-barcode-reader video') as HTMLVideoElement;
      if (!videoEl || !videoEl.srcObject) return;
      const stream = videoEl.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      if (!track || typeof track.applyConstraints !== 'function') return;

      const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
      const advancedOpts: any = {};

      if (caps.focusMode && Array.isArray(caps.focusMode)) {
        if (caps.focusMode.includes('macro')) {
          advancedOpts.focusMode = 'macro';
        } else if (caps.focusMode.includes('continuous')) {
          advancedOpts.focusMode = 'continuous';
        }
      } else {
        advancedOpts.focusMode = 'continuous';
      }

      if (caps.zoom) {
        const minZ = caps.zoom.min || 1;
        const maxZ = caps.zoom.max || 3;
        const targetZ = Math.min(Math.max(zoomValue, minZ), maxZ);
        advancedOpts.zoom = targetZ;
      } else {
        advancedOpts.zoom = zoomValue;
      }

      await track.applyConstraints({ advanced: [advancedOpts] } as any);
    } catch (err) {
      console.warn('Macro focus constraint application note:', err);
    }
  };

  useEffect(() => {
    if (scannerRef.current?.isScanning) {
      applyMacroConstraints(macroZoom);
    }
  }, [macroZoom]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.warn('Error stopping scanner:', e);
      }
      scannerRef.current = null;
    }

    // Force release media stream tracks across document to free camera hardware
    try {
      const allVideos = document.querySelectorAll('video');
      allVideos.forEach((video) => {
        if (video.srcObject) {
          const stream = video.srcObject as MediaStream;
          stream.getTracks().forEach((track) => track.stop());
          video.srcObject = null;
        }
      });
    } catch (err) {
      console.warn('Error releasing video tracks:', err);
    }
  };

  const startScanner = async () => {
    if (!isOpen) return;
    setIsInitializing(true);
    setErrorMsg(null);

    // Stop any active scanner instance and release media tracks
    await stopScanner();

    // 350ms delay to allow hardware resources to free completely
    await new Promise((resolve) => setTimeout(resolve, 350));

    if (!mountedRef.current) return;

    const elementId = 'camera-barcode-reader';
    const element = document.getElementById(elementId);

    if (!element) {
      console.error('Camera element not found in DOM yet');
      setErrorMsg(
        language === 'km'
          ? 'ពុំអាចស្វែងរកទីតាំងកាមេរ៉ាក្នុងទំព័របានទេ សូមព្យាយាមម្តងទៀត'
          : 'Camera display element not found. Please try again.'
      );
      setIsInitializing(false);
      return;
    }

    try {
      const html5Qrcode = new Html5Qrcode(elementId);
      scannerRef.current = html5Qrcode;

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 160 },
      };

      const handleScanSuccess = (decodedText: string) => {
        const now = Date.now();
        if (scanLockRef.current) return;
        if (lastScanCodeRef.current === decodedText && now - lastScanTimeRef.current < 2500) return;
        if (now - lastScanTimeRef.current < 1200) return;

        scanLockRef.current = true;
        lastScanCodeRef.current = decodedText;
        lastScanTimeRef.current = now;

        playScanBeep();
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
          try { window.navigator.vibrate([100]); } catch (e) {}
        }

        setLastScanned(decodedText);
        onScan(decodedText);

        setTimeout(() => {
          scanLockRef.current = false;
          setLastScanned(null);
        }, 1800);
      };

      let started = false;

      // Strategy 1: Check available camera IDs & detect Macro/Ultra Wide lenses
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          setAvailableCameras(cameras);
          
          let targetCam = selectedCamId ? cameras.find((c) => c.id === selectedCamId) : null;
          if (!targetCam) {
            const macroCam = cameras.find((c) => /ultra\s*wide|ultrawide|macro/i.test(c.label));
            const backCam = cameras.find((c) => /back|rear|environment/i.test(c.label));
            targetCam = macroCam || backCam || cameras[cameras.length - 1];
          }

          if (targetCam) {
            setSelectedCamId(targetCam.id);
            await html5Qrcode.start(targetCam.id, config, handleScanSuccess, () => {});
            started = true;
          }
        }
      } catch (camErr) {
        console.warn('Camera lookup note:', camErr);
      }

      if (!started) {
        try {
          await html5Qrcode.start(
            { facingMode: 'environment' },
            config,
            handleScanSuccess,
            () => {}
          );
          started = true;
        } catch (e) {
          console.warn('Direct environment facingMode failed, trying fallback:', e);
        }
      }

      if (!started) {
        try {
          await html5Qrcode.start(
            { facingMode: 'user' },
            config,
            handleScanSuccess,
            () => {}
          );
          started = true;
        } catch (e) {
          console.warn('Direct user facingMode failed:', e);
        }
      }

      // Auto-apply Macro focus zoom constraints
      if (started) {
        setTimeout(() => {
          applyMacroConstraints(macroZoom);
        }, 350);
      }
    } catch (err: any) {
      console.error('Camera barcode scan error:', err);
      const isNotReadable = err?.name === 'NotReadableError' || err?.toString()?.includes('NotReadableError');
      setErrorMsg(
        isNotReadable
          ? (language === 'km'
              ? 'កាមេរ៉ាកំពុងជាប់រវល់ ឬត្រូវបានប្រើប្រាស់ដោយផ្នែកផ្សេង! សូមចុច "ព្យាយាមភ្ជាប់កាមេរ៉ាម្តងទៀត"'
              : 'Camera source is busy or held by another component. Please click "Retry Camera".')
          : (err?.message ||
              (language === 'km'
                ? 'មិនអាចបើកកាមេរ៉ាបានទេ។ សូមពិនិត្យ Permission ឬបិទកម្មវិធីផ្សេងដែលប្រើកាមេរ៉ា'
                : 'Could not access camera source. Please check camera permissions.'))
      );
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    if (isOpen) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    playScanBeep();
    setLastScanned(manualCode.trim());
    onScan(manualCode.trim());
    setManualCode('');
    setTimeout(() => setLastScanned(null), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-lg w-full max-h-[92dvh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="shrink-0 p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 sticky top-0 z-10">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                {language === 'km' ? 'ម៉ាស៊ីន Scan Barcode តាមកាមេរ៉ា' : 'Webcam Barcode Scanner'}
              </h3>
              <p className="text-xs text-slate-400">
                {language === 'km' ? 'តម្រង់ Barcode លើទំនិញចូលក្នុងប្រអប់' : 'Point camera barcode at product'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Scanner Container */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center space-y-3">
          {/* Main camera view box - ALWAYS mounted in DOM to avoid element missing errors */}
          <div className="relative w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950 min-h-[260px] flex items-center justify-center">
            <div id="camera-barcode-reader" className="w-full min-h-[260px]"></div>

            {isInitializing && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-slate-400 p-4">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
                <p className="text-xs font-semibold">
                  {language === 'km' ? 'កំពុងភ្ជាប់កាមេរ៉ា...' : 'Starting camera...'}
                </p>
              </div>
            )}

            {lastScanned && (
              <div className="absolute inset-0 bg-emerald-900/90 backdrop-blur-xs flex flex-col items-center justify-center text-white animate-fade-in p-4 text-center z-10">
                <CheckCircle className="w-12 h-12 text-emerald-400 mb-2 animate-bounce" />
                <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
                  {language === 'km' ? 'បាន Scan ជោគជ័យ' : 'Barcode Scanned!'}
                </p>
                <p className="text-lg font-mono font-bold mt-1 bg-slate-950/80 px-3 py-1 rounded border border-emerald-500/40">
                  {lastScanned}
                </p>
              </div>
            )}
          </div>

          {/* iPhone Macro Lens Focus Toolbar */}
          <div className="w-full bg-slate-950/90 border border-slate-800/90 p-2.5 rounded-xl space-y-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <span>🔍</span>
                <span>{language === 'km' ? 'iPhone Macro Focus (ម៉ាក្រូ Scan ជិត)' : 'iPhone Macro Lens Focus'}</span>
              </span>

              {availableCameras.length > 1 && (
                <select
                  value={selectedCamId || ''}
                  onChange={(e) => {
                    setSelectedCamId(e.target.value);
                    startScanner();
                  }}
                  className="bg-slate-900 text-xs text-emerald-300 font-bold border border-slate-700 rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500 max-w-[180px] truncate"
                >
                  {availableCameras.map((cam, idx) => {
                    const isMacro = /ultra\s*wide|ultrawide|macro/i.test(cam.label);
                    return (
                      <option key={cam.id} value={cam.id}>
                        {isMacro ? '🔍 iPhone Macro / Ultra Wide' : cam.label || `Camera ${idx + 1}`}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            <div className="flex items-center justify-between gap-1.5 pt-0.5">
              {[
                { zoom: 1.0, labelKh: '1.0x ធម្មតា', labelEn: '1.0x Normal' },
                { zoom: 1.5, labelKh: '1.5x Macro', labelEn: '1.5x Macro' },
                { zoom: 2.0, labelKh: '2.0x ជិត', labelEn: '2.0x Macro' },
                { zoom: 2.5, labelKh: '2.5x ជិតបំផុត', labelEn: '2.5x Close' },
              ].map((preset) => (
                <button
                  key={preset.zoom}
                  type="button"
                  onClick={() => {
                    setMacroZoom(preset.zoom);
                    applyMacroConstraints(preset.zoom);
                  }}
                  className={`flex-1 py-1.5 px-1 rounded-lg text-[11px] font-extrabold transition-all border cursor-pointer text-center ${
                    macroZoom === preset.zoom
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 border-emerald-400 shadow-md scale-105'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {language === 'km' ? preset.labelKh : preset.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message Display with Retry Action */}
          {errorMsg && (
            <div className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex flex-col items-center text-center space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-xs font-medium">{errorMsg}</p>
              </div>
              <button
                type="button"
                onClick={startScanner}
                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{language === 'km' ? 'ព្យាយាមភ្ជាប់កាមេរ៉ាម្តងទៀត' : 'Retry Camera'}</span>
              </button>
            </div>
          )}

          {/* Manual Input Fallback */}
          <form onSubmit={handleManualSubmit} className="w-full pt-1">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder={
                    language === 'km'
                      ? 'ឬវាយបញ្ចូលកូដ / ប្រើ Barcode Scanner...'
                      : 'Or enter barcode manually / scan code...'
                  }
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-slate-500 outline-none"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-bold rounded-xl text-xs shrink-0 transition-colors"
              >
                {language === 'km' ? 'បញ្ចូល' : 'Enter'}
              </button>
            </div>
          </form>

          {/* Sound & Info Note */}
          <div className="w-full flex items-center gap-2 text-xs text-slate-400 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800/80">
            <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {language === 'km'
                ? 'ប្រព័ន្ធនឹងបន្លឺសំឡេង Beep និងស្វែងរកទំនិញស្វ័យប្រវត្តិ'
                : 'System plays a beep sound and automatically retrieves item data'}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 p-3 bg-slate-950/90 border-t border-slate-800 flex justify-end backdrop-blur-md z-10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            {language === 'km' ? 'បិទកាមេរ៉ា' : 'Close Camera'}
          </button>
        </div>
      </div>
    </div>
  );
};

