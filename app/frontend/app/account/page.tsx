"use client";

import { useEffect, useState, ViewTransition, startTransition, ViewTransitionInstance, FormEvent} from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/spatial/supabaseBrowser";
import MembershipManager from "@/components/account/MembershipManager";

type Membership = { site_id: string; role: string; is_active: boolean };

const tabStyles = `
	font-semibold 
	w-full px-4 py-2.5
	bg-transparent bg-linear-135
	from-[#f3f6f9] dark:from-[#274072]
  enabled:text-[#AAAAAA] enabled:hover:text-white
	enabled:hover:from-[#99B3CC] enabled:dark:hover:from-[#416BBE]
  transition duration-200 ease-out
	enabled:hover:cursor-pointer
  not-enabled:bg-[#416BBE]
`

const buttonStyles = `
	font-semibold
	w-full px-4 py-2.5
	bg-transparent bg-linear-135
	from-[#f3f6f9] dark:from-[#274072]
	hover:from-[#99B3CC] dark:hover:from-[#416BBE]
  transition duration-200 ease-out
	hover:cursor-pointer
`;

const inputStyles =  `
  block w-full px-3 py-2
  outline-none border-b border-gray-300 
  bg-linear-0 bg-transparent from-transparent
  font-normal mt-1 
  focus:border-[#99B3CC]
  focus:from-[#274072] hover:from-[#1a2b4c]
  transition duration-400 ease-out
  not-hidden:-translate-y-0.5
`;

const confPassViewTransition = (instance: ViewTransitionInstance) => {
    const anim = instance.new.animate(
        {
            opacity: [0,1],
            transform: ["translateY(-10px)","translateY(0px)"]
        }, 
        {duration:200, easing:'ease-out'}
    );
    return () => anim.cancel();
}

// "mt-1 block w-full rounded border p-2 text-black"

export default function AccountPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confPassword, setConfPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const adminSiteIds = memberships.filter((membership) =>
    membership.is_active && membership.role === "administrator").map((membership) => membership.site_id);

  useEffect(() => {
    let active = true;
    void supabaseBrowser.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((_event, current) => {
      if (active) setSession(current);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;
    void supabaseBrowser.from("site_memberships")
      .select("site_id, role, is_active")
      .eq("user_id", session.user.id)
      .then(({ data, error }) => {
        if (!active) return;
        setMemberships(error ? [] : (data ?? []));
        if (error) setMessage("Could not load site roles.");
      });
    return () => { active = false; };
  }, [session]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "signup" && password !== confPassword) {
      setMessage("Passwords do not match!")
      return
    }
    setBusy(true);
    setMessage("");
    const result = mode === "signup"
      ? await supabaseBrowser.auth.signUp({ email: email.trim(), password })
      : await supabaseBrowser.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    setPassword("");
    if (result.error) {
      setMessage(result.error.message);
    } else if (mode === "signup" && !result.data.session) {
      setMessage("Check your email to confirm your account, then sign in.");
    } else {
      setMessage(mode === "signup" ? "Account created." : "Signed in.");
    }
  }

  async function signOut() {
    setBusy(true);
    const { error } = await supabaseBrowser.auth.signOut();
    setBusy(false);
    if (error) setMessage(error.message);
    else { setMemberships([]); setMessage("Signed out."); }
  }

  return (
    <main className="mx-auto w-full max-w-lg p-6">
      <h1 className="text-2xl font-semibold">Account - {mode === "login" ? "Log In" : "Sign Up"}</h1>
      {session ? (
        <div className="mt-5 space-y-4">
          <p>Signed in as {session.user.email}</p>
          <p className="text-sm">Account ID: <code>{session.user.id}</code></p>
          <h2 className="font-semibold">Site roles</h2>
          {memberships.length === 0
            ? <p>No site role is available yet.</p>
            : <ul className="list-disc pl-5">
                {memberships.map((membership) => (
                  <li key={membership.site_id}>
                    {membership.site_id}: {membership.role}{membership.is_active ? "" : " (inactive)"}
                  </li>
                ))}
              </ul>}
          <p><Link href="/dashboard" className="underline">Go to Dashboard</Link></p>
          <button type="button" disabled={busy} onClick={signOut}
            className="rounded bg-purple-800 px-4 py-2 text-white disabled:opacity-50">Sign out</button>
          {adminSiteIds.length > 0 && <MembershipManager siteIds={adminSiteIds} />}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="flex gap-4">
            <button type="button" onClick={() => { setMode("login"); setMessage(""); }}
              aria-pressed={mode === "login"} className={tabStyles} disabled={mode !== "signup"}>Log in</button>
            <button type="button" onClick={() => { startTransition( () => setMode("signup")); setMessage(""); }}
              aria-pressed={mode === "signup"} className={tabStyles} disabled={mode !== "login"}>Sign up</button>
          </div>
          <label className="block">Email
            <input type="email" required autoComplete="email" value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputStyles} />
          </label>
          <label className="block">Password
            <input type="password" required minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password} onChange={(event) => setPassword(event.target.value)}
              className={inputStyles} />
          </label>
          {  mode === "signup" &&
            <ViewTransition onEnter={confPassViewTransition} exit="auto">
              <label className="block" hidden={mode !== "signup"}>Confirm Password
                <input type="password" required minLength={6}
                  autoComplete={mode === "signup" ? "new-password" : ""}
                  value={confPassword} onChange={(event) => setConfPassword(event.target.value)}
                  className={inputStyles} />
              </label>
            </ViewTransition>
          }
          <button disabled={busy} type="submit"
            className={buttonStyles}>
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>
      )}
      {message && <p role="status" className="mt-4">{message}</p>}
    </main>
  );
}
