import Image from "next/image";

export default function DakshPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        padding: "40px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "white",
          borderRadius: "24px",
          padding: "42px",
          textAlign: "center",
          boxShadow: "0 20px 50px rgba(15, 23, 42, 0.10)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            width: "190px",
            height: "190px",
            margin: "0 auto 24px",
            borderRadius: "50%",
            overflow: "hidden",
            border: "4px solid white",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.18)",
            position: "relative",
          }}
        >
          <Image
            src="/daksh.jpeg"
            alt="Daksh Kumar"
            fill
            style={{
              objectFit: "cover",
              objectPosition: "center",
            }}
          />
        </div>

        <h1
          style={{
            fontSize: "34px",
            fontWeight: "700",
            color: "#0f172a",
            margin: "0 0 8px",
          }}
        >
          Daksh Kumar
        </h1>

        <p
          style={{
            color: "#64748b",
            fontSize: "17px",
            margin: "0 0 18px",
          }}
        >
          CSC 648 · Team 02
        </p>

        <div
          style={{
            display: "inline-block",
            background: "#eff6ff",
            color: "#2563eb",
            border: "1px solid #bfdbfe",
            padding: "8px 18px",
            borderRadius: "999px",
            fontSize: "14px",
            fontWeight: "600",
            marginBottom: "26px",
          }}
        >
          Team Lead
        </div>

        <p
          style={{
            color: "#475569",
            fontSize: "15px",
            lineHeight: "1.7",
            margin: "0 0 30px",
          }}
        >
          Computer Science student at San Francisco State University,
          interested in AI, software engineering, and building products that
          solve real-world problems.
        </p>

        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <a
            href="https://github.com/YOUR-GITHUB-USERNAME"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "12px 22px",
              borderRadius: "12px",
              background: "#0f172a",
              color: "white",
              textDecoration: "none",
              fontWeight: "600",
              fontSize: "15px",
            }}
          >
            GitHub
          </a>

          <a
            href="https://www.linkedin.com/in/daksh-kumar06/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "12px 22px",
              borderRadius: "12px",
              background: "#0a66c2",
              color: "white",
              textDecoration: "none",
              fontWeight: "600",
              fontSize: "15px",
            }}
          >
            LinkedIn
          </a>
        </div>
      </div>
    </main>
  );
}
