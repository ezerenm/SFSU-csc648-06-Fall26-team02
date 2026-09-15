import Image from "next/image";

export default function TylersPage() {
    return (
        <main className="min-h-screen bg-black text-yellow flex flex-col items-center justify-center">
            <h1>Tyler Duong</h1>
            <p>924436120@sfsu.edu</p>
            <p>Team 02</p>
            <p>Scrum Master</p>

            <Image
                src="/TylerAvatar.jpg"
                alt="Avatar for Tyler"
                width={300}
                height={300}
            />

        </main>
    );
}