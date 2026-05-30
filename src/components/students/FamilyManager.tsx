"use client";
import { useState, useEffect, useCallback } from "react";
import { Users, Link2, X, Plus, UserMinus } from "lucide-react";

interface Member {
  id: string;
  fullName: string;
  studentCode: number | null;
  familyId: string | null;
}

interface Props {
  studentId: string;
  currentFamilyId: string | null;
  studentName: string;
}

export function FamilyManager({ studentId, currentFamilyId, studentName }: Props) {
  const [familyId, setFamilyId]       = useState(currentFamilyId);
  const [members, setMembers]         = useState<Member[]>([]);
  const [loading, setLoading]         = useState(false);
  const [showSearch, setShowSearch]   = useState(false);
  const [confirming, setConfirming]   = useState<Member | null>(null);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  const loadMembers = useCallback(async (fid: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/families?familyId=${encodeURIComponent(fid)}`);
      if (res.ok) {
        const data: Member[] = await res.json();
        setMembers(data.filter(m => m.id !== studentId));
      }
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (familyId) loadMembers(familyId);
  }, [familyId, loadMembers]);

  async function linkWith(selected: Member) {
    setSaving(true);
    setError("");
    try {
      const studentIds = [studentId, selected.id];
      const body: { studentIds: string[]; familyId?: string } = { studentIds };
      if (selected.familyId) body.familyId = selected.familyId;
      else if (familyId)     body.familyId = familyId;

      const res = await fetch("/api/families", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError((d as { error?: string }).error ?? "Error al vincular");
        return;
      }
      const { familyId: newFid } = await res.json();
      setFamilyId(newFid);
      await loadMembers(newFid);
      setShowSearch(false);
      setConfirming(null);
    } finally {
      setSaving(false);
    }
  }

  async function unlinkMember(memberId: string) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/families", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ studentId: memberId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError((d as { error?: string }).error ?? "Error al desvincular");
        return;
      }
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } finally {
      setSaving(false);
    }
  }

  async function unlinkSelf() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/families", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ studentId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError((d as { error?: string }).error ?? "Error al desvincular");
        return;
      }
      setFamilyId(null);
      setMembers([]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <p className="section-title flex items-center gap-2 mb-4">
        <Users size={13} /> Familia
      </p>

      {error && (
        <p className="text-xs text-red-400 bg-red-900/20 rounded-lg p-2 mb-3">{error}</p>
      )}

      {!familyId ? (
        <NoFamily
          showSearch={showSearch}
          setShowSearch={setShowSearch}
          studentId={studentId}
          studentName={studentName}
          confirming={confirming}
          setConfirming={setConfirming}
          saving={saving}
          onLink={linkWith}
        />
      ) : (
        <WithFamily
          members={members}
          loading={loading}
          studentName={studentName}
          showSearch={showSearch}
          setShowSearch={setShowSearch}
          studentId={studentId}
          confirming={confirming}
          setConfirming={setConfirming}
          saving={saving}
          onLink={linkWith}
          onUnlinkMember={unlinkMember}
          onUnlinkSelf={unlinkSelf}
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function NoFamily({
  showSearch, setShowSearch, studentId, studentName,
  confirming, setConfirming, saving, onLink,
}: {
  showSearch: boolean;
  setShowSearch: (v: boolean) => void;
  studentId: string;
  studentName: string;
  confirming: Member | null;
  setConfirming: (m: Member | null) => void;
  saving: boolean;
  onLink: (m: Member) => void;
}) {
  return (
    <div>
      <p className="text-sm text-dojo-muted mb-4">
        Este alumno no está vinculado a ninguna familia.
      </p>
      {!showSearch ? (
        <button
          type="button"
          onClick={() => setShowSearch(true)}
          className="btn-secondary text-sm flex items-center gap-2"
        >
          <Link2 size={14} /> Enlazar con hermano existente
        </button>
      ) : (
        <InlineSearch
          studentId={studentId}
          onCancel={() => { setShowSearch(false); setConfirming(null); }}
          onSelect={setConfirming}
        />
      )}
      {confirming && (
        <ConfirmLink
          studentName={studentName}
          selected={confirming}
          saving={saving}
          onConfirm={() => onLink(confirming)}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}

function WithFamily({
  members, loading, studentName, showSearch, setShowSearch,
  studentId, confirming, setConfirming, saving,
  onLink, onUnlinkMember, onUnlinkSelf,
}: {
  members: Member[];
  loading: boolean;
  studentName: string;
  showSearch: boolean;
  setShowSearch: (v: boolean) => void;
  studentId: string;
  confirming: Member | null;
  setConfirming: (m: Member | null) => void;
  saving: boolean;
  onLink: (m: Member) => void;
  onUnlinkMember: (id: string) => void;
  onUnlinkSelf: () => void;
}) {
  return (
    <div>
      {loading ? (
        <div className="space-y-2 mb-4">
          {[1, 2].map(i => (
            <div key={i} className="h-8 bg-dojo-border/40 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-0 mb-4">
          {members.map(m => (
            <div
              key={m.id}
              className="flex items-center justify-between text-sm py-2 border-b border-dojo-border/30 last:border-0"
            >
              <span className="text-dojo-white">
                {m.fullName}
                {m.studentCode != null && (
                  <span className="text-dojo-muted text-xs ml-1.5">#{m.studentCode}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onUnlinkMember(m.id)}
                disabled={saving}
                title="Desvincular de la familia"
                className="text-dojo-muted hover:text-red-400 transition-colors disabled:opacity-40 ml-3 shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1 text-sm py-2">
            <span className="text-dojo-gold font-medium">{studentName}</span>
            <span className="text-dojo-muted text-xs">(este alumno)</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {!showSearch ? (
          <button
            type="button"
            onClick={() => setShowSearch(true)}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <Plus size={14} /> Agregar otro hermano
          </button>
        ) : (
          <div className="w-full">
            <InlineSearch
              studentId={studentId}
              onCancel={() => { setShowSearch(false); setConfirming(null); }}
              onSelect={setConfirming}
            />
          </div>
        )}
        <button
          type="button"
          onClick={onUnlinkSelf}
          disabled={saving}
          className="btn-ghost text-xs text-dojo-muted hover:text-red-400 flex items-center gap-1.5 disabled:opacity-40"
        >
          <UserMinus size={12} /> Desvincular
        </button>
      </div>

      {confirming && (
        <ConfirmLink
          studentName={studentName}
          selected={confirming}
          saving={saving}
          onConfirm={() => onLink(confirming)}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}

function InlineSearch({
  studentId, onCancel, onSelect,
}: {
  studentId: string;
  onCancel: () => void;
  onSelect: (m: Member) => void;
}) {
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState<Member[]>([]);
  const [busy,     setBusy]     = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/families/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data: Member[] = await res.json();
        setResults(data.filter(m => m.id !== studentId));
      }
    } finally {
      setBusy(false);
    }
  }, [studentId]);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="form-input text-sm flex-1"
          placeholder="Buscar por nombre..."
        />
        <button type="button" onClick={onCancel} className="btn-ghost text-xs px-3">
          Cancelar
        </button>
      </div>
      {busy && <p className="text-xs text-dojo-muted">Buscando...</p>}
      {!busy && results.length > 0 && (
        <div className="rounded-lg border border-dojo-border overflow-hidden">
          {results.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-dojo-darker text-dojo-white border-b border-dojo-border/30 last:border-0 transition-colors"
            >
              {m.fullName}
              {m.studentCode != null && (
                <span className="text-dojo-muted text-xs ml-1.5">#{m.studentCode}</span>
              )}
              {m.familyId && (
                <span className="ml-2 text-xs badge-blue">Con familia</span>
              )}
            </button>
          ))}
        </div>
      )}
      {!busy && query.length >= 2 && results.length === 0 && (
        <p className="text-xs text-dojo-muted">No se encontraron alumnos.</p>
      )}
    </div>
  );
}

function ConfirmLink({
  studentName, selected, saving, onConfirm, onCancel,
}: {
  studentName: string;
  selected: Member;
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const msg = selected.familyId
    ? `¿Agregar ${studentName} a la familia de ${selected.fullName}? Todos quedarán agrupados.`
    : `¿Vincular a ${studentName} y ${selected.fullName} como familia?`;

  return (
    <div className="mt-3 p-3 rounded-lg border border-dojo-gold/40 bg-dojo-gold/5">
      <p className="text-sm text-dojo-white mb-3">{msg}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={saving}
          className="btn-primary text-xs py-1.5 px-4 disabled:opacity-40"
        >
          {saving ? "Guardando..." : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="btn-ghost text-xs"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
