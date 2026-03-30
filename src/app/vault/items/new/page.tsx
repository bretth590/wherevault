"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  vault,
  folders as foldersApi,
  tags as tagsApi,
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

const PASSWORD_FIELDS = [
  { key: "website", label: "Website URL", type: "url" },
  { key: "username", label: "Username", type: "text" },
  { key: "password", label: "Password", type: "password" },
];

const DOCUMENT_FIELDS = [
  { key: "documentType", label: "Document Type", type: "text" },
  { key: "content", label: "Content / Details", type: "textarea" },
  { key: "notes", label: "Notes", type: "textarea" },
];

const NOTE_FIELDS = [
  { key: "content", label: "Note Content", type: "textarea" },
];

const DIGITAL_ASSET_FIELDS = [
  { key: "platform", label: "Platform / Service", type: "text" },
  { key: "walletAddress", label: "Wallet Address / Account", type: "text" },
  { key: "privateKey", label: "Private Key / Seed Phrase", type: "password" },
  { key: "notes", label: "Notes", type: "textarea" },
];

function getFieldsForType(type: string) {
  switch (type) {
    case "PASSWORD":
      return PASSWORD_FIELDS;
    case "DOCUMENT":
      return DOCUMENT_FIELDS;
    case "NOTE":
      return NOTE_FIELDS;
    case "DIGITAL_ASSET":
      return DIGITAL_ASSET_FIELDS;
    default:
      return [{ key: "content", label: "Content", type: "textarea" }];
  }
}

export default function NewItemPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [type, setType] = useState("PASSWORD");
  const [title, setTitle] = useState("");
  const [data, setData] = useState<Record<string, string>>({});
  const [folderId, setFolderId] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [foldersList, setFoldersList] = useState<Folder[]>([]);
  const [tagsList, setTagsList] = useState<Tag[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    Promise.all([foldersApi.list(), tagsApi.list()]).then(([f, t]) => {
      setFoldersList(f.folders);
      setTagsList(t.tags);
    });
  }, [user, authLoading, router]);

  function updateField(key: string, value: string) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await vault.create({
        type,
        title,
        data,
        folderId: folderId || undefined,
        tagIds: selectedTags.length ? selectedTags : undefined,
      });
      router.push("/vault");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create item");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <div className="auth-page">
        <span className="spinner" />
      </div>
    );
  }

  const fields = getFieldsForType(type);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link href="/vault" style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          &larr; Back to vault
        </Link>
      </div>

      <h1 style={{ fontSize: "1.3rem", marginBottom: "1.5rem" }}>New Vault Item</h1>

      {error && (
        <div className="error-text" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="item-form">
        <div className="form-row">
          <div className="form-group">
            <label>Type</label>
            <select
              className="input"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setData({});
              }}
            >
              {ITEM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Folder (optional)</label>
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
            placeholder="e.g. Gmail Login, Bank Statement, Crypto Wallet"
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
            {saving ? <span className="spinner" /> : "Save Item"}
          </button>
          <Link href="/vault" className="btn btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
