"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { updateTimeZoneAction, type TimeZoneFormState } from "./actions";

export function TimeZonePreference({ current, zones }: { current: string; zones: string[] }) {
  const [state, formAction, pending] = useActionState<TimeZoneFormState, FormData>(updateTimeZoneAction, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      {state.success ? <p role="status" className="rounded-md border border-profit/30 bg-profit/10 px-3 py-2 text-sm text-profit">{state.success}</p> : null}
      <div className="space-y-1.5">
        <Label htmlFor="timeZone">Display timezone</Label>
        <select id="timeZone" name="timeZone" defaultValue={current} className="h-11 w-full max-w-md rounded-md border border-line bg-raised px-3 text-sm text-ink">
          {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
        </select>
        <p className="max-w-2xl text-xs leading-relaxed text-muted">Dates, calendar days, manual ranges, and date-time inputs use this zone. Timestamps remain stored as absolute instants.</p>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save timezone"}</Button>
    </form>
  );
}
