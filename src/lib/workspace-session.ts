import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { createTradingAccountRepository, ensureWorkspaceForUser } from "@/db/repositories/workspaces";
import { getUserTimeZone } from "@/db/repositories/preferences";
import { getDb } from "@/db/server";
import { getAuth } from "@/lib/auth-server";
import { isTotpEnrolled } from "@/lib/auth-totp";
import { MARKET_CURRENCY_COOKIE, parseMarketCurrency } from "@/lib/market-mode";

export async function requireWorkspaceSession() {
  const session = await getAuth().api.getSession({ headers: await headers() }).catch(() => null);
  // Auth happens in the landing-page modal; bring it up pre-opened in sign-in mode.
  if (!session) redirect("/?auth=signin");

  // TOTP enrollment is mandatory — block every gated route until the authenticator is set up.
  if (!(await isTotpEnrolled(getDb(), session.user.id))) redirect("/onboarding/2fa");

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
  const marketCurrency = parseMarketCurrency((await cookies()).get(MARKET_CURRENCY_COOKIE)?.value, account.defaultCurrency);

  return { session, scope, account, timeZone, shellUser: { displayName, username, currency: marketCurrency } };
}
