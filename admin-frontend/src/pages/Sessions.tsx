import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchSessions } from '../features/thunks/chatThunks';
import {
  selectSessions,
  selectSessionTotal,
  selectSessionsStatus,
  selectSessionsError,
} from '../features/selectors/chatSelectors';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import DateRangeFilter from '../components/DateRangeFilter';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../components/ui/tooltip';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { Search, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMinutes } from '../utils/formatters';
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
      sortOrder: 'asc',
      ...toApiRange(range),
    }));
  }, [dispatch, pageSize, offset, statusFilter, range.start, range.end, rangeInvalid]);

  const filtered = sessions.filter((s) =>
    s.session_id.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(total / pageSize);
  const startIndex = offset + 1;
  const endIndex = Math.min(offset + pageSize, total);

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
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
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
                    <TableRow key={session.session_id}>
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
                        {session.duration_seconds > 0
                          ? formatMinutes(session.duration_seconds / 60)
                          : session.duration_seconds + " secs"}
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
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
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
      </TooltipProvider>
    </AdminLayout>
  );
};

export default Sessions;
