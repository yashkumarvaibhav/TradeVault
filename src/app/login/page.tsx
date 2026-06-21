import type { Metadata } from "next";

import { AuthScreen } from "@/components/auth/auth-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in · TradeVault",
  description: "Sign in to your TradeVault trading journal.",
};

export default function LoginPage() {
  return <AuthScreen mode="signin" />;
}
