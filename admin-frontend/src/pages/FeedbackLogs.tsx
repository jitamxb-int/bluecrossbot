import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Search, Eye, MessageSquareQuote, Trash2, Loader2 } from 'lucide-react';
import { Input } from '../components/ui/input';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchAllFeedbacks, deleteFeedback } from '../features/thunks/feedbackThunks';
import {
  selectFeedbacks,
  selectFetchStatus,
  selectFetchError,
  selectDeletingId,
} from '../features/selectors/feedbackSelectors';

const FeedbackLogs = () => {
  const navigate   = useNavigate();
  const dispatch   = useAppDispatch();

  const feedbacks   = useAppSelector(selectFeedbacks);
  const fetchStatus = useAppSelector(selectFetchStatus);
  const fetchError  = useAppSelector(selectFetchError);
  const deletingId  = useAppSelector(selectDeletingId);

  const [search, setSearch] = useState('');

  useEffect(() => {
    dispatch(fetchAllFeedbacks());
  }, [dispatch]);

  const filtered = feedbacks.filter((f) =>
    f.session_id.toLowerCase().includes(search.toLowerCase()) ||
    f.original_text.toLowerCase().includes(search.toLowerCase()) ||
    f.feedback_text.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this feedback entry?')) return;
    dispatch(deleteFeedback(id));
  };

  const isLoading = fetchStatus === 'loading';

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">AI Transcript Feedback</h1>
            <p className="text-sm text-muted-foreground">
              Review and manage suggested AI response improvements.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by session or text..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {!isLoading && (
            <span className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
            </span>
          )}
        </div>

        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead className="w-[300px]">Original AI Text</TableHead>
                <TableHead className="w-[300px]">Feedback</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : fetchError ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16 text-red-500 text-sm">
                    {fetchError}
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16 text-muted-foreground text-sm">
                    No feedback entries found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                            {item.session_id[0]?.toUpperCase() ?? '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="font-mono text-xs truncate max-w-[120px]" title={item.session_id}>
                          {item.session_id}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start gap-2 text-xs text-muted-foreground italic leading-relaxed">
                        <MessageSquareQuote size={14} className="shrink-0 text-slate-400 mt-0.5" />
                        <span className="line-clamp-3">"{item.original_text}"</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="bg-blue-50/50 border border-blue-100 p-2 rounded-lg text-xs text-blue-900 leading-relaxed line-clamp-3">
                        {item.feedback_text}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString('en-GB')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigate(`/transcript/${item.session_id}`, { state: { feedbackId: item.id } });
                          }}
                          title="View transcript"
                        >
                          <Eye size={16} className="text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          title="Delete feedback"
                        >
                          {deletingId === item.id ? (
                            <Loader2 size={16} className="animate-spin text-red-400" />
                          ) : (
                            <Trash2 size={16} className="text-red-400" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
};

export default FeedbackLogs;
