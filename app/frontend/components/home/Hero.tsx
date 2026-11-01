"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

// Decorative copy of the measured HSS 349 corner positions (world frame, meters).
// The live pages read the real graph from the database; this only drives the intro animation.
const DOOR = { x: -4.03, z: -2.45 };
const DOOR_SIDE = { x: -1.9, z: 3.32 };
const FAR = { x: -5.98, z: 5.51 };
const FRONT = { x: -8.46, z: 0.11 };

const PAD = 1.8;
const MIN_X = FRONT.x - PAD;
const MAX_X = DOOR_SIDE.x + PAD;
const MIN_Z = DOOR.z - PAD;
const MAX_Z = FAR.z + PAD;
const W = MAX_X - MIN_X;
const H = MAX_Z - MIN_Z;
const sx = (x: number) => +(x - MIN_X).toFixed(3);
const sy = (z: number) => +(MAX_Z - z).toFixed(3);
const frac = (v: number) => ((v % 1) + 1) % 1;

// Walk the room: door -> door-side corner -> far corner -> front.
const ROUTE = [DOOR, DOOR_SIDE, FAR, FRONT];
const ROUTE_D = ROUTE.map((p, i) => `${i ? "L" : "M"}${sx(p.x)} ${sy(p.z)}`).join(" ");
const ROOM = [DOOR, DOOR_SIDE, FAR, FRONT].map((p) => `${sx(p.x)},${sy(p.z)}`).join(" ");
const CYCLE = "9s";

function subscribe(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const usePrefersReducedMotion = () =>
  useSyncExternalStore(subscribe, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);

function RoomMap({ animate }: { animate: boolean }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Top-down map of room HSS 349. A route is drawn from the door, along the walls, to the front of the room while a position marker follows it."
    >
      <defs>
        {/* One-meter floor grid aligned to world coordinates */}
        <pattern id="floor-grid" width={1} height={1} patternUnits="userSpaceOnUse" x={frac(-MIN_X)} y={frac(MAX_Z)}>
          <path d="M1 0H0V1" fill="none" strokeWidth={0.02} className="stroke-[#c9d4e0] dark:stroke-[#22344d]" />
        </pattern>
      </defs>
      <rect width={W} height={H} className="fill-[#f3f6f9] dark:fill-[#0d1626]" />
      <rect width={W} height={H} fill="url(#floor-grid)" />

      <polygon points={ROOM} strokeWidth={0.07} strokeLinejoin="round"
        className="fill-white/70 stroke-[#8fa3b8] dark:fill-[#12203a]/80 dark:stroke-[#4b6485]" />

      <path d={ROUTE_D} id="hero-route" pathLength={1} fill="none" strokeWidth={0.2}
        strokeLinecap="round" strokeLinejoin="round" strokeDasharray={1} strokeDashoffset={animate ? 1 : 0}
        className="stroke-[#f2662d]">
        {animate && (
          <animate attributeName="stroke-dashoffset" values="1;0;0" keyTimes="0;0.7;1" dur={CYCLE} repeatCount="indefinite" />
        )}
      </path>

      {[DOOR, DOOR_SIDE, FAR, FRONT].map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.z)} r={0.16} className="fill-[#101828] dark:fill-[#e6edf6]" />
      ))}

      <g className="fill-[#101828] dark:fill-[#e6edf6]" fontSize={0.42}>
        <text x={sx(DOOR.x) + 0.35} y={sy(DOOR.z) + 0.15}>Door</text>
        <text x={sx(DOOR_SIDE.x) - 0.5} y={sy(DOOR_SIDE.z) + 0.55} textAnchor="end">Door-side corner</text>
        <text x={sx(FAR.x) - 0.2} y={sy(FAR.z) - 0.4}>Far corner</text>
        <text x={sx(FRONT.x) + 0.1} y={sy(FRONT.z) + 0.95}>Front of room</text>
      </g>

      {/* Destination ring appears when the marker arrives */}
      <circle cx={sx(FRONT.x)} cy={sy(FRONT.z)} r={0.42} fill="none" strokeWidth={0.1}
        className="stroke-[#1e9e5a]" opacity={animate ? 0 : 1}>
        {animate && (
          <animate attributeName="opacity" values="0;0;1;1" keyTimes="0;0.69;0.72;1" dur={CYCLE} repeatCount="indefinite" />
        )}
      </circle>

      {/* The phone */}
      <g>
        <circle r={0.62} className="fill-[#1f5bff]/20" />
        <circle r={0.28} className="fill-[#1f5bff] stroke-white" strokeWidth={0.07} />
        {animate ? (
          <animateMotion dur={CYCLE} repeatCount="indefinite" calcMode="linear" keyPoints="0;1;1" keyTimes="0;0.7;1">
            <mpath href="#hero-route" />
          </animateMotion>
        ) : (
          <animateMotion dur="0.001s" fill="freeze" keyPoints="1;1" keyTimes="0;1" calcMode="linear">
            <mpath href="#hero-route" />
          </animateMotion>
        )}
      </g>

      {/* Scale bar */}
      <g className="stroke-[#101828] dark:stroke-[#e6edf6]" strokeWidth={0.07}>
        <path d={`M0.6 ${H - 0.7}h1M0.6 ${H - 0.85}v0.3M1.6 ${H - 0.85}v0.3`} fill="none" />
      </g>
      <text x={1.8} y={H - 0.5} fontSize={0.38} className="fill-[#101828] dark:fill-[#e6edf6]">1 m</text>
    </svg>
  );
}

const steps = [
  { title: "Scan the room once", body: "A Scaniverse scan becomes a map the phone can recognize." },
  { title: "Locate the phone", body: "The iPhone app matches its camera to that map using Niantic Spatial's visual positioning. In HSS 349 it locates itself from every corner in under 10 seconds." },
  { title: "Route to anywhere", body: "Pick a destination and the shortest open path is drawn on the live map, with distance and steps." },
];

export default function Hero() {
  const reduced = usePrefersReducedMotion();
  const button = "inline-flex items-center rounded-md px-5 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f5bff]";

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
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/live" className={`${button} bg-[#1f5bff] text-white hover:bg-[#1648cc]`}>See live position</Link>
            <Link href="/viewer" className={`${button} border border-[#8fa3b8] text-[#101828] hover:bg-white dark:border-[#4b6485] dark:text-[#e6edf6] dark:hover:bg-[#12203a]`}>Open 3D viewer</Link>
            <Link href="/health" className={`${button} border border-[#8fa3b8] text-[#101828] hover:bg-white dark:border-[#4b6485] dark:text-[#e6edf6] dark:hover:bg-[#12203a]`}>Localization health</Link>
            <a href="#explore" className="px-2 py-2.5 text-sm font-semibold text-[#101828] underline underline-offset-4 dark:text-[#e6edf6]">Browse the data</a>
          </div>
          <p className="mt-8 text-sm text-[#44546a] dark:text-[#9fb0c6]">
            Built by CSC 648 Team 02 at San Francisco State University with Niantic Spatial VPS, Supabase and Next.js.
          </p>
        </div>

        <div className="mx-auto w-full max-w-md overflow-hidden rounded-lg border border-[#c9d4e0] dark:border-[#22344d]">
          <RoomMap animate={!reduced} />
        </div>
      </div>

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
    </header>
  );
}
