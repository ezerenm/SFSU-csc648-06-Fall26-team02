import DataExplorer from "@/components/home/DataExplorer";
import AboutFooter from "@/components/ui/about-footer";
import UserHeader from "@/components/ui/user-header";
import Link from "next/link";

const buttonStyles = `
  flex items-center
  border-l-6 border-[#1f5bff] dark:border-[#a9c4ff] 
  bg-transparent bg-linear-135
  from-[#f3f6f9] dark:from-[#274072]
  hover:from-[#99B3CC] dark:hover:from-[#416BBE]
  text-sm font-semibold text-[#1f5bff] dark:text-[#a9c4ff] 
  mx-4 my-2 px-5 pr-20 py-3 w-100 max-w-3/4
  hover:w-110 hover:translate-x-1
  hover:cursor-pointer
  transition duration-200 ease-out
`;

export default function Dashboard() {
  return (
    <>
      <UserHeader username="User" role="User" />
      <main className="flex-1 flex flex-col gap-8 px-4 py-12 sm:px-6 md:py-16">
        <p className="text-5xl font-bold tracking-tight text-[#1f5bff] dark:text-[#a9c4ff] sm:text-6xl, cursor-default">
          SpatialOS Dashboard
        </p>
        <span className="bg-[#d5dee8] dark:bg-[#1b2a40] h-1 w-full" />
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/live" className={`${buttonStyles}`}>See live position</Link>
          <Link href="/viewer" className={`${buttonStyles}`}>Open 3D viewer</Link>
          <Link href="/health" className={`${buttonStyles}`}>Localization health</Link>
          <Link href="/operator" className={`${buttonStyles}`}>Operator</Link>
          <a href="#explore" className={`${buttonStyles}`}>Browse the data</a>
        </div>
        <DataExplorer />
      </main>
      <AboutFooter />
    </>
  );
}
