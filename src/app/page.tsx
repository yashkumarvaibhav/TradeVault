import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { OverviewDashboard } from "@/components/overview/overview-dashboard";
import { ensureWorkspaceForUser } from "@/db/repositories/workspaces";
import { getDb } from "@/db/server";
import { getAuth } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function Home() {
  let session = null;
  try {
    session = await getAuth().api.getSession({ headers: await headers() });
  } catch {
    session = null;
  }
  if (!session) redirect("/login");

  const user = session.user;
  const displayUsername = user.displayUsername ?? user.username ?? user.name;
  const username = user.username ?? "";

  // Heal accounts created before onboarding existed (idempotent, no-op once provisioned).
  await ensureWorkspaceForUser(getDb(), {
    userId: user.id,
    slugBase: username || user.name,
    tenantName: `${displayUsername}'s vault`,
  });

  return (
    <AppShell user={{ displayUsername, username }}>
      <OverviewDashboard />
    </AppShell>
  );
}
