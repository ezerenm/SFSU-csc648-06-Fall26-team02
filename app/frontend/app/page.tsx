import Hero from "@/components/home/Hero";
import Link from "next/link";

const steps = [
  { title: "Scan the room once", body: "A Scaniverse scan becomes a map the phone can recognize." },
  { title: "Locate the phone", body: "The iPhone app matches its camera to that map using Niantic Spatial's visual positioning. In HSS 349 it locates itself from every corner in under 10 seconds." },
  { title: "Route to anywhere", body: "Pick a destination and the shortest open path is drawn on the live map, with distance and steps." },
];

const button = "inline-flex items-center rounded-md px-5 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f5bff]";

export default function Home() {
  return (
    <main className="mx-auto grid w-full max-w-5xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.1fr_1fr] md:py-16">
      <Hero />
      <Link href="/dashboard" className={`${button} bg-[#1f5bff] text-white hover:bg-[#1648cc]`}><i className="mr-2">Temporary Login Button (Go to Dashboard)</i></Link>

      <div className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6">
        <ol className="grid gap-6 border-t border-[#d5dee8] pt-8 dark:border-[#1b2a40] md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.title}>
              <h2 className="text-2xl font-semibold tracking-tight text-[#101828] dark:text-[#e6edf6]">{s.title}</h2>
              <p className="mt-2 max-w-sm text-base leading-7 text-[#44546a] dark:text-[#9fb0c6]">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-8 text-sm text-[#44546a] dark:text-[#9fb0c6]">
        Built by <Link href="/about" className="text-[#1f5bff] underline hover:no-underline dark:text-[#6b9bff]">CSC 648 Team 02</Link> at San Francisco State University with Niantic Spatial VPS, Supabase and Next.js.
      </p>
    </main>
  );
}
