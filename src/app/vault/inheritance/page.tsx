"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  trustees as trusteesApi,
  triggers as triggersApi,
  deadManSwitch as dmsApi,
  auditLog as auditApi,
  vault,
  TrusteeRecord,
  ReceivedTrustee,
  AccessTrigger,
  DeadManSwitchStatus,
  AuditEntry,
  VaultItemSummary,
} from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  TRUSTEE: "Trustee",
  EXECUTOR: "Executor",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  REVOKED: "Revoked",
};

const TRIGGER_TYPE_LABELS: Record<string, string> = {
  MANUAL: "Manual Release",
  DEAD_MAN_SWITCH: "Dead Man Switch",
  INACTIVITY: "Inactivity",
};

const TRIGGER_STATUS_LABELS: Record<string, string> = {
  ARMED: "Armed",
  TRIGGERED: "Triggered",
  EXECUTED: "Executed",
  CANCELLED: "Cancelled",
  OVERRIDDEN: "Overridden",
};

type Tab = "trustees" | "triggers" | "received" | "audit";

export default function InheritancePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("trustees");

  // Trustees state
  const [myTrustees, setMyTrustees] = useState<TrusteeRecord[]>([]);
  const [receivedTrustees, setReceivedTrustees] = useState<ReceivedTrustee[]>([]);
  const [triggersList, setTriggersList] = useState<AccessTrigger[]>([]);
  const [dmsStatus, setDmsStatus] = useState<DeadManSwitchStatus | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [vaultItems, setVaultItems] = useState<VaultItemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add trustee form
  const [showAddForm, setShowAddForm] = useState(false);
  const [trusteeEmail, setTrusteeEmail] = useState("");
  const [trusteeRole, setTrusteeRole] = useState<"TRUSTEE" | "EXECUTOR">("TRUSTEE");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Add trigger form
  const [showTriggerForm, setShowTriggerForm] = useState(false);
  const [triggerType, setTriggerType] = useState<"MANUAL" | "DEAD_MAN_SWITCH" | "INACTIVITY">("MANUAL");
  const [triggerDelayDays, setTriggerDelayDays] = useState(0);
  const [triggerInactivityDays, setTriggerInactivityDays] = useState(30);

  // Dead man switch form
  const [dmsInterval, setDmsInterval] = useState(30);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [trusteesRes, receivedRes, triggersRes, dmsRes, auditRes, vaultRes] =
        await Promise.all([
          trusteesApi.list(),
          trusteesApi.received(),
          triggersApi.list(),
          dmsApi.status(),
          auditApi.list(),
          vault.list(),
        ]);
      setMyTrustees(trusteesRes.trustees);
      setReceivedTrustees(receivedRes.trustees);
      setTriggersList(triggersRes.triggers);
      setDmsStatus(dmsRes);
      setAuditEntries(auditRes.entries);
      setVaultItems(vaultRes.items);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    loadData();
  }, [user, authLoading, router, loadData]);

  async function handleAddTrustee(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await trusteesApi.add({
        trusteeEmail,
        role: trusteeRole,
        itemIds: selectedItemIds.length > 0 ? selectedItemIds : undefined,
      });
      setTrusteeEmail("");
      setSelectedItemIds([]);
      setShowAddForm(false);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add trustee");
    }
  }

  async function handleRevokeTrustee(id: string) {
    if (!confirm("Revoke this trustee's access?")) return;
    try {
      await trusteesApi.revoke(id);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to revoke trustee");
    }
  }

  async function handleAddTrigger(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await triggersApi.create({
        type: triggerType,
        delayDays: triggerDelayDays,
        inactivityDays: triggerType === "INACTIVITY" ? triggerInactivityDays : undefined,
      });
      setShowTriggerForm(false);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create trigger");
    }
  }

  async function handleFireTrigger(id: string) {
    if (!confirm("Fire this trigger? This will begin the access handoff process.")) return;
    try {
      const res = await triggersApi.fire(id);
      alert(res.message);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fire trigger");
    }
  }

  async function handleOverrideTrigger(id: string) {
    try {
      await triggersApi.override(id);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to override trigger");
    }
  }

  async function handleCancelTrigger(id: string) {
    try {
      await triggersApi.cancel(id);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to cancel trigger");
    }
  }

  async function handleConfigureDMS(e: React.FormEvent) {
    e.preventDefault();
    try {
      await dmsApi.configure(dmsInterval);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to configure dead man switch");
    }
  }

  async function handleCheckIn() {
    try {
      await dmsApi.checkIn();
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to check in");
    }
  }

  async function handleDisableDMS() {
    try {
      await dmsApi.disable();
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to disable dead man switch");
    }
  }

  function toggleItemSelection(itemId: string) {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
    );
  }

  if (authLoading || loading) {
    return (
      <div className="auth-page">
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div className="vault-layout">
      <aside className="vault-sidebar">
        <div className="brand">WhereVault</div>
        <Link href="/vault" className="sidebar-item">
          Back to Vault
        </Link>
        <button
          className={`sidebar-item ${tab === "trustees" ? "active" : ""}`}
          onClick={() => setTab("trustees")}
        >
          My Trustees
        </button>
        <button
          className={`sidebar-item ${tab === "triggers" ? "active" : ""}`}
          onClick={() => setTab("triggers")}
        >
          Access Triggers
        </button>
        <button
          className={`sidebar-item ${tab === "received" ? "active" : ""}`}
          onClick={() => setTab("received")}
        >
          I&apos;m a Trustee For
        </button>
        <button
          className={`sidebar-item ${tab === "audit" ? "active" : ""}`}
          onClick={() => setTab("audit")}
        >
          Audit Log
        </button>
      </aside>

      <main className="vault-main">
        {error && (
          <div
            style={{
              background: "var(--error-bg, #fef2f2)",
              color: "var(--error, #dc2626)",
              padding: "0.75rem 1rem",
              borderRadius: 8,
              marginBottom: "1rem",
            }}
          >
            {error}
          </div>
        )}

        {/* TRUSTEES TAB */}
        {tab === "trustees" && (
          <>
            <div className="vault-header">
              <h1>Trustees & Executors</h1>
              <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
                + Add Trustee
              </button>
            </div>

            {showAddForm && (
              <form
                onSubmit={handleAddTrustee}
                style={{
                  background: "var(--card-bg, #1e1e2e)",
                  padding: "1.5rem",
                  borderRadius: 12,
                  marginBottom: "1.5rem",
                }}
              >
                <h3 style={{ marginTop: 0 }}>Invite a Trustee</h3>
                <div style={{ display: "grid", gap: "1rem", maxWidth: 500 }}>
                  <div>
                    <label className="label">Email</label>
                    <input
                      className="input"
                      type="email"
                      required
                      placeholder="trustee@example.com"
                      value={trusteeEmail}
                      onChange={(e) => setTrusteeEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Role</label>
                    <select
                      className="input"
                      value={trusteeRole}
                      onChange={(e) => setTrusteeRole(e.target.value as "TRUSTEE" | "EXECUTOR")}
                    >
                      <option value="TRUSTEE">Trustee</option>
                      <option value="EXECUTOR">Executor</option>
                    </select>
                  </div>
                  {vaultItems.length > 0 && (
                    <div>
                      <label className="label">
                        Permitted Items (optional — leave empty for all items)
                      </label>
                      <div
                        style={{
                          maxHeight: 200,
                          overflow: "auto",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          padding: "0.5rem",
                        }}
                      >
                        {vaultItems.map((item) => (
                          <label
                            key={item.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              padding: "0.25rem 0.5rem",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedItemIds.includes(item.id)}
                              onChange={() => toggleItemSelection(item.id)}
                            />
                            <span>{item.title}</span>
                            <span
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--text-muted)",
                                marginLeft: "auto",
                              }}
                            >
                              {item.type}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="submit" className="btn btn-primary">
                      Send Invitation
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setShowAddForm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            )}

            {myTrustees.length === 0 ? (
              <div className="empty-state">
                <h3>No trustees yet</h3>
                <p>Add trustees or executors who will have access to your vault when needed.</p>
              </div>
            ) : (
              <div className="items-grid">
                {myTrustees.map((t) => (
                  <div key={t.id} className="item-card">
                    <div className="item-card-header">
                      <span className="item-type-badge">{ROLE_LABELS[t.role]}</span>
                      <span
                        className="item-type-badge"
                        style={{
                          background:
                            t.status === "ACCEPTED"
                              ? "var(--success-bg, #dcfce7)"
                              : t.status === "REVOKED"
                                ? "var(--error-bg, #fef2f2)"
                                : undefined,
                          color:
                            t.status === "ACCEPTED"
                              ? "var(--success, #16a34a)"
                              : t.status === "REVOKED"
                                ? "var(--error, #dc2626)"
                                : undefined,
                        }}
                      >
                        {STATUS_LABELS[t.status]}
                      </span>
                    </div>
                    <div className="item-card-title">
                      {t.trustee.name || t.trustee.email}
                    </div>
                    <div className="item-card-meta">
                      <span>{t.trustee.email}</span>
                    </div>
                    {t.permittedItems.length > 0 && (
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                        Access to: {t.permittedItems.map((i) => i.title).join(", ")}
                      </div>
                    )}
                    {t.activatedAt && (
                      <div style={{ fontSize: "0.8rem", color: "var(--success, #16a34a)", marginTop: "0.25rem" }}>
                        Activated: {new Date(t.activatedAt).toLocaleDateString()}
                      </div>
                    )}
                    {t.status !== "REVOKED" && (
                      <button
                        className="btn"
                        style={{ marginTop: "0.75rem", fontSize: "0.8rem" }}
                        onClick={() => handleRevokeTrustee(t.id)}
                      >
                        Revoke Access
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* TRIGGERS TAB */}
        {tab === "triggers" && (
          <>
            <div className="vault-header">
              <h1>Access Triggers</h1>
              <button className="btn btn-primary" onClick={() => setShowTriggerForm(!showTriggerForm)}>
                + New Trigger
              </button>
            </div>

            {/* Dead Man Switch section */}
            <div
              style={{
                background: "var(--card-bg, #1e1e2e)",
                padding: "1.5rem",
                borderRadius: 12,
                marginBottom: "1.5rem",
              }}
            >
              <h3 style={{ marginTop: 0 }}>Dead Man Switch</h3>
              {dmsStatus?.enabled ? (
                <div>
                  <p>
                    Check-in every <strong>{dmsStatus.checkInIntervalDays} days</strong>.
                    {dmsStatus.lastCheckIn && (
                      <>
                        {" "}
                        Last check-in:{" "}
                        <strong>{new Date(dmsStatus.lastCheckIn).toLocaleDateString()}</strong>.
                      </>
                    )}
                    {dmsStatus.nextCheckInDue && (
                      <>
                        {" "}
                        Next due:{" "}
                        <strong
                          style={{
                            color: dmsStatus.isOverdue ? "var(--error, #dc2626)" : undefined,
                          }}
                        >
                          {new Date(dmsStatus.nextCheckInDue).toLocaleDateString()}
                          {dmsStatus.isOverdue && " (OVERDUE)"}
                        </strong>
                      </>
                    )}
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button className="btn btn-primary" onClick={handleCheckIn}>
                      Check In Now
                    </button>
                    <button className="btn" onClick={handleDisableDMS}>
                      Disable
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleConfigureDMS}>
                  <p style={{ color: "var(--text-muted)" }}>
                    If you don&apos;t check in within the set interval, your trustees will be notified.
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "end" }}>
                    <div>
                      <label className="label">Check-in interval (days)</label>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={365}
                        value={dmsInterval}
                        onChange={(e) => setDmsInterval(Number(e.target.value))}
                        style={{ width: 120 }}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary">
                      Enable
                    </button>
                  </div>
                </form>
              )}
            </div>

            {showTriggerForm && (
              <form
                onSubmit={handleAddTrigger}
                style={{
                  background: "var(--card-bg, #1e1e2e)",
                  padding: "1.5rem",
                  borderRadius: 12,
                  marginBottom: "1.5rem",
                }}
              >
                <h3 style={{ marginTop: 0 }}>New Access Trigger</h3>
                <div style={{ display: "grid", gap: "1rem", maxWidth: 500 }}>
                  <div>
                    <label className="label">Trigger Type</label>
                    <select
                      className="input"
                      value={triggerType}
                      onChange={(e) =>
                        setTriggerType(e.target.value as "MANUAL" | "DEAD_MAN_SWITCH" | "INACTIVITY")
                      }
                    >
                      <option value="MANUAL">Manual Release</option>
                      <option value="DEAD_MAN_SWITCH">Dead Man Switch</option>
                      <option value="INACTIVITY">Inactivity</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Delay (days after trigger before access is granted)</label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={365}
                      value={triggerDelayDays}
                      onChange={(e) => setTriggerDelayDays(Number(e.target.value))}
                      style={{ width: 120 }}
                    />
                  </div>
                  {triggerType === "INACTIVITY" && (
                    <div>
                      <label className="label">Inactivity threshold (days)</label>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={365}
                        value={triggerInactivityDays}
                        onChange={(e) => setTriggerInactivityDays(Number(e.target.value))}
                        style={{ width: 120 }}
                      />
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="submit" className="btn btn-primary">
                      Create Trigger
                    </button>
                    <button type="button" className="btn" onClick={() => setShowTriggerForm(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            )}

            {triggersList.length === 0 ? (
              <div className="empty-state">
                <h3>No triggers yet</h3>
                <p>Create access triggers to control when your trustees get access.</p>
              </div>
            ) : (
              <div className="items-grid">
                {triggersList.map((t) => (
                  <div key={t.id} className="item-card">
                    <div className="item-card-header">
                      <span className="item-type-badge">{TRIGGER_TYPE_LABELS[t.type]}</span>
                      <span
                        className="item-type-badge"
                        style={{
                          background:
                            t.status === "ARMED"
                              ? "var(--warning-bg, #fefce8)"
                              : t.status === "EXECUTED"
                                ? "var(--success-bg, #dcfce7)"
                                : t.status === "TRIGGERED"
                                  ? "var(--error-bg, #fef2f2)"
                                  : undefined,
                          color:
                            t.status === "ARMED"
                              ? "var(--warning, #ca8a04)"
                              : t.status === "EXECUTED"
                                ? "var(--success, #16a34a)"
                                : t.status === "TRIGGERED"
                                  ? "var(--error, #dc2626)"
                                  : undefined,
                        }}
                      >
                        {TRIGGER_STATUS_LABELS[t.status]}
                      </span>
                    </div>
                    <div className="item-card-title">
                      {TRIGGER_TYPE_LABELS[t.type]}
                    </div>
                    <div className="item-card-meta">
                      <span>Delay: {t.delayDays} days</span>
                      {t.inactivityDays && <span>Inactivity: {t.inactivityDays} days</span>}
                    </div>
                    {t.triggeredAt && (
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                        Triggered: {new Date(t.triggeredAt).toLocaleString()}
                      </div>
                    )}
                    {t.executesAt && t.status === "TRIGGERED" && (
                      <div style={{ fontSize: "0.8rem", color: "var(--error, #dc2626)", marginTop: "0.25rem" }}>
                        Access grants: {new Date(t.executesAt).toLocaleString()}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                      {t.status === "ARMED" && t.type === "MANUAL" && (
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: "0.8rem" }}
                          onClick={() => handleFireTrigger(t.id)}
                        >
                          Fire
                        </button>
                      )}
                      {t.status === "TRIGGERED" && (
                        <button
                          className="btn"
                          style={{ fontSize: "0.8rem" }}
                          onClick={() => handleOverrideTrigger(t.id)}
                        >
                          Override
                        </button>
                      )}
                      {(t.status === "ARMED" || t.status === "TRIGGERED") && (
                        <button
                          className="btn"
                          style={{ fontSize: "0.8rem" }}
                          onClick={() => handleCancelTrigger(t.id)}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* RECEIVED TAB */}
        {tab === "received" && (
          <>
            <div className="vault-header">
              <h1>Vaults I&apos;m a Trustee For</h1>
            </div>
            {receivedTrustees.length === 0 ? (
              <div className="empty-state">
                <h3>None yet</h3>
                <p>You haven&apos;t been designated as a trustee for any vault.</p>
              </div>
            ) : (
              <div className="items-grid">
                {receivedTrustees.map((t) => (
                  <div key={t.id} className="item-card">
                    <div className="item-card-header">
                      <span className="item-type-badge">{ROLE_LABELS[t.role]}</span>
                      <span className="item-type-badge">{STATUS_LABELS[t.status]}</span>
                    </div>
                    <div className="item-card-title">
                      {t.grantor.name || t.grantor.email}&apos;s Vault
                    </div>
                    <div className="item-card-meta">
                      <span>{t.grantor.email}</span>
                    </div>
                    {t.activatedAt ? (
                      <Link
                        href={`/vault/inheritance/access/${t.id}`}
                        className="btn btn-primary"
                        style={{ marginTop: "0.75rem", fontSize: "0.8rem", display: "inline-block" }}
                      >
                        Access Vault
                      </Link>
                    ) : (
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                        Access not yet activated
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* AUDIT TAB */}
        {tab === "audit" && (
          <>
            <div className="vault-header">
              <h1>Audit Log</h1>
            </div>
            {auditEntries.length === 0 ? (
              <div className="empty-state">
                <h3>No activity yet</h3>
                <p>Actions related to trustee access will appear here.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {auditEntries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      background: "var(--card-bg, #1e1e2e)",
                      padding: "0.75rem 1rem",
                      borderRadius: 8,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "0.85rem",
                        }}
                      >
                        {entry.action.replace(/_/g, " ")}
                      </span>
                      <span
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "0.8rem",
                          marginLeft: "0.75rem",
                        }}
                      >
                        by {entry.actor.name || entry.actor.email}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
