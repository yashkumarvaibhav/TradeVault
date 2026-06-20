import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { signOutAction } from "@/app/login/actions";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getAuth } from "@/lib/auth-server";

import { ProfileForm } from "./profile-form";
import { ThemePreference } from "./theme-preference";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Settings · TradeVault" };

function SettingsSection({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-raised p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="font-serif text-xl text-ink">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  let session = null;
  try {
    session = await getAuth().api.getSession({ headers: await headers() });
  } catch {
    session = null;
  }
  if (!session) redirect("/login");

  const user = session.user;
  const displayName = user.name || user.username || "Trader";
  const username = user.username ?? "";

  return (
    <AppShell user={{ displayName, username }}>
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <PageHeader eyebrow="Account" title="Settings" description="Manage your profile and how TradeVault looks." />

        <SettingsSection title="Profile" description="Your display name and username.">
          <div className="mb-4">
            <span className="text-sm font-semibold text-ink">Username</span>
            <p className="text-sm text-muted">@{username}</p>
          </div>
          <ProfileForm defaultName={displayName} />
        </SettingsSection>

        <SettingsSection title="Appearance" description="Choose how TradeVault looks on this device.">
          <ThemePreference />
        </SettingsSection>

        <SettingsSection title="Security" description="Account access and recovery.">
          <p className="text-sm text-muted">
            Two-factor authentication (TOTP) for email-free recovery is coming next. Your password signs you in for now.
          </p>
        </SettingsSection>

        <SettingsSection title="Account">
          <form action={signOutAction}>
            <Button type="submit" variant="outline">
              <LogOut aria-hidden="true" /> Sign out
            </Button>
          </form>
        </SettingsSection>
      </div>
    </AppShell>
  );
}
