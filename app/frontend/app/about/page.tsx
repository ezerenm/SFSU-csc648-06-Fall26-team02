import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

type Member = {
  id: number;
  name: string;
  role: string;
  github_url: string | null;
};

async function getTeam(): Promise<Member[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.from('team_members').select('*').order('id');
  return data ?? [];
}

export default async function AboutPage() {
  const team = await getTeam();

  return (
    <main className="min-h-screen bg-white px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold text-gray-900">Team 02</h1>
        <p className="mt-2 text-gray-600">CSC 648/848 — Section 06 — Fall 2026</p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((m) => (
            <div key={m.id} className="rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900">{m.name}</h2>
              <p className="mt-1 text-sm text-gray-500">{m.role}</p>
              <div className="mt-4 flex gap-4 text-sm">
                <Link href={"/" + m.name.split(' ')[0].toLowerCase()} className="text-blue-600 hover:underline">Profile</Link>
                {m.github_url ? <a href={m.github_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">GitHub</a> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}