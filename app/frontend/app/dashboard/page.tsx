import DataExplorer from "@/components/home/DataExplorer";
import Link from "next/link";

const button = "inline-flex items-center rounded-md px-5 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f5bff]";

export default function Dashboard() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 px-4 py-12 sm:px-6 md:py-16">
      <header className="text-5xl font-bold tracking-tight text-[#1f5bff] dark:text-[#a9c4ff] sm:text-6xl">SpatialOS Dashboard</header>
      <div className="mt-8 flex flex-wrap items-center gap-3 justify-center">
        <Link href="/live" className={`${button} bg-[#1f5bff] text-white hover:bg-[#1648cc]`}>See live position</Link>
        <Link href="/viewer" className={`${button} border border-[#8fa3b8] text-[#101828] hover:bg-white dark:border-[#4b6485] dark:text-[#e6edf6] dark:hover:bg-[#12203a]`}>Open 3D viewer</Link>
        <Link href="/health" className={`${button} border border-[#8fa3b8] text-[#101828] hover:bg-white dark:border-[#4b6485] dark:text-[#e6edf6] dark:hover:bg-[#12203a]`}>Localization health</Link>
        <Link href="/operator" className={`${button} border border-[#8fa3b8] text-[#101828] hover:bg-white dark:border-[#4b6485] dark:text-[#e6edf6] dark:hover:bg-[#12203a]`}>Operator</Link>
        <a href="#explore" className="px-2 py-2.5 text-sm font-semibold text-[#101828] underline underline-offset-4 dark:text-[#e6edf6]">Browse the data</a>
      </div>
      <DataExplorer />
    </main>
  );
}
