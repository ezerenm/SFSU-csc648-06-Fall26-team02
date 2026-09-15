import Image from "next/image";

export default function SumitPage() {
  return (
    <main className="min-h-screen bg-black text-yellow-400 flex flex-col items-center justify-center gap-2">
      <h1 className="text-3xl font-bold">Sumit Kumar</h1>
      <p>Team 02</p>
      <p>AI Master</p>

      <Image
        src="/sumit.png"
        alt="Sumit Kumar"
        width={300}
        height={300}
        className="rounded-full mt-4"
      />

      <a
        href="https://github.com/Sumitkumar06"
        target="_blank"
        rel="noopener noreferrer"
        className="underline mt-2"
      >
        GitHub
      </a>
    </main>
  );
}