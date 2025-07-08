/* eslint-disable */
// Enhanced TicketTable component – sortable, searchable, accessible
import React, { useState, useMemo, useCallback } from "react";
import { useTicketActions } from "@/hooks/useTicketActions";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  AlertCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  ChevronRight,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

export interface Ticket {
  id: string;
  status:
    | "open"
    | "auto_answered"
    | "awaiting_feedback"
    | "escalation_pending"
    | "escalated"
    | "closed";
  platform: string;
  threadId: string;
  severity: "low" | "medium" | "high" | "critical";
  lastActivity: string;
  receivedAt: string;
}

interface TicketTableProps {
  tickets?: Ticket[];
  onRowClick?: (id: string) => void;
  loading?: boolean;
  error?: string;
  onCloseTicket?: (id: string) => void;
}

type SortField = keyof Ticket;
type SortDirection = "asc" | "desc";

const TicketTable: React.FC<TicketTableProps> = ({
  tickets = [],
  onRowClick = () => {},
  loading = false,
  error = "",
  onCloseTicket,
}) => {
  const [sortField, setSortField] = useState<SortField>("lastActivity");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const actions = useTicketActions(expandedId ?? undefined);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    },
    [sortField, sortDirection],
  );

  const filteredTickets = useMemo(() => {
    if (!tickets.length) return [];
    if (!searchQuery.trim()) return tickets;

    return tickets.filter((ticket) => {
      const needle = searchQuery.toLowerCase();
      return (
        ticket.threadId.toLowerCase().includes(needle) ||
        ticket.platform.toLowerCase().includes(needle) ||
        ticket.status.toLowerCase().includes(needle) ||
        ticket.severity.toLowerCase().includes(needle)
      );
    });
  }, [tickets, searchQuery]);

  const sortedTickets = useMemo(() => {
    if (!filteredTickets.length) return [];
    return [...filteredTickets].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      if (sortField === "lastActivity" || sortField === "receivedAt") {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredTickets, sortField, sortDirection]);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field)
      return <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />;
    return sortDirection === "asc" ? (
      <ChevronUp className="w-4 h-4 text-foreground" />
    ) : (
      <ChevronDown className="w-4 h-4 text-foreground" />
    );
  };

  const statusConfig = {
    open: { variant: "destructive" as const, icon: AlertCircle, label: "Open" },
    auto_answered: {
      variant: "secondary" as const,
      icon: CheckCircle,
      label: "Answered",
    },
    awaiting_feedback: {
      variant: "default" as const,
      icon: Clock,
      label: "Awaiting Feedback",
    },
    escalation_pending: {
      variant: "destructive" as const,
      icon: AlertTriangle,
      label: "Escalation Pending",
    },
    escalated: {
      variant: "outline" as const,
      icon: Clock,
      label: "Escalated",
    },
    closed: {
      variant: "outline" as const,
      icon: CheckCircle,
      label: "Closed",
    },
  } as const;

  const severityConfig = {
    low: { className: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
    medium: { className: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock },
    high: { className: "bg-orange-100 text-orange-800 border-orange-200", icon: AlertTriangle },
    critical: { className: "bg-red-100 text-red-800 border-red-200", icon: AlertCircle },
  } as const;

  const formatLastActivity = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffH = Math.floor((now.getTime() - date.getTime()) / 3600000);
    if (diffH < 1) return "Just now";
    if (diffH < 24) return `${diffH}h ago`;
    if (diffH < 168) return `${Math.floor(diffH / 24)}d ago`;
    return date.toLocaleDateString();
  };

  const formatReceivedAt = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleRowSelect = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    onRowClick(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent, i: number) => {
    switch (e.key) {
      case "Enter":
      case " ": {
        e.preventDefault();
        handleRowSelect(sortedTickets[i].id);
        break;
      }
      case "ArrowDown":
        e.preventDefault();
        setFocusedRowIndex(Math.min(i + 1, sortedTickets.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedRowIndex(Math.max(i - 1, 0));
        break;
    }
  };

  /* --------------------------------------------------
   * Render – loading / error states
   * -------------------------------------------------- */

  if (loading) {
    return (
      <div className="w-full rounded-lg border border-border bg-background shadow-sm p-4 space-y-4">
        <div className="h-10 bg-muted/50 rounded-md animate-pulse" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted/30 rounded-md animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive shadow-sm">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <p className="font-medium">Error loading tickets</p>
        </div>
        <p className="mt-2 text-sm">{error}</p>
      </div>
    );
  }

  /* --------------------------------------------------
   * Main table
   * -------------------------------------------------- */

  return (
    <div className="w-full space-y-4">
      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
        <Button variant="outline" size="icon" className="h-10 w-10" disabled>
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-background shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[50px]" />
              {([
                { label: "Status", field: "status" },
                { label: "Platform", field: "platform" },
                { label: "Thread ID", field: "threadId" },
                { label: "Severity", field: "severity" },
                { label: "Received", field: "receivedAt" },
                { label: "Last Activity", field: "lastActivity" },
              ] as Array<{ label: string; field: SortField }>).map(({ label, field }) => (
                <TableHead key={field}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSort(field)}
                    className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    {label}
                    {getSortIcon(field)}
                  </Button>
                </TableHead>
              ))}
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {sortedTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mb-2" />
                    <p className="text-sm">No tickets found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedTickets.map((ticket, idx) => {
                const StatusIcon = statusConfig[ticket.status].icon;
                const SevIcon = severityConfig[ticket.severity].icon;
                const isExpanded = expandedId === ticket.id;

                return (
                  <React.Fragment key={ticket.id}>
                    <TableRow
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => handleKeyDown(e, idx)}
                      onClick={() => handleRowSelect(ticket.id)}
                      className={`cursor-pointer transition-colors ${
                        focusedRowIndex === idx ? "bg-muted/50" : ""
                      } ${isExpanded ? "bg-muted/30" : ""}`}
                      data-state={isExpanded ? "expanded" : undefined}
                    >
                      <TableCell className="w-[50px] pr-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 p-0 text-muted-foreground"
                          aria-label={isExpanded ? "Collapse details" : "Expand details"}
                        >
                          <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={statusConfig[ticket.status].variant}
                          className="flex items-center gap-1 whitespace-nowrap"
                        >
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig[ticket.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{ticket.platform}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {ticket.threadId}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`${severityConfig[ticket.severity].className} flex items-center gap-1`}
                        >
                          <SevIcon className="w-3 h-3" />
                          {ticket.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatReceivedAt(ticket.receivedAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatLastActivity(ticket.lastActivity)}
                      </TableCell>
                      <TableCell>
                        {ticket.status !== "closed" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCloseTicket?.(ticket.id);
                            }}
                          >
                            <X className="h-3 w-3 mr-1" /> Close
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs">Closed</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={8} className="bg-muted/10 p-0">
                          <div className="p-4 text-sm border-t border-border">
                            <h4 className="font-medium mb-2 text-foreground">Ticket History</h4>
                            {actions.length === 0 ? (
                              <div className="py-3 text-muted-foreground flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span>No activity recorded for this ticket</span>
                              </div>
                            ) : (
                              <ul className="space-y-3">
                                {actions.map((a) => (
                                  <li
                                    key={a.id}
                                    className="flex gap-3 items-start pb-3 border-b border-border/50 last:border-0"
                                  >
                                    <div className="bg-muted/50 text-muted-foreground rounded-md px-2 py-1 text-xs font-mono whitespace-nowrap">
                                      {new Date(a.createdAt).toLocaleString()}
                                    </div>
                                    <div>
                                      <span className="font-medium text-foreground">{a.actionType}</span>
                                      {a.content ? (
                                        <p className="mt-1 text-muted-foreground">{a.content}</p>
                                      ) : null}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      {sortedTickets.length > 0 && (
        <div className="text-sm text-muted-foreground text-center">
          Showing {sortedTickets.length} of {tickets.length} tickets
          {searchQuery && ` (filtered by "${searchQuery}")`}
        </div>
      )}
    </div>
  );
};

export default TicketTable; 