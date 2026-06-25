import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { UploadCloud, FileText, X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '../../lib/utils';
import { ingestFiles } from '../../features/api/ingestApi';
import { toUploadSummary, type IngestKind, type UploadSummary } from '../../types/ingest.types';

interface FileUploaderProps {
  kind: IngestKind;
  description: string;
}

const ACCEPT = '.txt';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FileUploader = ({ kind, description }: FileUploaderProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chunkSize, setChunkSize] = useState('');
  const [chunkOverlap, setChunkOverlap] = useState('');

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const all = Array.from(incoming);
    const accepted = all.filter((f) => f.name.toLowerCase().endsWith('.txt'));
    const rejected = all.length - accepted.length;
    if (rejected > 0) {
      toast.error(`Skipped ${rejected} non-.txt file${rejected > 1 ? 's' : ''}. Only .txt is supported.`);
    }
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const merged = [...prev];
      for (const f of accepted) {
        const key = `${f.name}:${f.size}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(f);
        }
      }
      return merged;
    });
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const upload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    setSummary(null);
    try {
      const opts =
        kind === 'descriptive' || kind === 'pdf'
          ? {
              chunkSize: chunkSize ? Number(chunkSize) : undefined,
              chunkOverlap: chunkOverlap ? Number(chunkOverlap) : undefined,
            }
          : {};
      const raw = await ingestFiles(kind, files, opts);
      const result = toUploadSummary(kind, raw);
      setSummary(result);
      setFiles([]);
      toast.success(`Ingested ${result.ingested} ${result.ingestedLabel} from ${result.filesProcessed} file(s).`);
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
      <p className="text-sm text-muted-foreground">{description}</p>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/40',
        )}
      >
        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
          <UploadCloud className="w-5 h-5 text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground">
          Drag &amp; drop .txt files here, or <span className="text-primary">browse</span>
        </p>
        <p className="text-xs text-muted-foreground">You can select multiple files at once.</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Selected files */}
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
                onClick={() => removeFile(i)}
                className="text-muted-foreground hover:text-destructive transition-colors"
                aria-label={`Remove ${file.name}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Chunking options (descriptive / pdf only) */}
      {(kind === 'descriptive' || kind === 'pdf') && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Chunking <span className="text-muted-foreground font-normal">(optional)</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            <div className="space-y-1.5">
              <Label htmlFor={`${kind}-chunk-size`}>Chunk size</Label>
              <Input
                id={`${kind}-chunk-size`}
                type="number"
                min={1}
                placeholder="defaults to server config"
                value={chunkSize}
                onChange={(e) => setChunkSize(e.target.value)}
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">Characters per chunk (defaults to DEFAULT_CHUNK_SIZE).</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${kind}-chunk-overlap`}>Chunk overlap</Label>
              <Input
                id={`${kind}-chunk-overlap`}
                type="number"
                min={0}
                placeholder="defaults to server config"
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(e.target.value)}
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">Chunk overlap (defaults to DEFAULT_CHUNK_OVERLAP).</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={upload} disabled={files.length === 0 || uploading} className="gap-2">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
          {uploading ? 'Uploading…' : `Upload ${files.length || ''} file${files.length === 1 ? '' : 's'}`.trim()}
        </Button>
        {files.length > 0 && !uploading && (
          <Button variant="ghost" onClick={() => setFiles([])}>Clear</Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Result summary */}
      {summary && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-green-800">
            <CheckCircle2 className="w-4 h-4" />
            Ingestion complete
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Stat label="Collection" value={summary.collection} />
            <Stat label="Files processed" value={String(summary.filesProcessed)} />
            <Stat label={summary.ingestedLabel} value={String(summary.ingested)} />
            <Stat label="Files skipped" value={String(summary.filesSkipped)} />
          </div>
          {summary.skippedFiles.length > 0 && (
            <div className="pt-1">
              <p className="text-xs font-medium text-amber-700 mb-1">Skipped files</p>
              <ul className="space-y-0.5 text-xs text-amber-700">
                {summary.skippedFiles.map((s) => (
                  <li key={s.file}>• {s.file} — {s.reason}</li>
                ))}
              </ul>
            </div>
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

export default FileUploader;
