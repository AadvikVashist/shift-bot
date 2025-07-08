/* eslint-disable */
// TicketTable component generated via 21st.dev – renders sortable ticket list.
import React, { useState, useMemo, useCallback } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  AlertCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export interface Ticket {
  id: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  platform: string;
  threadId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  lastActivity: string;
}

interface TicketTableProps {
  tickets?: Ticket[];
  onRowClick?: (id: string) => void;
  loading?: boolean;
  error?: string;
}

type SortField = keyof Ticket;
type SortDirection = 'asc' | 'desc';

const TicketTable: React.FC<TicketTableProps> = ({
  tickets = [],
  onRowClick = () => {},
  loading = false,
  error = '',
}) => {
  const [sortField, setSortField] = useState<SortField>('lastActivity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
    },
    [sortField, sortDirection],
  );

  const sortedTickets = useMemo(() => {
    if (!tickets.length) return [];
    return [...tickets].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      if (sortField === 'lastActivity') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tickets, sortField, sortDirection]);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4 text-foreground" />
    ) : (
      <ChevronDown className="w-4 h-4 text-foreground" />
    );
  };

  const statusConfig = {
    open: { variant: 'destructive' as const, icon: AlertCircle, label: 'Open' },
    'in-progress': { variant: 'default' as const, icon: Clock, label: 'In Progress' },
    resolved: { variant: 'secondary' as const, icon: CheckCircle, label: 'Resolved' },
    closed: { variant: 'outline' as const, icon: CheckCircle, label: 'Closed' },
  };
  const severityConfig = {
    low: { className: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
    medium: { className: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
    high: { className: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertTriangle },
    critical: { className: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle },
  };

  const formatLastActivity = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffH = Math.floor((now.getTime() - date.getTime()) / 3600000);
    if (diffH < 1) return 'Just now';
    if (diffH < 24) return `${diffH}h ago`;
    if (diffH < 168) return `${Math.floor(diffH / 24)}d ago`;
    return date.toLocaleDateString();
  };

  const handleKeyDown = (e: React.KeyboardEvent, i: number) => {
    switch (e.key) {
      case 'Enter':
      case ' ': {
        e.preventDefault();
        onRowClick(sortedTickets[i].id);
        break;
      }
      case 'ArrowDown':
        e.preventDefault();
        setFocusedRowIndex(Math.min(i + 1, sortedTickets.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedRowIndex(Math.max(i - 1, 0));
        break;
    }
  };

  // Loading & error skeletons omitted for brevity

  return (
    <div className="w-full overflow-hidden rounded-lg border border-border bg-background shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              {(
                [
                  { label: 'Status', field: 'status' },
                  { label: 'Platform', field: 'platform' },
                  { label: 'Thread ID', field: 'threadId' },
                  { label: 'Severity', field: 'severity' },
                  { label: 'Last Activity', field: 'lastActivity' },
                ] as Array<{ label: string; field: SortField }>
              ).map(({ label, field }) => (
                <th key={field} className="px-4 py-3 text-left">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSort(field)}
                    className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground"
                  >
                    {label}
                    {getSortIcon(field)}
                  </Button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedTickets.map((t, idx) => {
              const StatusIcon = statusConfig[t.status].icon;
              const SevIcon = severityConfig[t.severity].icon;
              return (
                <tr
                  key={t.id}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  onClick={() => onRowClick(t.id)}
                  className={`border-t border-border cursor-pointer hover:bg-muted/50 focus:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                    focusedRowIndex === idx ? 'bg-muted/50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <Badge variant={statusConfig[t.status].variant} className="flex items-center gap-1">
                      <StatusIcon className="w-3 h-3" />
                      {statusConfig[t.status].label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{t.platform}</td>
                  <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{t.threadId}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`${severityConfig[t.severity].className} flex items-center gap-1`}>
                      <SevIcon className="w-3 h-3" />
                      {t.severity}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatLastActivity(t.lastActivity)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TicketTable; 