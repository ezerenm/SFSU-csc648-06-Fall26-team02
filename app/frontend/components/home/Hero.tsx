"use client";

import { useSyncExternalStore } from "react";
import RoomMap from "./Room2DAnimation";

function subscribe(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const usePrefersReducedMotion = () =>
  useSyncExternalStore(subscribe, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);


export default function Hero() {
  const reduced = usePrefersReducedMotion();

  return (
    <header className="border-b border-[#d5dee8] bg-[#f3f6f9] dark:border-[#1b2a40] dark:bg-[#0b1220]">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.1fr_1fr] md:py-16">
        <div>
          <p className="text-5xl font-bold tracking-tight text-[#1f5bff] dark:text-[#a9c4ff] sm:text-6xl">SpatialOS</p>
          <h1 className="mt-4 max-w-xl text-2xl font-semibold leading-snug tracking-tight text-[#101828] dark:text-[#e6edf6] sm:text-3xl">
            A phone, a room, and the shortest way across it.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-[#44546a] dark:text-[#9fb0c6]">
            SpatialOS uses Niantic Spatial&apos;s visual positioning to find a phone inside a scanned room,
            then routes people and robots through it. It runs today in SFSU room HSS 349.
          </p>
        </div>

        <div className="mx-auto w-full max-w-md overflow-hidden rounded-lg border border-[#c9d4e0] dark:border-[#22344d]">
          <RoomMap animate={!reduced} />
        </div>
      </div>

    </header>
  );
}
