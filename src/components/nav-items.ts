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
  /** Route for the destination. `/` is the live overview; others land once their phase ships. */
  href: string;
  /** The single currently-reachable destination. */
  active?: boolean;
  /** Destination is defined in the spec but not built yet. */
  soon?: boolean;
}

export const navItems: NavItem[] = [
  { label: "Overview", icon: LayoutDashboard, href: "/", active: true },
  { label: "My trades", icon: BarChart3, href: "/trades", active: true },
  { label: "Analytics", icon: ChartNoAxesCombined, href: "/analytics", active: true },
  { label: "Review center", icon: ShieldCheck, href: "/review", active: true },
  { label: "Calendar", icon: CalendarDays, href: "/calendar", active: true },
  { label: "Notes", icon: BookOpenText, href: "/notes", active: true },
  { label: "Reports", icon: FileText, href: "#", soon: true },
];
