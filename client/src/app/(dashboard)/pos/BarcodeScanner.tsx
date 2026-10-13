'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './page.module.css';

// Single scanner region on the page — html5-qrcode needs a DOM element id.
const SCANNER_ELEMENT_ID = 'pos-barcode-scanner-region';

// Type-only import: erased at build time, so the library still never enters
// the SSR module graph (the runtime import stays dynamic inside start()).
type Html5QrcodeInstance = import('html5-qrcode').Html5Qrcode;

type ScannerState = 'idle' | 'starting' | 'scanning' | 'unavailable';

interface BarcodeScannerProps {
  /** Fired for every decoded code; the page debounces/cools down adds. */
  onScan: (code: string) => void;
  /** Called when the camera cannot start (denied / absent / busy). */
  onUnavailable: (reason: string) => void;
  disabled: boolean;
}

/**
 * Webcam barcode reader built on html5-qrcode (loaded via dynamic import so
 * the library never touches the SSR module graph). Start/stop is explicit —
 * the browser permission prompt only fires when the cashier presses Start,
 * and every failure path degrades to the message + manual-search fallback
 * the parent renders.
 */
export function BarcodeScanner({ onScan, onUnavailable, disabled }: BarcodeScannerProps) {
  const [state, setState] = useState<ScannerState>('idle');
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  // Latest-callback ref so a long-running camera session never calls a stale
  // onScan closure.
  const onScanRef = useRef(onScan);
  const onUnavailableRef = useRef(onUnavailable);
  useEffect(() => {
    onScanRef.current = onScan;
    onUnavailableRef.current = onUnavailable;
  }, [onScan, onUnavailable]);

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      await scanner.stop();
    } catch {
      // stop() rejects when the stream already died — clearing is enough.
    }
    try {
      scanner.clear();
    } catch {
      // ignore
    }
  }, []);

  const startCamera = useCallback(async () => {
    setState('starting');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;
      await scanner.start(
        // MediaTrackConstraints (html5-qrcode wraps it in { video } itself):
        // ideal (not exact) environment — laptop webcams ignore facingMode,
        // phones/tablets prefer the rear sensor.
        { facingMode: { ideal: 'environment' } },
        {
          fps: 10,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.7777,
          disableFlip: true,
          // formatsToSupport omitted: the html5-qrcode default set already
          // covers EAN-13/8, UPC-A/E, Code128/39, ITF, Code93, Codabar, QR
          // and DataMatrix — the whole counter barcode family.
        },
        (decodedText: string) => {
          onScanRef.current(decodedText.trim());
        },
        () => {
          // Per-frame decode misses surface here constantly; ignore.
        },
      );
      setState('scanning');
    } catch (err) {
      await stopCamera();
      scannerRef.current = null;
      const message = err instanceof Error ? err.message : String(err);
      const reason = /not allowed|permission|denied/i.test(message)
        ? 'Camera permission was denied. Use product search below to add items.'
        : /not found|no camera|unsupported|not supported|getusermedia/i.test(message)
          ? 'No camera was found on this device. Use product search below to add items.'
          : `The camera could not be started (${message}). Use product search below to add items.`;
      setState('unavailable');
      onUnavailableRef.current(reason);
    }
  }, [stopCamera]);

  const handleStop = useCallback(() => {
    void stopCamera();
    setState('idle');
  }, [stopCamera]);

  // Release the camera when the page unmounts or the POS leaves the screen.
  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className={styles.scanner}>
      <div className={styles.scannerControls}>
        {state !== 'scanning' ? (
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            onClick={() => void startCamera()}
            disabled={state === 'starting' || disabled}
          >
            {state === 'starting' ? 'Starting camera…' : 'Start camera scan'}
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.button} ${styles.secondary}`}
            onClick={handleStop}
            disabled={disabled}
          >
            Stop camera
          </button>
        )}
        <span className={styles.scannerHint}>
          Hold a barcode or QR code in front of the camera — items add
          themselves, no typing.
        </span>
      </div>

      {/* Always mounted and visible: html5-qrcode measures this region when
          it attaches the video, so a hidden (0×0) container breaks render. */}
      <div
        id={SCANNER_ELEMENT_ID}
        className={styles.scannerRegion}
        data-active={state === 'scanning' ? 'yes' : 'no'}
        aria-label="Barcode camera preview"
      />
      {state === 'idle' && (
        <p className={styles.scannerIdle}>Camera is off. Product search works without it.</p>
      )}
      {state === 'unavailable' && (
        <p className={styles.scannerUnavailable} role="status">
          Camera unavailable — use the product search to add items manually.
        </p>
      )}
    </div>
  );
}
