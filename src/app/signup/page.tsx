import type { Metadata } from "next";

import { AuthScreen } from "@/components/auth/auth-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create your account · TradeVault",
  description: "Create your TradeVault account — username and password only, no email required. Free to start.",
};

export default function SignupPage() {
  return <AuthScreen mode="signup" />;
}
