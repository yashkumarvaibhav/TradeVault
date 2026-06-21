import type { Metadata } from "next";
import { LogOut } from "lucide-react";

import { signOutAction } from "@/app/login/actions";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { supportedTimeZones, timeZoneLabel } from "@/lib/date-time";
import { requireWorkspaceSession } from "@/lib/workspace-session";

import { ProfileForm } from "./profile-form";
import { ChangePasswordForm } from "./change-password-form";
import { ThemePreference } from "./theme-preference";
import { TimeZonePreference } from "./time-zone-preference";
import { TourSettings } from "./tour-settings";
import { TwoFactorSettings } from "./two-factor-settings";

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
  const { session, shellUser, timeZone } = await requireWorkspaceSession();
  const user = session.user;
  const { displayName, username } = shellUser;

  return (
    <AppShell user={shellUser}>
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

        <SettingsSection title="Date & time" description={`Default: India Standard Time. Currently ${timeZoneLabel(timeZone)}.`}>
          <TimeZonePreference current={timeZone} zones={supportedTimeZones()} />
        </SettingsSection>

        <SettingsSection title="Two-factor authentication" description="Authenticator app for sensitive actions, recovery, and optional sign-in protection.">
          <TwoFactorSettings enrolled loginRequired={Boolean((user as { twoFactorEnabled?: boolean }).twoFactorEnabled)} />
        </SettingsSection>

        <SettingsSection title="Change password" description="Confirm your current password and authenticator code.">
          <ChangePasswordForm />
        </SettingsSection>

        <SettingsSection title="Guided tours" description="See the per-screen welcome walkthrough again.">
          <TourSettings />
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
