"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.push("/vault");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="auth-page">
        <span className="spinner" />
      </div>
    );
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1
        style={{
          fontSize: "2.5rem",
          fontWeight: 800,
          marginBottom: "0.75rem",
          color: "var(--primary)",
        }}
      >
        WhereVault
      </h1>
      <p
        style={{
          fontSize: "1.1rem",
          color: "var(--text-muted)",
          maxWidth: 480,
          marginBottom: "2rem",
        }}
      >
        Secure digital vault for your passwords, legal documents, and digital
        assets. Designate trustees for digital inheritance.
      </p>
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <Link href="/register" className="btn btn-primary">
          Get Started
        </Link>
        <Link href="/login" className="btn btn-ghost">
          Sign In
        </Link>
      </div>
    </main>
  );
}
