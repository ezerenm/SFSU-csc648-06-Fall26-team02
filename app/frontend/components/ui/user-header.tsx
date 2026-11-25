"use client";
import Link from "next/dist/client/link";
import {useState, ViewTransition, startTransition, ViewTransitionInstance} from "react";

const headerStyles = `
    border-b border-[#d5dee8] bg-[#f3f6f9] dark:border-[#1b2a40] dark:bg-[#0b1220]
    flex items-center justify-between gap-4 px-4 py-2 sm:px-6 md:py-3
`;

const dropdownStyles = `
    absolute flex flex-col gap-2 z-50 right-4 top-20 w-48
    border border-[#c9d4e0] 
    bg-[#f3f6f9] dark:border-[#22344d] dark:bg-[#0b1220] 
    shadow-lg p-3 
    transition duration-200 ease-out
`;

const profileStyles= `
    flex items-center gap-3 p-1 border-b-1
    border-transparent
    hover:cursor-pointer select-none
    hover:-translate-y-0.5 hover:border-[#d5dee8] dark:hover:border-[#1b2a40]
    transition duration-500 ease-out
`;

const logoutStyles = `
    px-3 py-2 cursor-pointer
    text-sm text-[#101828] dark:text-[#e6edf6] 
    bg-transparent bg-linear-to-r from-transparent from-10%
    hover:from-[#d5dee8] dark:hover:from-[#1b2a40] 
    transition duration-200 ease-in
`;

const dropdownViewTransition = (instance: ViewTransitionInstance) => {
    const anim = instance.new.animate(
        {
            opacity: [0,1],
            transform: ["translateY(-10px)","translateY(0px)"]
        }, 
        {duration:200, easing:'ease-out'}
    );
    return () => anim.cancel();
}

export default function UserHeader({ username = "Guest", role = "User" }: { username: string; role: string }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <header className={headerStyles}>
        <div>
            <Link href="/">SpatialOS</Link>
        </div>
        <div className={profileStyles} onClick={() => startTransition(() => setIsDropdownOpen(!isDropdownOpen))}>
            <p className="text-lg font-semibold text-[#101828] dark:text-[#e6edf6]">Good day, {username}</p>
            <span className="circle w-10 h-10 rounded-full bg-[#1f5bff] dark:bg-[#a9c4ff]"></span>
        </div>

        {isDropdownOpen && (
            <ViewTransition onEnter={dropdownViewTransition} exit="auto">
                {/* <span className="absolute bg-transparent bg-linear-to-b from-[#FFFFFF] inset-0" onClick={() => setIsDropdownOpen(false)}></span> */}
                <div className={dropdownStyles} id="user-dropdown">
                    <div className="flex flex-col gap-1 px-3 py-2 border-b border-[#c9d4e0] dark:border-[#22344d]">
                        <p>{username ?? "Guest"}</p>
                        <p className="text-sm text-[#667085] dark:text-[#94a3b8]"><i>{role}</i></p>
                    </div>
                    <Link href="/" className={logoutStyles}>
                        Logout
                    </Link>
                </div>
            </ViewTransition>
        )}
    </header>
  );
}