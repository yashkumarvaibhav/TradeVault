import "server-only";

import path from "node:path";

import { Font } from "@react-pdf/renderer";

/**
 * Font registration for the generated PDF, run once at module init.
 *
 * The report must look identical regardless of the viewer's device or theme, so it
 * embeds the brand serif rather than relying on the browser, and draws the brand
 * mark + watermark as vectors (see `report-document.tsx`) rather than raster art —
 * react-pdf's embedded image XObjects could not be verified across viewers with the
 * available tooling, while vectors and embedded fonts render identically everywhere.
 *
 * Newsreader is vendored as a single static `.ttf` (`newsreader-400.ttf`, converted
 * from the `@fontsource` `.woff`) and used for editorial headings only; PDFium drops
 * the variable build and react-pdf's shaper cannot place some glyphs (notably ₹) from
 * an arbitrary embedded subset, so dense data/money stay in the base-14 Helvetica
 * (the Arial of the identity) and INR is written "Rs" rather than the ₹ symbol.
 * If Newsreader ever fails to register we fall back to the built-in Times-Roman
 * serif so a report is always produced.
 */

const FONT_DIR = path.join(process.cwd(), "src", "server", "pdf", "fonts");

export const SERIF_FALLBACK = "Times-Roman";
export const SANS = "Helvetica";

let serifFamily = SERIF_FALLBACK;
let registered = false;

export function registerReportFonts(): string {
  if (registered) return serifFamily;
  registered = true;
  try {
    // One static weight: react-pdf's subset of the variable/other-weight files
    // renders blank in PDFium, while this 400 instance embeds cleanly. Headings
    // get their hierarchy from size, not weight.
    Font.register({
      family: "Newsreader",
      src: path.join(FONT_DIR, "newsreader-400.ttf"),
    });
    // Keep report headings on one line — never hyphenate-split a title.
    Font.registerHyphenationCallback((word) => [word]);
    serifFamily = "Newsreader";
  } catch {
    serifFamily = SERIF_FALLBACK;
  }
  return serifFamily;
}
