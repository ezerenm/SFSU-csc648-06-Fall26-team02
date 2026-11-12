"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabaseBrowser } from "@/lib/spatial/supabaseBrowser";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES = ["visitor", "developer", "operator", "administrator"] as const;
type Membership = {
  membership_id: string;
  site_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
};

export default function MembershipManager({ siteIds }: { siteIds: string[] }) {
  const [siteId, setSiteId] = useState(siteIds[0] ?? "");
  const [siteNames, setSiteNames] = useState<Record<string, string>>({});
  const [members, setMembers] = useState<Membership[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("visitor");
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!siteId) return;
    const { data, error } = await supabaseBrowser.from("site_memberships")
      .select("membership_id, site_id, user_id, role, is_active")
      .eq("site_id", siteId).order("created_at");
    if (error) setMessage("Could not load site memberships.");
    else setMembers(data ?? []);
  }, [siteId]);

  useEffect(() => {
    if (!siteId) return;
    let active = true;
    void supabaseBrowser.from("site_memberships")
      .select("membership_id, site_id, user_id, role, is_active")
      .eq("site_id", siteId).order("created_at")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setMessage("Could not load site memberships.");
        else setMembers(data ?? []);
      });
    return () => { active = false; };
  }, [siteId]);
  useEffect(() => {
    if (siteIds.length === 0) return;
    void supabaseBrowser.from("sites").select("site_id, name")
      .in("site_id", siteIds).then(({ data }) => {
        setSiteNames(Object.fromEntries((data ?? []).map((site) => [site.site_id, site.name])));
      });
  }, [siteIds]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetUser = userId.trim();
    if (!UUID.test(targetUser)) { setMessage("Enter the user's account ID (UUID)."); return; }
    setBusy(true);
    setMessage("");
    const existing = members.find((member) => member.user_id === targetUser);
    const { error } = existing
      ? await supabaseBrowser.from("site_memberships")
          .update({ role, is_active: isActive }).eq("membership_id", existing.membership_id)
      : await supabaseBrowser.from("site_memberships")
          .insert({ site_id: siteId, user_id: targetUser, role, is_active: isActive });
    setBusy(false);
    if (error?.code === "23503") {
      setMessage("That user needs to sign up before you can assign a site role.");
    } else if (error) {
      setMessage("Could not save the site role. Check your administrator access.");
    } else {
      setMessage("Site role saved.");
      await load();
    }
  }

  return (
    <section className="mt-8 space-y-4 border-t pt-6">
      <h2 className="text-lg font-semibold">Manage site roles</h2>
      <p>Ask the person to sign up, then use the account ID shown on their account page.</p>
      <label className="block">Site
        <select value={siteId} onChange={(event) => setSiteId(event.target.value)}
          className="mt-1 block w-full rounded border p-2 text-black">
          {siteIds.map((id) => <option key={id} value={id}>{siteNames[id] ?? id}</option>)}
        </select>
      </label>
      <form onSubmit={save} className="space-y-3">
        <label className="block">User account ID
          <input required value={userId} onChange={(event) => setUserId(event.target.value)}
            className="mt-1 block w-full rounded border p-2 text-black" />
        </label>
        <label className="block">Role
          <select value={role} onChange={(event) => setRole(event.target.value as (typeof ROLES)[number])}
            className="mt-1 block w-full rounded border p-2 text-black">
            {ROLES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          Active
        </label>
        <button type="submit" disabled={busy}
          className="rounded bg-purple-800 px-4 py-2 text-white disabled:opacity-50">
          {busy ? "Saving…" : "Save role"}
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      <h3 className="font-semibold">Current memberships</h3>
      <ul className="space-y-2">
        {members.map((member) => (
          <li key={member.membership_id} className="rounded border p-2 text-sm">
            <button type="button" className="text-left underline"
              onClick={() => { setUserId(member.user_id); setRole(member.role as (typeof ROLES)[number]); setIsActive(member.is_active); }}>
              {member.user_id}
            </button>{" "}
            {member.role}{member.is_active ? "" : " (inactive)"}
          </li>
        ))}
      </ul>
    </section>
  );
}
