"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  vault,
  folders as foldersApi,
  tags as tagsApi,
  auth,
  VaultItemSummary,
  Folder,
  Tag,
  Pagination,
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
    <Suspense>
      <VaultContent />
    </Suspense>
  );
}

function VaultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, logout } = useAuth();

  const [items, setItems] = useState<VaultItemSummary[]>([]);
  const [foldersList, setFoldersList] = useState<Folder[]>([]);
  const [tagsList, setTagsList] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, pages: 1, total: 0 });

  const [modalType, setModalType] = useState<"folder" | "tag" | null>(null);
  const [modalValue, setModalValue] = useState("");

  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      const type = searchParams.get("type");
      const folderId = searchParams.get("folderId");
      const tagId = searchParams.get("tagId");
      const favorites = searchParams.get("favorites");
      const q = searchParams.get("q");
      const page = searchParams.get("page");
      if (type) params.type = type;
      if (folderId) params.folderId = folderId;
      if (tagId) params.tagId = tagId;
      if (favorites) params.favorites = favorites;
      if (q) params.q = q;
      if (page) params.page = page;

      const [itemsRes, foldersRes, tagsRes] = await Promise.all([
        vault.list(Object.keys(params).length ? params : undefined),
        foldersApi.list(),
        tagsApi.list(),
      ]);

      setItems(itemsRes.items);
      setPagination(itemsRes.pagination);
      setFoldersList(foldersRes.folders);
      setTagsList(tagsRes.tags);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    loadData();
  }, [user, authLoading, router, loadData]);

  function navigate(params: Record<string, string>) {
    const qs = new URLSearchParams(params).toString();
    router.push(`/vault${qs ? `?${qs}` : ""}`);
  }

  function handleSearch() {
    if (search.trim()) navigate({ q: search.trim() });
    else navigate({});
  }

  async function handleToggleFavorite(e: React.MouseEvent, itemId: string) {
    e.preventDefault();
    e.stopPropagation();
    const res = await vault.toggleFavorite(itemId);
    setItems((prev) => prev.map((item) => item.id === itemId ? { ...item, isFavorite: res.item.isFavorite } : item));
  }

  async function handleModalSubmit() {
    if (!modalValue.trim()) return;
    if (modalType === "folder") await foldersApi.create(modalValue.trim());
    else if (modalType === "tag") await tagsApi.create(modalValue.trim());
    setModalType(null);
    setModalValue("");
    loadData();
  }

  async function handleDeleteAccount() {
    setDeleteError("");
    try {
      await auth.deleteAccount(deletePassword);
      router.push("/login");
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account");
    }
  }

  function navigateToPage(page: number) {
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
    params.page = String(page);
    const qs = new URLSearchParams(params).toString();
    router.push(`/vault${qs ? `?${qs}` : ""}`);
  }

  if (authLoading || (!user && !loading)) {
    return <div className="auth-page"><span className="spinner" /></div>;
  }

  return (
    <div className="vault-layout">
      <aside className="vault-sidebar">
        <div className="brand">WhereVault</div>
        <button className={`sidebar-item ${activeFilter === "all" ? "active" : ""}`} onClick={() => { setActiveFilter("all"); navigate({}); }}>All Items</button>
        <button className={`sidebar-item ${activeFilter === "favorites" ? "active" : ""}`} onClick={() => { setActiveFilter("favorites"); navigate({ favorites: "true" }); }}>Favorites</button>
        <Link href="/vault/inheritance" className="sidebar-item">Digital Inheritance</Link>

        <h2>Types</h2>
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <button key={key} className={`sidebar-item ${activeFilter === `type:${key}` ? "active" : ""}`} onClick={() => { setActiveFilter(`type:${key}`); navigate({ type: key }); }}>{label}</button>
        ))}

        <h2>Folders <button onClick={() => { setModalType("folder"); setModalValue(""); }} style={{ float: "right", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.85rem" }}>+</button></h2>
        {foldersList.map((folder) => (
          <button key={folder.id} className={`sidebar-item ${activeFilter === `folder:${folder.id}` ? "active" : ""}`} onClick={() => { setActiveFilter(`folder:${folder.id}`); navigate({ folderId: folder.id }); }}>
            {folder.name}
            {folder._count && <span className="count">{folder._count.vaultItems}</span>}
          </button>
        ))}

        <h2>Tags <button onClick={() => { setModalType("tag"); setModalValue(""); }} style={{ float: "right", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.85rem" }}>+</button></h2>
        {tagsList.map((tag) => (
          <button key={tag.id} className={`sidebar-item ${activeFilter === `tag:${tag.id}` ? "active" : ""}`} onClick={() => { setActiveFilter(`tag:${tag.id}`); navigate({ tagId: tag.id }); }}>
            {tag.color && <span style={{ width: 8, height: 8, borderRadius: "50%", background: tag.color, display: "inline-block" }} />}
            {tag.name}
            {tag._count && <span className="count">{tag._count.items}</span>}
          </button>
        ))}

        <div style={{ marginTop: "auto", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", padding: "0.5rem 0.6rem" }}>{user?.email}</div>
          <button className="sidebar-item" onClick={async () => { await logout(); router.push("/login"); }}>Sign out</button>
          <button className="sidebar-item" onClick={() => { setShowDeleteAccount(true); setDeletePassword(""); setDeleteError(""); }} style={{ color: "var(--danger)", fontSize: "0.8rem" }}>Delete Account</button>
        </div>
      </aside>

      <main className="vault-main">
        <div className="vault-header">
          <h1>
            {searchParams.get("q") ? `Search: "${searchParams.get("q")}"` : searchParams.get("favorites") ? "Favorites" : searchParams.get("type") ? TYPE_LABELS[searchParams.get("type")!] || "Items" : "All Items"}
          </h1>
          <div className="search-bar">
            <input className="input" type="search" placeholder="Search vault..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
          </div>
          <Link href="/vault/items/new" className="btn btn-primary">+ New Item</Link>
        </div>

        {loading ? (
          <div className="empty-state"><span className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <h3>No items yet</h3>
            <p>Add your first password, document, or note to get started.</p>
            <Link href="/vault/items/new" className="btn btn-primary">+ New Item</Link>
          </div>
        ) : (
          <>
            <div className="items-grid">
              {items.map((item) => (
                <Link href={`/vault/items/${item.id}`} key={item.id} className="item-card">
                  <div className="item-card-header">
                    <span className="item-type-badge">{TYPE_LABELS[item.type] || item.type}</span>
                    <span className="favorite-star" onClick={(e) => handleToggleFavorite(e, item.id)} role="button" tabIndex={0}>
                      {item.isFavorite ? "\u2605" : "\u2606"}
                    </span>
                  </div>
                  <div className="item-card-title">{item.title}</div>
                  <div className="item-card-meta">
                    {item.folder && <span>{item.folder.name}</span>}
                    {item.tags.map((tag) => (
                      <span key={tag.id} className="tag-pill">
                        {tag.color && <span style={{ width: 6, height: 6, borderRadius: "50%", background: tag.color, display: "inline-block" }} />}
                        {tag.name}
                      </span>
                    ))}
                    <span style={{ marginLeft: "auto" }}>{new Date(item.updatedAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>

            {pagination.pages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem", marginTop: "1.5rem" }}>
                <button className="btn" disabled={pagination.page <= 1} onClick={() => navigateToPage(pagination.page - 1)} style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}>Previous</button>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Page {pagination.page} of {pagination.pages} ({pagination.total} items)</span>
                <button className="btn" disabled={pagination.page >= pagination.pages} onClick={() => navigateToPage(pagination.page + 1)} style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}>Next</button>
              </div>
            )}
          </>
        )}
      </main>

      {showDeleteAccount && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowDeleteAccount(false)}>
          <div style={{ background: "var(--bg-card)", padding: "1.5rem", borderRadius: 12, width: "100%", maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: "var(--danger)" }}>Delete Account</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>This will permanently delete your account and all vault data. This action cannot be undone.</p>
            {deleteError && <div className="error-text" style={{ marginBottom: "0.5rem" }}>{deleteError}</div>}
            <form onSubmit={(e) => { e.preventDefault(); handleDeleteAccount(); }}>
              <label style={{ fontSize: "0.8rem" }}>Enter your password to confirm</label>
              <input className="input" type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="Your password" autoFocus required />
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                <button type="submit" className="btn btn-danger" disabled={!deletePassword}>Delete My Account</button>
                <button type="button" className="btn" onClick={() => setShowDeleteAccount(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalType && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setModalType(null)}>
          <div style={{ background: "var(--bg-card)", padding: "1.5rem", borderRadius: 12, width: "100%", maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Create {modalType === "folder" ? "Folder" : "Tag"}</h3>
            <form onSubmit={(e) => { e.preventDefault(); handleModalSubmit(); }}>
              <input className="input" type="text" placeholder={`${modalType === "folder" ? "Folder" : "Tag"} name`} value={modalValue} onChange={(e) => setModalValue(e.target.value)} autoFocus />
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                <button type="submit" className="btn btn-primary" disabled={!modalValue.trim()}>Create</button>
                <button type="button" className="btn" onClick={() => setModalType(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
