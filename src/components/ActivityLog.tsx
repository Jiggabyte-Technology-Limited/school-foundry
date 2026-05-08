import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';

interface LogEntry {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  details: string | null;
  logged_at: string;
}

const ActivityLog: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const [actions, setActions] = useState<string[]>([]);

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, searchQuery, actionFilter, dateFrom, dateTo]);

  const loadLogs = async () => {
    const data = await db.all(`
      SELECT al.*, u.username
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.logged_at DESC
    `);
    setLogs(data);
    
    // Get unique actions for filter
    const uniqueActions = [...new Set(data.map((l: LogEntry) => l.action))];
    setActions(uniqueActions);
  };

  const applyFilters = () => {
    let filtered = [...logs];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.action.toLowerCase().includes(query) ||
          (l.details?.toLowerCase() || '').includes(query) ||
          (l.username?.toLowerCase() || '').includes(query)
      );
    }
    
    if (actionFilter) {
      filtered = filtered.filter((l) => l.action === actionFilter);
    }
    
    if (dateFrom) {
      filtered = filtered.filter((l) => l.logged_at >= dateFrom);
    }
    
    if (dateTo) {
      const toDateEnd = dateTo + 'T23:59:59';
      filtered = filtered.filter((l) => l.logged_at <= toDateEnd);
    }
    
    setFilteredLogs(filtered);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setActionFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const formatLoggedAt = (logged_at: string) => {
    return new Date(logged_at).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getActionColor = (action: string) => {
    if (action.includes('delete') || action.includes('removed')) return '#dc2626';
    if (action.includes('add') || action.includes('create')) return '#16a34a';
    if (action.includes('update') || action.includes('edit')) return '#f59e0b';
    if (action.includes('payment')) return '#3b82f6';
    if (action.includes('login')) return '#8b5cf6';
    return 'var(--color-olive-ink)';
  };

  const handlePrint = () => {
    window.print();
  };

  if (!canViewLogs) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
        <h3 style={{ color: '#ef4444' }}>Access Denied</h3>
        <p>You do not have permission to view activity logs.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between mb-4 no-print">
        <h2 style={{ margin: 0 }}>Activity Logs</h2>
        <button className="btn btn-sage" onClick={handlePrint}>Print</button>
      </div>

      {/* Filters */}
      <div className="card mb-4 no-print">
        <div className="flex-row gap-4" style={{ flexWrap: 'wrap' }}>
          <div className="flex-col" style={{ minWidth: 200, flex: 1 }}>
            <label className="settings-label">Search</label>
            <input
              type="text"
              className="input-default"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex-col" style={{ minWidth: 150 }}>
            <label className="settings-label">Action</label>
            <select
              className="input-default"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">All Actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>{formatAction(a)}</option>
              ))}
            </select>
          </div>
          
          <div className="flex-col" style={{ minWidth: 140 }}>
            <label className="settings-label">From</label>
            <input
              type="date"
              className="input-default"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          
          <div className="flex-col" style={{ minWidth: 140 }}>
            <label className="settings-label">To</label>
            <input
              type="date"
              className="input-default"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          
          <div className="flex-col" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-sage" onClick={clearFilters}>Clear</button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card">
        <div className="flex-between mb-2">
          <span style={{ color: 'var(--color-sage-placeholder)', fontSize: 14 }}>
            Showing {filteredLogs.length} of {logs.length} entries
          </span>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style={{ width: 160 }}>Date &amp; Time</th>
              <th style={{ width: 100 }}>User</th>
              <th style={{ width: 140 }}>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log) => (
              <tr key={log.id}>
                <td style={{ fontSize: '13px', color: 'var(--color-sage-placeholder)' }}>
                  {formatLoggedAt(log.logged_at)}
                </td>
                <td className="td-bold">{log.username || 'System'}</td>
                <td>
                  <span 
                    className="action-badge"
                    style={{ 
                      backgroundColor: `${getActionColor(log.action)}15`,
                      color: getActionColor(log.action),
                    }}
                  >
                    {formatAction(log.action)}
                  </span>
                </td>
                <td style={{ fontSize: '14px', color: 'var(--color-olive-ink)' }}>
                  {log.details || '-'}
                </td>
              </tr>
            ))}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={4} className="table-empty">
                  {logs.length === 0 ? 'No activity logged yet' : 'No logs match your filters'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ActivityLog;
