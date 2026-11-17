import Link from "next/link";

const aboutStyles = `
    flex items-center justify-center
    border-t border-[#d5dee8] bg-[#f3f6f9] dark:border-[#1b2a40] dark:bg-[#0b1220]
    px-4 py-2 sm:px-6 md:py-3
    mt-8 text-sm text-[#44546a] dark:text-[#9fb0c6]
`;

export default function AboutFooter() {
  return (
    <footer className="border-t border-[#d5dee8] bg-[#f3f6f9] dark:border-[#1b2a40] dark:bg-[#0b1220]">
      <p className={aboutStyles}>
        Built by&nbsp; 
        <Link href="/about" className="text-[#1f5bff] underline hover:no-underline dark:text-[#6b9bff]">
            CSC 648 Team 02
        </Link> 
        &nbsp;at San Francisco State University with Niantic Spatial VPS, Supabase and Next.js.
      </p>
    </footer>
    )
}