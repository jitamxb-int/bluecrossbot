import { useEffect, useState } from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import DateRangeFilter from '../components/DateRangeFilter';
import { MessageSquare, MessagesSquare, Clock, TrendingUp } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchChatMetrics } from '../features/thunks/chatThunks';
import { selectChatMetrics, selectChatStatus, selectChatError } from '../features/selectors/chatSelectors';
import { formatMinutes } from '../utils/formatters';
import { currentMonthRange, toApiRange } from '../utils/dateRange';

const Dashboard = () => {
  const dispatch = useAppDispatch();
  const metrics = useAppSelector(selectChatMetrics);
  const status = useAppSelector(selectChatStatus);
  const error = useAppSelector(selectChatError);

  const [range, setRange] = useState(currentMonthRange());
  const rangeInvalid = !range.start || !range.end || range.start > range.end;

  useEffect(() => {
    if (!rangeInvalid) {
      dispatch(fetchChatMetrics(toApiRange(range)));
    }
  }, [dispatch, range.start, range.end, rangeInvalid]);

  const stats = [
    {
      title: 'Total Chats',
      value: metrics?.total_chats ?? 0,
      icon: MessageSquare,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      description: 'Unique chat sessions',
    },
    {
      title: 'Total Messages',
      value: metrics?.total_chat_messages ?? 0,
      icon: MessagesSquare,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      description: 'Messages exchanged',
    },
    {
      title: 'Total Duration',
      value: metrics ? formatMinutes(metrics.total_chat_minutes) : '—',
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      description: 'Cumulative chat time',
    },
    {
      title: 'Avg. Messages / Chat',
      value: metrics && metrics.total_chats > 0
        ? (metrics.total_chat_messages / metrics.total_chats).toFixed(1)
        : '—',
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      description: 'Messages per session',
    },
  ];

  const isLoading = status === 'loading';

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header with compact date-range filter in the top-right */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard Overview</h1>
            <p className="text-muted-foreground">BlueCross chat activity and engagement metrics for the selected period.</p>
          </div>

          <DateRangeFilter range={range} onRangeChange={setRange} />
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading dashboard…</p>
            </div>
          </div>
        )}

        {!isLoading && (
        <>
        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                      <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Session Breakdown */}
        {metrics && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Chat Activity Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm">Total Chat Sessions</span>
                  <span className="text-sm font-semibold">{metrics.total_chats}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm">Total Messages</span>
                  <span className="text-sm font-semibold">{metrics.total_chat_messages}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm">Total Duration</span>
                  <span className="text-sm font-semibold">{formatMinutes(metrics.total_chat_minutes)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5">
                  <span className="text-sm">Avg. Duration / Chat</span>
                  <span className="text-sm font-semibold">
                    {metrics.total_chats > 0
                      ? formatMinutes(metrics.total_chat_minutes / metrics.total_chats)
                      : '—'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Engagement Rate</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="p-5 rounded-lg bg-blue-50 border border-blue-100 text-center">
                  <MessageSquare className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-blue-900">{metrics.total_chats}</p>
                  <p className="text-sm text-blue-700 mt-1">Total Sessions Started</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-purple-50 border border-purple-100 text-center">
                    <p className="text-2xl font-bold text-purple-900">{metrics.total_chat_messages}</p>
                    <p className="text-xs text-purple-700 mt-1">Messages</p>
                  </div>
                  <div className="p-4 rounded-lg bg-orange-50 border border-orange-100 text-center">
                    <p className="text-2xl font-bold text-orange-900">{formatMinutes(metrics.total_chat_minutes)}</p>
                    <p className="text-xs text-orange-700 mt-1">Total Time</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        </>
        )}
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
