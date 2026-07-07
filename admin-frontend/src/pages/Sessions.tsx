import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { deleteSessions, fetchSessions } from '../features/thunks/chatThunks';
import {
  selectSessions,
  selectSessionTotal,
  selectSessionsStatus,
  selectSessionsError,
} from '../features/selectors/chatSelectors';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import DateRangeFilter from '../components/DateRangeFilter';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../components/ui/tooltip';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Search, FileText, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { formatDuration } from '../utils/formatters';
import { currentMonthRange, toApiRange } from '../utils/dateRange';

const Sessions = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const sessions = useAppSelector(selectSessions);
  const total = useAppSelector(selectSessionTotal);
  // const status = useAppSelector(selectSessionsStatus);
  const error = useAppSelector(selectSessionsError);

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [range, setRange] = useState(currentMonthRange());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  // const [sortBy, setSortBy] = useState<SessionSortField>('started_at');
  // const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const offset = (currentPage - 1) * pageSize;
  const rangeInvalid = !range.start || !range.end || range.start > range.end;

  useEffect(() => {
    if (rangeInvalid) return;
    dispatch(fetchSessions({
      limit: pageSize,
      offset,
      status: statusFilter || undefined,
      sortBy: 'started_at',
      sortOrder: 'desc',
      ...toApiRange(range),
    }));
  }, [dispatch, pageSize, offset, statusFilter, range.start, range.end, rangeInvalid, refreshKey]);

  const filtered = sessions.filter((s) =>
    s.session_id.toLowerCase().includes(search.toLowerCase())
  );

  // Clear any selection whenever the visible page / filters change.
  useEffect(() => {
    setSelected(new Set());
  }, [offset, pageSize, statusFilter, range.start, range.end, search]);

  const totalPages = Math.ceil(total / pageSize);
  const startIndex = offset + 1;
  const endIndex = Math.min(offset + pageSize, total);

  const allSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.session_id));
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    setSelected((prev) => {
      if (filtered.every((s) => prev.has(s.session_id))) {
        const next = new Set(prev);
        filtered.forEach((s) => next.delete(s.session_id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((s) => next.add(s.session_id));
      return next;
    });
  };

  const toggleOne = (sessionId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      setDeleting(true);
      await dispatch(deleteSessions(pendingDelete)).unwrap();
      const removed = pendingDelete.length;
      setSelected(new Set());
      setPendingDelete(null);
      // If we just emptied a page beyond the first, step back; else refetch in place.
      if (filtered.length === removed && currentPage > 1) setCurrentPage((p) => p - 1);
      else setRefreshKey((k) => k + 1);
    } catch {
      // Error is surfaced via the sessions error banner; keep the dialog target cleared.
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  // const handleStatusChange = (val: string) => {
  //   setStatusFilter(val === 'all' ? '' : val);
  //   setCurrentPage(1);
  // };

  const handlePageSizeChange = (val: string) => {
    setPageSize(Number(val));
    setCurrentPage(1);
  };

  const getStatusStyle = (isActive: boolean) =>
    isActive
      ? 'bg-green-100 text-green-800'
      : 'bg-slate-100 text-slate-600';

  return (
    <AdminLayout>
      <TooltipProvider>
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold">Chat Sessions</h1>
            <DateRangeFilter
              range={range}
              onRangeChange={(r) => { setRange(r); setCurrentPage(1); }}
            />
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by session ID..."
                value={search}
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>

            {/* <Select value={statusFilter || 'all'} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => { setSortBy(v as SessionSortField); setCurrentPage(1); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="started_at">Started At</SelectItem>
                <SelectItem value="duration_seconds">Duration</SelectItem>
                <SelectItem value="created_at">Created At</SelectItem>
                <SelectItem value="id">ID</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortOrder} onValueChange={(v) => { setSortOrder(v as SortOrder); setCurrentPage(1); }}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending</SelectItem>
                <SelectItem value="desc">Descending</SelectItem>
              </SelectContent>
            </Select> */}
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
            {selected.size > 0 && (
              <div className="flex items-center justify-between gap-3 border-b bg-blue-50/70 px-4 py-2.5">
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-medium text-blue-900">
                    {selected.size} {selected.size === 1 ? 'session' : 'sessions'} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
                  >
                    Clear
                  </button>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                  onClick={() => setPendingDelete(Array.from(selected))}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete{selected.size > 1 ? ` (${selected.size})` : ''}
                </Button>
              </div>
            )}
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={toggleAll}
                      aria-label="Select all sessions on this page"
                      disabled={filtered.length === 0}
                    />
                  </TableHead>
                  <TableHead className="w-90">Session ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* {status === 'loading' ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Loading sessions...
                    </TableCell>
                  </TableRow> */}
                {/* ) :  */}
                {filtered.length > 0 ? (
                  filtered.map((session) => (
                    <TableRow
                      key={session.session_id}
                      data-state={selected.has(session.session_id) ? 'selected' : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selected.has(session.session_id)}
                          onCheckedChange={() => toggleOne(session.session_id)}
                          aria-label={`Select session ${session.session_id}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs w-40 max-w-40">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-default block truncate">
                              {session.session_id}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{session.session_id}</TooltipContent>
                        </Tooltip>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 ${getStatusStyle(session.is_active)}`}
                        >
                          {session.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>

                      <TableCell>{session.message_count}</TableCell>

                      <TableCell>
                        {formatDuration(session.duration_seconds)}
                      </TableCell>

                      <TableCell>
                        {session.started_at ? (
                          <div className="flex flex-col text-xs">
                            <span className="font-medium">
                              {new Date(session.started_at).toLocaleDateString('en-GB')}
                            </span>
                            <span className="text-muted-foreground">
                              {new Date(session.started_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(`/transcript/${session.session_id}`)}
                              >
                                <FileText className="w-4 h-4 text-blue-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View Transcript</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setPendingDelete([session.session_id])}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete Session</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No sessions found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination Footer */}
            <div className="flex items-center justify-between px-4 py-4 border-t bg-slate-50/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page:</span>
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((size) => (
                      <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="ml-4">
                  {total > 0 ? `Showing ${startIndex} to ${endIndex} of ${total}` : 'No records'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-medium">Page {currentPage} of {totalPages || 1}</div>
                <Button
                  variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <AlertDialog
          open={pendingDelete !== null}
          onOpenChange={(open) => { if (!open && !deleting) setPendingDelete(null); }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {pendingDelete?.length === 1 ? 'this session' : `${pendingDelete?.length} sessions`}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the {pendingDelete?.length === 1 ? 'session' : 'sessions'} and
                all associated data (transcript, summary, and timing). This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); confirmDelete(); }}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TooltipProvider>
    </AdminLayout>
  );
};

export default Sessions;
