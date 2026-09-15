import Image from "next/image";

export default function NoahsPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 py-12 text-center text-white">
      <div className="flex w-full max-w-md flex-col items-center gap-3">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Noah Bran
        </h1>
        <p className="text-lg">nbran@sfsu.edu</p>
        <p className="text-lg">Team 02</p>
        <p className="text-lg">Backend Lead</p>

        <Image
          src="/NoahHeadshot.jpg"
          alt="Noah Bran"
          width={300}
          height={300}
          className="mt-5 h-60 w-60 rounded-lg border border-yellow-400/50 object-cover object-center sm:h-[300px] sm:w-[300px]"
          priority
        />
      </div>
    </main>
  );
}
