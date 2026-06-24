'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, CheckCircle2, Download, FileAudio, FileVideo,
  Hash, Image as ImageIcon, Loader2, LockKeyhole, Plus,
  Shield, Trash2, X,
} from 'lucide-react';
import { evidenceApi, sosApi } from '@/lib/api';
import { encryptEvidence } from '@/lib/evidence-crypto';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { useQuery, useMutation } from '@/lib/hooks';
import { AbhayaApiError } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { PageHeader } from '@/components/ui/page-header';
import type { EvidenceItem, EvidenceKind, Incident } from '@/lib/types';

type Filter = 'all' | 'anchored' | 'failed';

export function EvidenceVaultView() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filter, setFilter]           = useState<Filter>('all');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [expandedHash, setExpandedHash] = useState<string | null>(null);

  const {
    data: items, isLoading, error, refresh,
  } = useQuery(
    () => isAuthenticated ? evidenceApi.list() : Promise.resolve([]),
    [isAuthenticated],
    { enabled: isAuthenticated },
  );

  const {
    data: activeIncidents,
  } = useQuery(
    () => isAuthenticated ? sosApi.getActive() : Promise.resolve([]),
    [isAuthenticated],
    { enabled: isAuthenticated },
  );

  const { mutate: deleteItem, isLoading: deleting } = useMutation(evidenceApi.delete);

  const displayed = (items ?? []).filter((item) => {
    if (filter === 'anchored') return item.anchored;
    if (filter === 'failed')   return item.upload_status === 'failed';
    return true;
  });

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const activeIncident: Incident | undefined = activeIncidents?.[0];
    if (!activeIncident) {
      toast('Start an SOS first to attach evidence to an incident.', 'warn');
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const kind: EvidenceKind = file.type.startsWith('video') ? 'video'
        : file.type.startsWith('audio') ? 'audio' : 'photo';

      // Encrypt before upload; sha256Hash is of the plaintext for integrity
      const { encryptedBlob, sha256Hash } = await encryptEvidence(file, activeIncident.id);

      // Upload the encrypted blob; server stores ciphertext, we keep the key in sessionStorage
      const encryptedFile = new File([encryptedBlob], file.name + '.enc', {
        type: 'application/octet-stream',
      });

      await evidenceApi.upload(activeIncident.id, kind, file.name, sha256Hash, encryptedFile);
      toast('Evidence encrypted and uploaded. Hash anchored for integrity.', 'ok');
      refresh();
    } catch (err) {
      toast(err instanceof AbhayaApiError ? err.message : 'Upload failed. File may be too large or unsupported.', 'warn');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDelete(id: string) {
    setDeleteTarget(null);
    try {
      await deleteItem(id);
      toast('Evidence deleted. A deletion audit record has been created.', 'ok');
      refresh();
    } catch (err) {
      toast(err instanceof AbhayaApiError ? err.message : 'Could not delete.', 'warn');
    }
  }

  return (
    <div className="view-container">
      <PageHeader
        eyebrow="Evidence"
        title="Evidence vault"
        subtitle="Captured media with SHA-256 integrity hashes. All access is audited."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={uploading ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : 'Add evidence'}
          </Button>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {activeIncidents?.length === 0 && (
        <div className="evidence-notice warn">
          <AlertTriangle size={14} />
          No active SOS. Start an incident first before adding evidence.
        </div>
      )}

      <div className="filter-tabs">
        {(['all', 'anchored', 'failed'] as Filter[]).map((f) => (
          <button
            key={f}
            className={`filter-tab ${filter === f ? 'is-active' : ''}`}
            onClick={() => setFilter(f)}
            type="button"
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'all' && items && ` (${items.length})`}
            {f === 'anchored' && items && ` (${items.filter((i) => i.anchored).length})`}
            {f === 'failed'   && items && ` (${items.filter((i) => i.upload_status === 'failed').length})`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <EvidenceSkeleton />
      ) : error ? (
        <div className="error-state">
          <AlertTriangle size={32} className="error-state-icon" />
          <h3>Could not load evidence</h3>
          <p>{error.message}</p>
          <Button variant="secondary" onClick={refresh}>Try again</Button>
        </div>
      ) : displayed.length === 0 ? (
        <EmptyEvidence filter={filter} />
      ) : (
        <div className="evidence-grid">
          <AnimatePresence>
            {displayed.map((item, i) => (
              <EvidenceCard
                key={item.id}
                item={item}
                index={i}
                expanded={expandedHash === item.id}
                onToggleHash={() => setExpandedHash(expandedHash === item.id ? null : item.id)}
                onDelete={() => setDeleteTarget(item.id)}
                downloadUrl={evidenceApi.downloadUrl(item.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <IntegrityNotice />

      <AnimatePresence>
        {deleteTarget && (
          <DeleteModal
            onConfirm={() => handleDelete(deleteTarget)}
            onCancel={() => setDeleteTarget(null)}
            deleting={deleting}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KindIcon({ kind }: { kind: EvidenceKind }) {
  if (kind === 'video') return <FileVideo size={18} />;
  if (kind === 'audio') return <FileAudio size={18} />;
  return <ImageIcon size={18} />;
}

function kindTone(kind: EvidenceKind) {
  if (kind === 'video') return 'teal';
  if (kind === 'audio') return 'amber';
  return 'info';
}

function EvidenceCard({ item, index, expanded, onToggleHash, onDelete, downloadUrl }: {
  item: EvidenceItem; index: number; expanded: boolean;
  onToggleHash: () => void; onDelete: () => void; downloadUrl: string;
}) {
  const sizeKb = (item.size_bytes / 1024).toFixed(0);
  const sizeMb = (item.size_bytes / (1024 * 1024)).toFixed(1);
  const displaySize = item.size_bytes > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;

  return (
    <motion.div
      className="evidence-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ delay: index * 0.06 }}
      layout
    >
      <div className="evidence-card-header">
        <div className={`evidence-kind-icon kind-${item.kind}`}><KindIcon kind={item.kind} /></div>
        <div className="evidence-card-meta">
          <span className="evidence-label">{item.label}</span>
          <span className="evidence-size">{displaySize}</span>
        </div>
        <div className="evidence-badges">
          {item.anchored
            ? <Badge tone="ok" icon={<CheckCircle2 size={11} />}>Anchored</Badge>
            : <Badge tone="info">Hashed</Badge>}
          {item.upload_status === 'failed' && <Badge tone="danger">Upload failed</Badge>}
        </div>
      </div>

      <button className="evidence-hash-row" onClick={onToggleHash} type="button" aria-expanded={expanded}>
        <Hash size={12} />
        <span className={`evidence-hash ${expanded ? 'is-expanded' : ''}`}>
          {expanded ? item.sha256_hash : `${item.sha256_hash.slice(0, 16)}…`}
        </span>
      </button>

      <div className="evidence-card-actions">
        <a
          href={downloadUrl}
          className="btn btn-ghost btn-sm"
          download
          target="_blank"
          rel="noreferrer"
          aria-label={`Download ${item.label}`}
        >
          <Download size={14} /> Download
        </a>
        <button
          className="btn btn-ghost btn-sm btn-danger"
          onClick={onDelete}
          type="button"
          aria-label={`Delete ${item.label}`}
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </motion.div>
  );
}

function DeleteModal({ onConfirm, onCancel, deleting }: {
  onConfirm: () => void; onCancel: () => void; deleting: boolean;
}) {
  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className="modal-card"
        initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-icon tone-danger"><Trash2 size={22} /></div>
        <h3 className="modal-title">Delete evidence?</h3>
        <p className="modal-body">
          The file will be permanently deleted. The SHA-256 hash record and a deletion audit
          event will be retained. This cannot be undone.
        </p>
        <div className="modal-actions">
          <Button variant="ghost" onClick={onCancel} icon={<X size={14} />}>Cancel</Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={deleting}
            icon={deleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
          >
            Delete permanently
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function IntegrityNotice() {
  return (
    <div className="sos-safety-notice" style={{ marginTop: 8 }}>
      <LockKeyhole size={14} />
      <p>
        All evidence is SHA-256 hashed on your device before upload. Hashes are anchored to
        a tamper-evident log. Admin access to raw files is audited. Evidence is not admissible
        in court without additional legal steps.
      </p>
    </div>
  );
}

function EmptyEvidence({ filter }: { filter: Filter }) {
  return (
    <div className="error-state">
      <Shield size={36} style={{ color: 'var(--muted)' }} />
      <h3>
        {filter === 'all' ? 'No evidence yet'
          : filter === 'anchored' ? 'No anchored evidence'
          : 'No failed uploads'}
      </h3>
      <p>
        {filter === 'all'
          ? 'Start an SOS and use the upload button to capture evidence during an incident.'
          : 'Change the filter to see all items.'}
      </p>
    </div>
  );
}

function EvidenceSkeleton() {
  return (
    <div className="evidence-grid">
      {[1, 2, 3].map((i) => (
        <div key={i} className="evidence-card">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 8 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-text" style={{ width: '60%' }} />
              <div className="skeleton skeleton-text sm" style={{ width: '40%', marginTop: 6 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
