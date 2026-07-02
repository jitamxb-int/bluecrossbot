import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { UploadCloud, FileText, X, Loader2, CheckCircle2, AlertTriangle, Link2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '../../lib/utils';
import { ingestPdf } from '../../features/api/ingestApi';
import type { PdfIngestResponse } from '../../types/ingest.types';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A drag-and-drop .txt dropzone with a selected-files list. */
const Dropzone = ({
  id,
  label,
  files,
  onAdd,
  onRemove,
  disabled,
}: {
  id: string;
  label: string;
  files: File[];
  onAdd: (incoming: File[]) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          // Snapshot to an array now — the FileList becomes invalid after the event.
          onAdd(Array.from(e.dataTransfer.files));
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-7 text-center cursor-pointer transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/40',
          disabled && 'opacity-60 pointer-events-none',
        )}
      >
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
          <UploadCloud className="w-4 h-4 text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground">
          Drop .txt files or <span className="text-primary">browse</span>
        </p>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept=".txt"
          multiple
          className="hidden"
          onChange={(e) => {
            // Materialize the FileList BEFORE resetting value (reset empties it).
            const picked = Array.from(e.target.files ?? []);
            e.target.value = '';
            onAdd(picked);
          }}
        />
      </div>
      {files.length > 0 && (
        <div className="rounded-lg border border-border divide-y">
          {files.map((file, i) => (
            <div key={`${file.name}:${file.size}`} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">{formatBytes(file.size)}</span>
              </div>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-muted-foreground hover:text-destructive transition-colors"
                aria-label={`Remove ${file.name}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PdfUploader = () => {
  const [piFiles, setPiFiles] = useState<File[]>([]);
  const [pilFiles, setPilFiles] = useState<File[]>([]);
  const [division, setDivision] = useState('');
  const [chunkSize, setChunkSize] = useState('');
  const [chunkOverlap, setChunkOverlap] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<PdfIngestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const merge = (prev: File[], incoming: File[]) => {
    const accepted = incoming.filter((f) => f.name.toLowerCase().endsWith('.txt'));
    const rejected = incoming.length - accepted.length;
    if (rejected > 0) {
      toast.error(`Skipped ${rejected} non-.txt file${rejected > 1 ? 's' : ''}. Only .txt is supported.`);
    }
    const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
    const out = [...prev];
    for (const f of accepted) {
      const key = `${f.name}:${f.size}`;
      if (!seen.has(key)) { seen.add(key); out.push(f); }
    }
    return out;
  };

  const canUpload = (piFiles.length > 0 || pilFiles.length > 0) && division.trim() !== '' && !uploading;

  const upload = async () => {
    if (!canUpload) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const res = await ingestPdf(piFiles, pilFiles, division.trim(), {
        chunkSize: chunkSize ? Number(chunkSize) : undefined,
        chunkOverlap: chunkOverlap ? Number(chunkOverlap) : undefined,
      });
      setResult(res);
      setPiFiles([]);
      setPilFiles([]);
      toast.success(`Ingested ${res.total_chunks} chunks from ${res.total_documents} document(s).`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed.';
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload Prescribing Information (PI) and Patient Information Leaflet (PIL) .txt files.
        Matching PI &amp; PIL files are linked automatically by product name; retrieval prefers
        the PI and falls back to the PIL.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Dropzone key="pi" id="pi-files" label="PI documents" files={piFiles} disabled={uploading}
          onAdd={(f) => setPiFiles((prev) => merge(prev, f))}
          onRemove={(i) => setPiFiles((prev) => prev.filter((_, idx) => idx !== i))} />
        <Dropzone key="pil" id="pil-files" label="PIL documents" files={pilFiles} disabled={uploading}
          onAdd={(f) => setPilFiles((prev) => merge(prev, f))}
          onRemove={(i) => setPilFiles((prev) => prev.filter((_, idx) => idx !== i))} />
      </div>

      <div className="space-y-1.5 max-w-xs">
        <Label htmlFor="pdf-division">Division <span className="text-destructive">*</span></Label>
        <Input
          id="pdf-division"
          value={division}
          onChange={(e) => setDivision(e.target.value)}
          placeholder="e.g. BC Div"
          disabled={uploading}
        />
        <p className="text-xs text-muted-foreground">Applied to every document in this upload.</p>
      </div>

      {/* Chunking options (optional) */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">
          Chunking <span className="text-muted-foreground font-normal">(optional)</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <div className="space-y-1.5">
            <Label htmlFor="pdf-chunk-size">Chunk size</Label>
            <Input
              id="pdf-chunk-size"
              type="number"
              min={1}
              placeholder="defaults to server config"
              value={chunkSize}
              onChange={(e) => setChunkSize(e.target.value)}
              disabled={uploading}
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">Characters per chunk (defaults to DEFAULT_CHUNK_SIZE).</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pdf-chunk-overlap">Chunk overlap</Label>
            <Input
              id="pdf-chunk-overlap"
              type="number"
              min={0}
              placeholder="defaults to server config"
              value={chunkOverlap}
              onChange={(e) => setChunkOverlap(e.target.value)}
              disabled={uploading}
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">Chunk overlap (defaults to DEFAULT_CHUNK_OVERLAP).</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={upload} disabled={!canUpload} className="gap-2">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
          {uploading ? 'Uploading…' : 'Upload PI / PIL'}
        </Button>
        {(piFiles.length > 0 || pilFiles.length > 0) && !uploading && (
          <Button variant="ghost" onClick={() => { setPiFiles([]); setPilFiles([]); }}>Clear</Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-green-800">
            <CheckCircle2 className="w-4 h-4" />
            Ingestion complete
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Stat label="Documents" value={String(result.total_documents)} />
            <Stat label="Chunks" value={String(result.total_chunks)} />
            <Stat label="Division" value={result.division} />
            <Stat label="Files skipped" value={String(result.files_skipped)} />
          </div>

          {result.pairs.length > 0 && (
            <div className="pt-1">
              <p className="text-xs font-medium text-green-800 mb-1.5 flex items-center gap-1">
                <Link2 className="w-3.5 h-3.5" /> PI ↔ PIL links
              </p>
              <div className="rounded-md border border-green-200 divide-y bg-white/60">
                {result.pairs.map((p) => (
                  <div key={p.product_key} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
                    <span className="truncate font-medium text-foreground" title={p.product_name}>{p.product_name}</span>
                    <span className="flex gap-2 flex-shrink-0">
                      <Badge ok={!!p.pi_document_id}>PI</Badge>
                      <Badge ok={!!p.pil_document_id}>PIL</Badge>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.skipped_files.length > 0 && (
            <ul className="space-y-0.5 text-xs text-amber-700">
              {result.skipped_files.map((s) => (
                <li key={s.file}>• {s.file} — {s.reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <p className="text-xs text-muted-foreground capitalize">{label}</p>
    <p className="font-semibold text-foreground truncate" title={value}>{value}</p>
  </div>
);

const Badge = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <span
    className={cn(
      'px-1.5 py-0.5 rounded text-[10px] font-semibold',
      ok ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400',
    )}
  >
    {children} {ok ? '✓' : '—'}
  </span>
);

export default PdfUploader;
