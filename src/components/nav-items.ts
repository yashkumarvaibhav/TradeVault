import {
  BarChart3,
  BookOpenText,
  CalendarDays,
  ChartNoAxesCombined,
  FileText,
  LayoutDashboard,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  /** Anchor/route for the destination. `#overview` is live; others land once their phase ships. */
  href: string;
  /** The single currently-reachable destination. */
  active?: boolean;
  /** Destination is defined in the spec but not built yet. */
  soon?: boolean;
}

export const navItems: NavItem[] = [
  { label: "Overview", icon: LayoutDashboard, href: "#overview", active: true },
  { label: "My trades", icon: BarChart3, href: "#", soon: true },
  { label: "Analytics", icon: ChartNoAxesCombined, href: "#", soon: true },
  { label: "Review center", icon: ShieldCheck, href: "#", soon: true },
  { label: "Calendar", icon: CalendarDays, href: "#", soon: true },
  { label: "Notes", icon: BookOpenText, href: "#", soon: true },
  { label: "Reports", icon: FileText, href: "#", soon: true },
];
