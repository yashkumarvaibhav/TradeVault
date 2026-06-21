import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Real TradeVault wordmark (not a generic glyph). Two stacked images swap by theme via
 * the `.brand-wordmark-*` rules in globals.css. `widthClass` tunes size per placement.
 */
export function Wordmark({ widthClass = "w-44" }: { widthClass?: string }) {
  // The wrapper carries the accessible name via role="img" + aria-label (valid on a
  // role="img" element, and stable across both themes). The two theme-swapped PNGs are
  // purely presentational, so both are aria-hidden with empty alt.
  return (
    <div role="img" aria-label="TradeVault" className={cn("relative h-10", widthClass)}>
      <Image
        src="/brand/wordmark-light.png"
        alt=""
        width={700}
        height={116}
        priority
        aria-hidden="true"
        className={cn("brand-wordmark-light h-auto", widthClass)}
      />
      <Image
        src="/brand/wordmark-dark.png"
        alt=""
        width={700}
        height={116}
        priority
        aria-hidden="true"
        className={cn("brand-wordmark-dark absolute inset-0 h-auto", widthClass)}
      />
    </div>
  );
}
