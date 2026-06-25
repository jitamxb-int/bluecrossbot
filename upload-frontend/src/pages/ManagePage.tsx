import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import UploadLayout from '../components/layout/UploadLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import TagInput from '../components/upload/TagInput';
import { deleteAllVectors, deleteByDocument } from '../features/api/ingestApi';
import type { DocumentField } from '../types/ingest.types';

const ManagePage = () => {
  const [field, setField] = useState<DocumentField>('document_name');
  const [values, setValues] = useState<string[]>([]);
  const [confirmDocOpen, setConfirmDocOpen] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState(false);

  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deletingAll, setDeletingAll] = useState(false);

  const fieldLabel = field === 'document_id' ? 'document IDs' : 'document names';

  const runDeleteByDocument = async () => {
    setDeletingDoc(true);
    try {
      const res = await deleteByDocument(field, values);
      toast.success(`Deleted ${res.deleted} point${res.deleted === 1 ? '' : 's'} across ${res.requested} ${fieldLabel}.`);
      setValues([]);
      setConfirmDocOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
      setConfirmDocOpen(false);
    } finally {
      setDeletingDoc(false);
    }
  };

  const runDeleteAll = async () => {
    setDeletingAll(true);
    try {
      const res = await deleteAllVectors();
      toast.success(`Cleared the vector database — ${res.deleted} point${res.deleted === 1 ? '' : 's'} removed.`);
      setConfirmAllOpen(false);
      setConfirmText('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
      setConfirmAllOpen(false);
    } finally {
      setDeletingAll(false);
    }
  };

  return (
    <UploadLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Manage Vector Store</h1>
          <p className="text-muted-foreground">
            Delete points for specific documents, or clear the entire vector database.
          </p>
        </div>

        {/* Delete by document */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Delete by document</CardTitle>
            <CardDescription>
              Remove all vector points belonging to specific documents. Choose one identifier type,
              then add one or more values.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[200px_1fr] sm:items-start">
              <div className="space-y-1.5">
                <Label htmlFor="field-select">Identifier type</Label>
                <Select value={field} onValueChange={(v) => { setField(v as DocumentField); }}>
                  <SelectTrigger id="field-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="document_name">Document name</SelectItem>
                    <SelectItem value="document_id">Document ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="values-input">
                  {field === 'document_id' ? 'Document IDs' : 'Document names'}
                </Label>
                <TagInput
                  id="values-input"
                  values={values}
                  onChange={setValues}
                  placeholder={field === 'document_id' ? 'e.g. a1b2c3… (Enter to add)' : 'e.g. products.txt (Enter to add)'}
                />
                <p className="text-xs text-muted-foreground">
                  Press Enter or comma to add each value.
                </p>
              </div>
            </div>

            <Button
              variant="destructive"
              className="gap-2"
              disabled={values.length === 0}
              onClick={() => setConfirmDocOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
              Delete {values.length > 0 ? `(${values.length})` : ''}
            </Button>
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-lg text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Danger zone
            </CardTitle>
            <CardDescription>
              Permanently delete <strong>every</strong> point in the vector database. This cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" className="gap-2" onClick={() => setConfirmAllOpen(true)}>
              <Trash2 className="w-4 h-4" />
              Clear entire vector database
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Confirm: delete by document */}
      <AlertDialog open={confirmDocOpen} onOpenChange={(o) => { if (!deletingDoc) setConfirmDocOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete points for {values.length} {fieldLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              All vector points matching the selected {fieldLabel} will be permanently removed. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDoc}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); runDeleteByDocument(); }}
              disabled={deletingDoc}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {deletingDoc && <Loader2 className="w-4 h-4 animate-spin" />}
              {deletingDoc ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: delete all (type-to-confirm) */}
      <AlertDialog
        open={confirmAllOpen}
        onOpenChange={(o) => { if (!deletingAll) { setConfirmAllOpen(o); setConfirmText(''); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the entire vector database?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes every point in the collection. To confirm, type{' '}
              <span className="font-mono font-semibold text-foreground">DELETE</span> below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); runDeleteAll(); }}
              disabled={deletingAll || confirmText !== 'DELETE'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {deletingAll && <Loader2 className="w-4 h-4 animate-spin" />}
              {deletingAll ? 'Clearing…' : 'Clear everything'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UploadLayout>
  );
};

export default ManagePage;
