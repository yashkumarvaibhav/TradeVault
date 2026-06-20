"use client";

import * as React from "react";

import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { applyTheme, readTheme, type Theme } from "@/lib/theme";

export function ThemePreference() {
  // Initialize from the actual applied theme on the client (server can't read it) and
  // make it explicit on `data-theme` so a system-default theme is also persisted/selectable.
  const [theme, setTheme] = React.useState<Theme | null>(null);
  React.useEffect(() => {
    const current = readTheme();
    applyTheme(current);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only read of the applied theme
    setTheme(current);
  }, []);

  return (
    <SegmentedControl
      type="single"
      value={theme ?? "light"}
      onValueChange={(value) => {
        if (value === "light" || value === "dark") {
          applyTheme(value);
          setTheme(value);
        }
      }}
      aria-label="Color theme"
    >
      <SegmentedControlItem value="light">Light</SegmentedControlItem>
      <SegmentedControlItem value="dark">Dark</SegmentedControlItem>
    </SegmentedControl>
  );
}
