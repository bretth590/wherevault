"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { trustees as trusteesApi, ApiError, InviteInfo } from "@/lib/api";

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteError, setInviteError] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState("");
  const [accepted, setAccepted] = useState(false);

  const fetchInvite = useCallback(async () => {
    try {
      const res = await trusteesApi.inviteInfo(token);
      setInvite(res.invite);
    } catch (err) {
      setInviteError(
        err instanceof ApiError ? err.message : "Failed to load invitation",
      );
    } finally {
      setLoadingInvite(false);
    }
  }, [token]);

  useEffect(() => {
    fetchInvite();
  }, [fetchInvite]);

  async function handleAccept() {
    setAcceptError("");
    setAccepting(true);
    try {
      await trusteesApi.accept(token);
      setAccepted(true);
      setTimeout(() => {
        router.push("/vault/inheritance?tab=received");
      }, 1500);
    } catch (err) {
      setAcceptError(
        err instanceof ApiError ? err.message : "Failed to accept invitation",
      );
    } finally {
      setAccepting(false);
    }
  }

  const roleLabel = invite?.role === "EXECUTOR" ? "executor" : "trustee";
  const returnTo = `/invite/${token}`;
  const loginUrl = `/login?returnTo=${encodeURIComponent(returnTo)}`;
  const registerUrl = `/register?returnTo=${encodeURIComponent(returnTo)}`;

  if (loadingInvite || authLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card card" style={{ textAlign: "center" }}>
          <span className="spinner" />
          <p style={{ marginTop: "1rem", color: "var(--text-muted)" }}>
            Loading invitation...
          </p>
        </div>
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="auth-page">
        <div className="auth-card card" style={{ textAlign: "center" }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "rgba(239,68,68,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 1rem", fontSize: "1.5rem",
            }}
          >
            !
          </div>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Invalid Invitation</h1>
          <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>{inviteError}</p>
          <Link href="/" className="btn btn-primary">Go to WhereVault</Link>
        </div>
      </div>
    );
  }

  if (!invite) return null;

  if (invite.expired) {
    return (
      <div className="auth-page">
        <div className="auth-card card" style={{ textAlign: "center" }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "rgba(245,158,11,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 1rem", fontSize: "1.5rem", color: "var(--warning)",
            }}
          >
            !
          </div>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Invitation Expired</h1>
          <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
            This invitation from <strong>{invite.grantorName}</strong> has expired. Please ask them to send a new one.
          </p>
          <Link href="/" className="btn btn-primary">Go to WhereVault</Link>
        </div>
      </div>
    );
  }

  if (invite.status !== "PENDING") {
    return (
      <div className="auth-page">
        <div className="auth-card card" style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            Invitation Already {invite.status === "ACCEPTED" ? "Accepted" : "Revoked"}
          </h1>
          <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
            This invitation has already been {invite.status === "ACCEPTED" ? "accepted" : "revoked"}.
          </p>
          <Link href={user ? "/vault/inheritance" : "/login"} className="btn btn-primary">
            {user ? "Go to Inheritance" : "Sign In"}
          </Link>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="auth-page">
        <div className="auth-card card" style={{ textAlign: "center" }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "rgba(34,197,94,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 1rem", fontSize: "1.5rem", color: "var(--success)",
            }}
          >
            &#10003;
          </div>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Invitation Accepted</h1>
          <p style={{ color: "var(--text-muted)" }}>Redirecting to your inheritance dashboard...</p>
        </div>
      </div>
    );
  }

  const accessTypes = invite.accessLevel?.types;

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "rgba(99,102,241,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 1rem", fontSize: "1.5rem", color: "var(--primary)",
            }}
          >
            &#9993;
          </div>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.25rem" }}>You&apos;ve Been Invited</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>as a {roleLabel} on WhereVault</p>
        </div>

        <div style={{ background: "var(--bg)", borderRadius: "var(--radius)", padding: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Invited by</div>
            <div style={{ fontWeight: 600 }}>{invite.grantorName}</div>
          </div>
          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Your role</div>
            <span
              style={{
                display: "inline-block", padding: "0.15rem 0.5rem", borderRadius: "4px",
                fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase",
                background: invite.role === "EXECUTOR" ? "rgba(245,158,11,0.15)" : "rgba(99,102,241,0.15)",
                color: invite.role === "EXECUTOR" ? "var(--warning)" : "var(--primary)",
              }}
            >
              {invite.role}
            </span>
          </div>
          {accessTypes && accessTypes.length > 0 && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Access to</div>
              <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                {accessTypes.map((type) => (
                  <span key={type} style={{
                    display: "inline-block", padding: "0.15rem 0.5rem", borderRadius: "4px",
                    fontSize: "0.7rem", background: "var(--bg-hover)", color: "var(--text-muted)",
                  }}>
                    {type.replace("_", " ")}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1.25rem", lineHeight: 1.5 }}>
          By accepting, you agree to be designated as a {roleLabel} for this vault. You may be granted access to vault items when the owner&apos;s configured conditions are met.
        </p>

        {acceptError && <div className="error-text" style={{ marginBottom: "1rem" }}>{acceptError}</div>}

        {user ? (
          <button className="btn btn-primary" onClick={handleAccept} disabled={accepting} style={{ width: "100%", justifyContent: "center" }}>
            {accepting ? <span className="spinner" /> : "Accept Invitation"}
          </button>
        ) : (
          <div>
            <p style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              Sign in or create an account to accept this invitation
            </p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <Link href={loginUrl} className="btn btn-primary" style={{ flex: 1, justifyContent: "center", textAlign: "center" }}>Sign In</Link>
              <Link href={registerUrl} className="btn btn-ghost" style={{ flex: 1, justifyContent: "center", textAlign: "center" }}>Create Account</Link>
            </div>
          </div>
        )}

        {invite.expiresAt && (
          <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "1rem" }}>
            Expires {new Date(invite.expiresAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
          </p>
        )}
      </div>
    </div>
  );
}
