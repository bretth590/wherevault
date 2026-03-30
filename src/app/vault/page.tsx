"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  vault,
  folders as foldersApi,
  tags as tagsApi,
  VaultItemSummary,
  Folder,
  Tag,
} from "@/lib/api";

const TYPE_LABELS: Record<string, string> = {
  PASSWORD: "Password",
  DOCUMENT: "Document",
  NOTE: "Note",
  DIGITAL_ASSET: "Digital Asset",
  OTHER: "Other",
};

export default function VaultPage() {
  return (
    <Suspense fallback={<div className="auth-page"><span className="spinner" /></div>}>
      <VaultPageContent />
    </Suspense>
  );
}

function VaultPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, logout } = useAuth();

  const [items, setItems] = useState<VaultItemSummary[]>([]);
  const [foldersList, setFoldersList] = useState<Folder[]>([]);
  const [tagsList, setTagsList] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};

      const type = searchParams.get("type");
      const folderId = searchParams.get("folderId");
      const tagId = searchParams.get("tagId");
      const favorites = searchParams.get("favorites");
      const q = searchParams.get("q");

      if (type) params.type = type;
      if (folderId) params.folderId = folderId;
      if (tagId) params.tagId = tagId;
      if (favorites) params.favorites = favorites;
      if (q) params.q = q;

      const [itemsRes, foldersRes, tagsRes] = await Promise.all([
        vault.list(Object.keys(params).length ? params : undefined),
        foldersApi.list(),
        tagsApi.list(),
      ]);

      setItems(itemsRes.items);
      setFoldersList(foldersRes.folders);
      setTagsList(tagsRes.tags);
    } catch {
      // If unauthorized, redirect to login
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    loadData();
  }, [user, authLoading, router, loadData]);

  function navigate(params: Record<string, string>) {
    const qs = new URLSearchParams(params).toString();
    router.push(`/vault${qs ? `?${qs}` : ""}`);
  }

  function handleSearch() {
    if (search.trim()) {
      navigate({ q: search.trim() });
    } else {
      navigate({});
    }
  }

  async function handleToggleFavorite(
    e: React.MouseEvent,
    itemId: string,
  ) {
    e.preventDefault();
    e.stopPropagation();
    const res = await vault.toggleFavorite(itemId);
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, isFavorite: res.item.isFavorite } : item,
      ),
    );
  }

  async function handleCreateFolder() {
    const name = prompt("Folder name:");
    if (!name?.trim()) return;
    await foldersApi.create(name.trim());
    loadData();
  }

  async function handleCreateTag() {
    const name = prompt("Tag name:");
    if (!name?.trim()) return;
    await tagsApi.create(name.trim());
    loadData();
  }

  if (authLoading || (!user && !loading)) {
    return (
      <div className="auth-page">
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div className="vault-layout">
      {/* Sidebar */}
      <aside className="vault-sidebar">
        <div className="brand">WhereVault</div>

        <button
          className={`sidebar-item ${activeFilter === "all" ? "active" : ""}`}
          onClick={() => {
            setActiveFilter("all");
            navigate({});
          }}
        >
          All Items
        </button>
        <button
          className={`sidebar-item ${activeFilter === "favorites" ? "active" : ""}`}
          onClick={() => {
            setActiveFilter("favorites");
            navigate({ favorites: "true" });
          }}
        >
          Favorites
        </button>
        <Link href="/vault/inheritance" className="sidebar-item">
          Digital Inheritance
        </Link>

        <h2>Types</h2>
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <button
            key={key}
            className={`sidebar-item ${activeFilter === `type:${key}` ? "active" : ""}`}
            onClick={() => {
              setActiveFilter(`type:${key}`);
              navigate({ type: key });
            }}
          >
            {label}
          </button>
        ))}

        <h2>
          Folders
          <button
            onClick={handleCreateFolder}
            style={{
              float: "right",
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            +
          </button>
        </h2>
        {foldersList.map((folder) => (
          <button
            key={folder.id}
            className={`sidebar-item ${activeFilter === `folder:${folder.id}` ? "active" : ""}`}
            onClick={() => {
              setActiveFilter(`folder:${folder.id}`);
              navigate({ folderId: folder.id });
            }}
          >
            {folder.name}
            {folder._count && (
              <span className="count">{folder._count.vaultItems}</span>
            )}
          </button>
        ))}

        <h2>
          Tags
          <button
            onClick={handleCreateTag}
            style={{
              float: "right",
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            +
          </button>
        </h2>
        {tagsList.map((tag) => (
          <button
            key={tag.id}
            className={`sidebar-item ${activeFilter === `tag:${tag.id}` ? "active" : ""}`}
            onClick={() => {
              setActiveFilter(`tag:${tag.id}`);
              navigate({ tagId: tag.id });
            }}
          >
            {tag.color && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: tag.color,
                  display: "inline-block",
                }}
              />
            )}
            {tag.name}
            {tag._count && <span className="count">{tag._count.items}</span>}
          </button>
        ))}

        <div style={{ marginTop: "auto", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", padding: "0.5rem 0.6rem" }}>
            {user?.email}
          </div>
          <button
            className="sidebar-item"
            onClick={() => {
              logout();
              router.push("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="vault-main">
        <div className="vault-header">
          <h1>
            {searchParams.get("q")
              ? `Search: "${searchParams.get("q")}"`
              : searchParams.get("favorites")
                ? "Favorites"
                : searchParams.get("type")
                  ? TYPE_LABELS[searchParams.get("type")!] || "Items"
                  : "All Items"}
          </h1>
          <div className="search-bar">
            <input
              className="input"
              type="search"
              placeholder="Search vault..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Link href="/vault/items/new" className="btn btn-primary">
            + New Item
          </Link>
        </div>

        {loading ? (
          <div className="empty-state">
            <span className="spinner" />
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <h3>No items yet</h3>
            <p>Add your first password, document, or note to get started.</p>
            <Link href="/vault/items/new" className="btn btn-primary">
              + New Item
            </Link>
          </div>
        ) : (
          <div className="items-grid">
            {items.map((item) => (
              <Link
                href={`/vault/items/${item.id}`}
                key={item.id}
                className="item-card"
              >
                <div className="item-card-header">
                  <span className="item-type-badge">
                    {TYPE_LABELS[item.type] || item.type}
                  </span>
                  <span
                    className="favorite-star"
                    onClick={(e) => handleToggleFavorite(e, item.id)}
                    role="button"
                    tabIndex={0}
                  >
                    {item.isFavorite ? "\u2605" : "\u2606"}
                  </span>
                </div>
                <div className="item-card-title">{item.title}</div>
                <div className="item-card-meta">
                  {item.folder && <span>{item.folder.name}</span>}
                  {item.tags.map((tag) => (
                    <span key={tag.id} className="tag-pill">
                      {tag.color && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: tag.color,
                            display: "inline-block",
                          }}
                        />
                      )}
                      {tag.name}
                    </span>
                  ))}
                  <span style={{ marginLeft: "auto" }}>
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
