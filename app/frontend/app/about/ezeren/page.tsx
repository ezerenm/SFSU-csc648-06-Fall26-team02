import Image from "next/image";

export default function EzerensPage() {
    return (
        <main className="min-h-screen bg-black text-yellow flex flex-col items-center justify-center">
            <h1>Ezeren Masangcay</h1>
            <p>Team 02</p>
            <p>Github Master</p>

            <Image
                src="/EzerenNewYorkPic.jpeg"
                alt="Ezeren Masangcay"
                width={300}
                height={300}
            />
                
        </main>
    );
}