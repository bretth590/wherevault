"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { trustees as trusteesApi, VaultItemSummary, VaultItemDetail } from "@/lib/api";

const TYPE_LABELS: Record<string, string> = {
  PASSWORD: "Password",
  DOCUMENT: "Document",
  NOTE: "Note",
  DIGITAL_ASSET: "Digital Asset",
  OTHER: "Other",
};

export default function TrusteeAccessPage() {
  const router = useRouter();
  const params = useParams();
  const trusteeId = params.trusteeId as string;
  const { user, loading: authLoading } = useAuth();

  const [items, setItems] = useState<VaultItemSummary[]>([]);
  const [selectedItem, setSelectedItem] = useState<VaultItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await trusteesApi.listVault(trusteeId);
      setItems(res.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load vault");
    } finally {
      setLoading(false);
    }
  }, [trusteeId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    loadItems();
  }, [user, authLoading, router, loadItems]);

  async function handleViewItem(itemId: string) {
    try {
      const res = await trusteesApi.viewItem(trusteeId, itemId);
      setSelectedItem(res.item);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to view item");
    }
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
        <Link href="/vault/inheritance" className="sidebar-item">
          Back to Inheritance
        </Link>
        <div style={{ padding: "0.5rem 0.6rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          Viewing as trustee
        </div>
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

        <div className="vault-header">
          <h1>Trustee Vault Access</h1>
        </div>

        {selectedItem ? (
          <div
            style={{
              background: "var(--card-bg, #1e1e2e)",
              padding: "1.5rem",
              borderRadius: 12,
            }}
          >
            <button className="btn" onClick={() => setSelectedItem(null)} style={{ marginBottom: "1rem" }}>
              Back to items
            </button>
            <h2>{selectedItem.title}</h2>
            <span className="item-type-badge">{TYPE_LABELS[selectedItem.type] || selectedItem.type}</span>
            <div style={{ marginTop: "1rem" }}>
              <h3>Data</h3>
              <pre
                style={{
                  background: "var(--bg, #11111b)",
                  padding: "1rem",
                  borderRadius: 8,
                  overflow: "auto",
                  fontSize: "0.85rem",
                }}
              >
                {JSON.stringify(selectedItem.data, null, 2)}
              </pre>
            </div>
            {selectedItem.metadata && (
              <div style={{ marginTop: "1rem" }}>
                <h3>Metadata</h3>
                <pre
                  style={{
                    background: "var(--bg, #11111b)",
                    padding: "1rem",
                    borderRadius: 8,
                    overflow: "auto",
                    fontSize: "0.85rem",
                  }}
                >
                  {JSON.stringify(selectedItem.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <h3>No items available</h3>
            <p>No vault items are accessible under your trustee permissions.</p>
          </div>
        ) : (
          <div className="items-grid">
            {items.map((item) => (
              <div
                key={item.id}
                className="item-card"
                style={{ cursor: "pointer" }}
                onClick={() => handleViewItem(item.id)}
              >
                <div className="item-card-header">
                  <span className="item-type-badge">{TYPE_LABELS[item.type] || item.type}</span>
                </div>
                <div className="item-card-title">{item.title}</div>
                <div className="item-card-meta">
                  {item.folder && <span>{item.folder.name}</span>}
                  <span style={{ marginLeft: "auto" }}>
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
