"use client";
import { useEffect, useRef, useState } from "react";
import { CameraOff, Loader2 } from "lucide-react";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/**
 * Live camera QR scanner. Uses the native BarcodeDetector API where available
 * (Chrome/Android, Safari 17+) and falls back to jsQR on canvas frames.
 */
export function QrScanner({ onResult, paused }: { onResult: (text: string) => void; paused: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [error, setError] = useState<string | null>(null);
  const cb = useRef(onResult);
  const pausedRef = useRef(paused);
  useEffect(() => {
    cb.current = onResult;
    pausedRef.current = paused;
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let last = 0;

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setError("Camera access needs a secure (https) connection and a browser with camera support. Use “Enter Code” instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (err) {
        const name = (err as DOMException).name;
        setStatus("error");
        setError(
          name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access in your browser settings, or use “Enter Code”."
            : name === "NotFoundError"
              ? "No camera found on this device. Use “Enter Code” instead."
              : "Couldn't start the camera. Use “Enter Code” instead.",
        );
        return;
      }
      if (stopped || !video.current) return;
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});
      setStatus("scanning");

      let detector: Detector | null = null;
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      if (BD) {
        try {
          detector = new BD({ formats: ["qr_code"] });
        } catch {
          detector = null;
        }
      }
      const jsQR = detector ? null : (await import("jsqr")).default;

      const tick = async (t: number) => {
        if (stopped) return;
        raf = requestAnimationFrame(tick);
        if (pausedRef.current || t - last < 160) return;
        last = t;
        const v = video.current;
        if (!v || v.readyState < 2) return;
        try {
          if (detector) {
            const codes = await detector.detect(v);
            if (codes[0]?.rawValue) cb.current(codes[0].rawValue);
          } else if (jsQR && canvas.current) {
            const w = Math.min(640, v.videoWidth);
            const h = Math.round((v.videoHeight / v.videoWidth) * w);
            const c = canvas.current;
            c.width = w;
            c.height = h;
            const ctx = c.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(v, 0, 0, w, h);
            const img = ctx.getImageData(0, 0, w, h);
            const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
            if (code?.data) cb.current(code.data);
          }
        } catch {
          /* transient decode errors are expected */
        }
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-[24px] bg-ink sm:aspect-[4/3]">
      <video ref={video} className="absolute inset-0 size-full object-cover" playsInline muted aria-label="Camera preview" />
      <canvas ref={canvas} className="hidden" />
      {status === "scanning" ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="relative size-[62%] max-w-72 rounded-3xl shadow-[0_0_0_9999px_rgb(25_25_25/0.45)]">
            {["top-0 left-0 border-t-4 border-l-4 rounded-tl-3xl", "top-0 right-0 border-t-4 border-r-4 rounded-tr-3xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-3xl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-3xl"].map((c) => (
              <span key={c} className={`absolute size-10 border-lime ${c}`} />
            ))}
          </div>
        </div>
      ) : null}
      {status === "starting" ? (
        <div className="absolute inset-0 grid place-items-center text-white"><Loader2 className="size-7 animate-spin" aria-label="Starting camera" /></div>
      ) : null}
      {status === "error" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center text-white" role="alert">
          <CameraOff className="size-8" aria-hidden />
          <p className="max-w-xs text-[15px]">{error}</p>
        </div>
      ) : null}
      {status === "scanning" ? <p className="absolute inset-x-0 bottom-4 text-center text-sm font-semibold text-white">Point the camera at the customer&apos;s QR code</p> : null}
    </div>
  );
}
