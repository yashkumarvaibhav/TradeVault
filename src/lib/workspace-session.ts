import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createTradingAccountRepository, ensureWorkspaceForUser } from "@/db/repositories/workspaces";
import { getUserTimeZone } from "@/db/repositories/preferences";
import { getDb } from "@/db/server";
import { getAuth } from "@/lib/auth-server";

export async function requireWorkspaceSession() {
  const session = await getAuth().api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) redirect("/login");

  const user = session.user;
  const displayName = user.name || user.username || "Trader";
  const username = user.username ?? "";
  const scope = await ensureWorkspaceForUser(getDb(), {
    userId: user.id,
    slugBase: username || user.name,
    tenantName: `${displayName}'s vault`,
  });
  const [account, timeZone] = await Promise.all([
    createTradingAccountRepository(getDb(), scope).getDefault(),
    getUserTimeZone(getDb(), user.id),
  ]);
  if (!account) throw new Error("Your default trading account is unavailable.");

  return { session, scope, account, timeZone, shellUser: { displayName, username } };
}
