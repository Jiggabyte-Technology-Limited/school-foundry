import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import { useAuth } from '../lib/auth-context';
import ChipSelector from './ui/ChipSelector';

interface LogEntry {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  details: string | null;
  logged_at: string;
}

const ActivityLog: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const canViewLogs = user?.role === 'admin';

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [actions, setActions] = useState<string[]>([]);
  const [users, setUsers] = useState<string[]>([]);

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, searchQuery, actionFilter, userFilter, dateFrom, dateTo]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await db.all(`
        SELECT al.*, u.username
        FROM activity_log al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.logged_at DESC
      `);
      setLogs(data);
      setError(null);

      // Get unique actions for filter
      const uniqueActions = [...new Set(data.map((l: LogEntry) => l.action))];
      setActions(uniqueActions);

      // Get unique users for filter
      const uniqueUsers = [...new Set(data.map((l: LogEntry) => l.username).filter(Boolean))];
      setUsers(uniqueUsers as string[]);
    } catch (err) {
      console.error('Failed to load logs:', err);
      setError('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...logs];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        l =>
          l.action.toLowerCase().includes(query) ||
          (l.details?.toLowerCase() || '').includes(query) ||
          (l.username?.toLowerCase() || '').includes(query)
      );
    }

    if (actionFilter) {
      filtered = filtered.filter(l => l.action === actionFilter);
    }

    if (userFilter) {
      filtered = filtered.filter(l => l.username === userFilter);
    }

    if (dateFrom) {
      filtered = filtered.filter(l => l.logged_at >= dateFrom);
    }

    if (dateTo) {
      const toDateEnd = dateTo + 'T23:59:59';
      filtered = filtered.filter(l => l.logged_at <= toDateEnd);
    }

    setFilteredLogs(filtered);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setActionFilter('');
    setUserFilter('');
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
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getActionColor = (action: string) => {
    if (action.includes('delete') || action.includes('removed')) return '#dc2626';
    if (action.includes('add') || action.includes('create')) return '#16a34a';
    if (action.includes('update') || action.includes('edit')) return '#f59e0b';
    if (action.includes('payment')) return '#3b82f6';
    if (action.includes('login')) return '#8b5cf6';
    return 'var(--color-olive-ink)';
  };

  if (loading)
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 40px',
          gap: '16px',
        }}
        className="text-display"
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
          style={{ animation: 'spin 1s linear infinite' }}
        >
          <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
        </svg>
        <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading logs...</span>
      </div>
    );

  if (!canViewLogs) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
        <h3 style={{ color: '#ef4444' }}>Access Denied</h3>
        <p>You do not have permission to view activity logs.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
        <h3 style={{ color: '#ef4444' }}>Error</h3>
        <p>{error}</p>
        <button className="btn btn-sage" onClick={loadLogs}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between mb-4">
        <h2 style={{ margin: 0 }}>Activity Logs</h2>
        <span style={{ color: 'var(--color-sage-placeholder)', fontSize: 14 }}>
          {filteredLogs.length} of {logs.length} entries
        </span>
      </div>

      {/* Filters */}
      <div
        className="card mb-4"
        style={{
          background: 'linear-gradient(135deg, #f8faf9 0%, #f0f4f2 100%)',
          border: '1px solid #e2e8e5',
        }}
      >
        <div className="flex-row gap-3" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="flex-col" style={{ minWidth: 200, flex: 1 }}>
            <label className="settings-label" style={{ fontWeight: 600, color: '#3d4a45' }}>
              Search
            </label>
            <input
              type="text"
              className="input-default"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ borderRadius: 8, border: '1px solid #cbd5d1' }}
            />
          </div>

          <ChipSelector
            label="Action"
            value={actionFilter || null}
            onChange={value => setActionFilter((value as string) || '')}
            options={actions.map(a => ({ value: a, label: formatAction(a) }))}
            allowAll
            allLabel="All Actions"
          />

          <div className="flex-col" style={{ minWidth: 140 }}>
            <label className="settings-label" style={{ fontWeight: 600, color: '#3d4a45' }}>
              User
            </label>
            <select
              className="input-default"
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              style={{ borderRadius: 8, border: '1px solid #cbd5d1' }}
            >
              <option value="">All Users</option>
              {users.map(u => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-col" style={{ minWidth: 140 }}>
            <label className="settings-label" style={{ fontWeight: 600, color: '#3d4a45' }}>
              From
            </label>
            <input
              type="date"
              className="input-default"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{ borderRadius: 8, border: '1px solid #cbd5d1' }}
            />
          </div>

          <div className="flex-col" style={{ minWidth: 140 }}>
            <label className="settings-label" style={{ fontWeight: 600, color: '#3d4a45' }}>
              To
            </label>
            <input
              type="date"
              className="input-default"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{ borderRadius: 8, border: '1px solid #cbd5d1' }}
            />
          </div>

          <div className="flex-col" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-sage" onClick={clearFilters} style={{ borderRadius: 8 }}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ margin: 0 }}>
          <thead
            style={{
              background: 'linear-gradient(135deg, #5a7d6c 0%, #4a6d5c 100%)',
              color: '#fff',
            }}
          >
            <tr>
              <th style={{ width: 180, padding: '14px 16px' }}>Date &amp; Time</th>
              <th style={{ width: 120, padding: '14px 16px' }}>User</th>
              <th style={{ width: 160, padding: '14px 16px' }}>Action</th>
              <th style={{ padding: '14px 16px' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log, index) => (
              <tr
                key={log.id}
                style={{
                  background: index % 2 === 0 ? '#fff' : '#f8faf9',
                  transition: 'background 0.2s',
                }}
              >
                <td
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-sage-placeholder)',
                    padding: '12px 16px',
                  }}
                >
                  {formatLoggedAt(log.logged_at)}
                </td>
                <td style={{ fontWeight: 600, color: '#3d4a45', padding: '12px 16px' }}>
                  {log.username || 'System'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span
                    style={{
                      backgroundColor: `${getActionColor(log.action)}15`,
                      color: getActionColor(log.action),
                      padding: '4px 10px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'inline-block',
                    }}
                  >
                    {formatAction(log.action)}
                  </span>
                </td>
                <td
                  style={{
                    fontSize: '14px',
                    color: 'var(--color-olive-ink)',
                    padding: '12px 16px',
                  }}
                >
                  {log.details || '-'}
                </td>
              </tr>
            ))}
            {filteredLogs.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    textAlign: 'center',
                    padding: '48px',
                    color: 'var(--color-sage-placeholder)',
                  }}
                >
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
