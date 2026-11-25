"use client";

import Hero from "@/components/home/Hero";
import Link from "next/link";
import AboutFooter from "@/components/ui/about-footer";

const steps = [
  { title: "Scan the room once", body: "A Scaniverse scan becomes a map the phone can recognize." },
  { title: "Locate the phone", body: "The iPhone app matches its camera to that map using Niantic Spatial's visual positioning. In HSS 349 it locates itself from every corner in under 10 seconds." },
  { title: "Route to anywhere", body: "Pick a destination and the shortest open path is drawn on the live map, with distance and steps." },
];

const buttonStyles = `
  inline-flex items-center 
  border-l-6 border-[#1f5bff] dark:border-[#a9c4ff] 
  bg-transparent bg-linear-135
  from-[#f3f6f9] dark:from-[#274072]
  hover:from-[#99B3CC] dark:hover:from-[#416BBE]
  text-sm font-semibold text-[#1f5bff] dark:text-[#a9c4ff] 
  mx-4 my-2 px-5 pr-20 py-3
  hover:pr-40 hover:translate-x-1
  hover:cursor-pointer
  transition duration-200 ease-out
  `;

export default function Home() {

  return (
    <>
      <main className="mx-auto w-full max-w-5xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.1fr_1fr] md:py-16">
        <Hero />
        <Link href="/account" className={buttonStyles}>
          Continue
        </Link>

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
      </main>
      <AboutFooter/>
    </>
  );
}
