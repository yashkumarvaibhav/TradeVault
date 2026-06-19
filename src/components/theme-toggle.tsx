"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toggleTheme } from "@/lib/theme";

export function ThemeToggle() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Toggle color theme"
          onClick={() => toggleTheme()}
        >
          <Moon className="theme-icon-moon" aria-hidden="true" />
          <Sun className="theme-icon-sun" aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Toggle color theme</TooltipContent>
    </Tooltip>
  );
}
