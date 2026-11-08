"use client";

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
const ROOM = ROUTE.map((p) => `${sx(p.x)},${sy(p.z)}`).join(" ");
const CYCLE = "9s";


export default function RoomMap({ animate }: { animate: boolean }) {
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

      <path d={ROUTE_D} id="anim-route" pathLength={1} fill="none" strokeWidth={0.2}
        strokeLinecap="round" strokeLinejoin="round" strokeDasharray={1} strokeDashoffset={animate ? 1 : 0}
        className="stroke-[#f2662d]">
        {animate && (
          <animate 
            attributeName="stroke-dashoffset" 
            calcMode="spline"
            keySplines="0.4 0 0.2 1;0.4 0 0.2 1"
            values="1;0;0" 
            keyTimes="0;0.7;1" 
            dur={CYCLE} 
            repeatCount="indefinite" />
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
          <animateMotion 
          dur={CYCLE} 
          repeatCount="indefinite" 
          calcMode="spline" 
          keyPoints="0;1;1" 
          keyTimes="0;0.7;1"
          keySplines="0.4 0 0.2 1;0.4 0 0.2 1">
            <mpath href="#anim-route" />
          </animateMotion>
        ) : (
          <animateMotion dur="0.001s" fill="freeze" keyPoints="1;1" keyTimes="0;1" calcMode="linear">
            <mpath href="#anim-route" />
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
