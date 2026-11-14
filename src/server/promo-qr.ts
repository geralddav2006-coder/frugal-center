import "server-only";
import QRCode from "qrcode";

const COLORS = { dark: "#191919", light: "#ffffff" };

/** QR code as inline SVG markup (scales cleanly for print). */
export function qrSvg(url: string) {
  return QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: COLORS });
}

/** High-resolution PNG for businesses to drop into their own designs. */
export function qrPng(url: string) {
  return QRCode.toBuffer(url, { type: "png", width: 1200, margin: 2, errorCorrectionLevel: "M", color: COLORS });
}

/** "https://frugal.center/f/x?p=counter" → "frugal.center/f/x" (printed under the code). */
export function displayUrl(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\?.*$/, "");
}
