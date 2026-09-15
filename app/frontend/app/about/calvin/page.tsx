import Image from "next/image";

export default function CalvinsPage() {
    return (
        <main className="min-h-screen bg-black text-yellow flex flex-col items-center justify-center">
            <h1>Calvin Mei</h1>
            <p>cmei@sfsu.edu</p>
            <p>Team 02</p>
            <p>Front-End Lead</p>

            <Image
                src="/CM_CINE440-1.png"
                alt="Calvin Mei"
                width={176}
                height={124}
            />
                
        </main>
    );
}