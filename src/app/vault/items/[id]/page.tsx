"use client";

import { useState, useEffect, FormEvent, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  vault,
  folders as foldersApi,
  tags as tagsApi,
  VaultItemDetail,
  Folder,
  Tag,
  ApiError,
} from "@/lib/api";

const ITEM_TYPES = [
  { value: "PASSWORD", label: "Password" },
  { value: "NOTE", label: "Secure Note" },
  { value: "DOCUMENT", label: "Document" },
  { value: "DIGITAL_ASSET", label: "Digital Asset" },
  { value: "OTHER", label: "Other" },
];

const FIELD_CONFIGS: Record<string, { key: string; label: string; type: string }[]> = {
  PASSWORD: [
    { key: "website", label: "Website URL", type: "url" },
    { key: "username", label: "Username", type: "text" },
    { key: "password", label: "Password", type: "password" },
  ],
  DOCUMENT: [
    { key: "documentType", label: "Document Type", type: "text" },
    { key: "content", label: "Content / Details", type: "textarea" },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  NOTE: [{ key: "content", label: "Note Content", type: "textarea" }],
  DIGITAL_ASSET: [
    { key: "platform", label: "Platform / Service", type: "text" },
    { key: "walletAddress", label: "Wallet Address / Account", type: "text" },
    { key: "privateKey", label: "Private Key / Seed Phrase", type: "password" },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  OTHER: [{ key: "content", label: "Content", type: "textarea" }],
};

export default function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [item, setItem] = useState<VaultItemDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [data, setData] = useState<Record<string, string>>({});
  const [folderId, setFolderId] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [foldersList, setFoldersList] = useState<Folder[]>([]);
  const [tagsList, setTagsList] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    Promise.all([
      vault.get(id),
      foldersApi.list(),
      tagsApi.list(),
    ])
      .then(([itemRes, foldersRes, tagsRes]) => {
        const i = itemRes.item;
        setItem(i);
        setType(i.type);
        setTitle(i.title);
        setData(
          Object.fromEntries(
            Object.entries(i.data).map(([k, v]) => [k, String(v ?? "")]),
          ),
        );
        setFolderId(i.folderId || "");
        setSelectedTags(i.tags.map((t) => t.id));
        setFoldersList(foldersRes.folders);
        setTagsList(tagsRes.tags);
      })
      .catch(() => router.push("/vault"))
      .finally(() => setLoading(false));
  }, [id, user, authLoading, router]);

  function updateField(key: string, value: string) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((tid) => tid !== tagId) : [...prev, tagId],
    );
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await vault.update(id, {
        type,
        title,
        data,
        folderId: folderId || null,
        tagIds: selectedTags,
      });
      // Reload item
      const res = await vault.get(id);
      setItem(res.item);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this item? This cannot be undone.")) return;
    try {
      await vault.delete(id);
      router.push("/vault");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete");
    }
  }

  if (loading || authLoading) {
    return (
      <div className="auth-page">
        <span className="spinner" />
      </div>
    );
  }

  if (!item) return null;

  const fields = FIELD_CONFIGS[type] || FIELD_CONFIGS.OTHER;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
        }}
      >
        <Link href="/vault" style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          &larr; Back to vault
        </Link>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {!editing && (
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="error-text" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {editing ? (
        <form onSubmit={handleSave} className="item-form">
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select
                className="input"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {ITEM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Folder</label>
              <select
                className="input"
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
              >
                <option value="">No folder</option>
                {foldersList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Title</label>
            <input
              className="input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {fields.map((field) => (
            <div className="form-group" key={field.key}>
              <label>{field.label}</label>
              {field.type === "textarea" ? (
                <textarea
                  className="input"
                  rows={4}
                  value={data[field.key] || ""}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  style={{ resize: "vertical" }}
                />
              ) : (
                <input
                  className="input"
                  type={field.type}
                  value={data[field.key] || ""}
                  onChange={(e) => updateField(field.key, e.target.value)}
                />
              )}
            </div>
          ))}

          {tagsList.length > 0 && (
            <div className="form-group">
              <label>Tags</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {tagsList.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className="tag-pill"
                    onClick={() => toggleTag(tag.id)}
                    style={{
                      cursor: "pointer",
                      border: selectedTags.includes(tag.id)
                        ? "1px solid var(--primary)"
                        : "1px solid transparent",
                      background: selectedTags.includes(tag.id)
                        ? "var(--primary)"
                        : "var(--bg-hover)",
                      color: selectedTags.includes(tag.id)
                        ? "#fff"
                        : "var(--text-muted)",
                      padding: "0.3rem 0.7rem",
                      fontSize: "0.8rem",
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? <span className="spinner" /> : "Save Changes"}
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <span
              className="item-type-badge"
              style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
            >
              {ITEM_TYPES.find((t) => t.value === item.type)?.label || item.type}
            </span>
            {item.isFavorite && <span className="favorite-star">&#9733;</span>}
            {item.folder && (
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {item.folder.name}
              </span>
            )}
          </div>

          <h2 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>{item.title}</h2>

          {item.tags.length > 0 && (
            <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.25rem" }}>
              {item.tags.map((tag) => (
                <span key={tag.id} className="tag-pill">
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
              <button
                className="btn btn-ghost"
                style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
                onClick={() => setShowSecrets(!showSecrets)}
              >
                {showSecrets ? "Hide secrets" : "Show secrets"}
              </button>
            </div>

            {fields.map((field) => {
              const value = String(item.data[field.key] ?? "");
              if (!value) return null;
              const isSecret = field.type === "password";
              return (
                <div key={field.key} style={{ marginBottom: "1rem" }}>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      marginBottom: "0.2rem",
                    }}
                  >
                    {field.label}
                  </div>
                  <div
                    style={{
                      fontSize: "0.9rem",
                      fontFamily: isSecret ? "monospace" : "inherit",
                      wordBreak: "break-all",
                      whiteSpace: field.type === "textarea" ? "pre-wrap" : "normal",
                    }}
                  >
                    {isSecret && !showSecrets
                      ? "\u2022".repeat(Math.min(value.length, 20))
                      : value}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: "0.75rem",
              marginTop: "0.75rem",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              display: "flex",
              gap: "1.5rem",
            }}
          >
            <span>Created: {new Date(item.createdAt).toLocaleString()}</span>
            <span>Updated: {new Date(item.updatedAt).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
