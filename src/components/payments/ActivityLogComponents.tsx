import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db-client';

export const ActivityLogPreview: React.FC = () => {
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    loadRecentLogs();
  }, []);

  const loadRecentLogs = async () => {
    const logs = await db.all(`
      SELECT al.*, u.username
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.logged_at DESC
      LIMIT 10
    `);
    setRecentLogs(logs);
  };

  const formatAction = (action: string) =>
    action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div>
      {recentLogs.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
          No activity yet
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {recentLogs.map(log => (
            <div
              key={log.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                backgroundColor: 'var(--color-sage-cream)',
                borderRadius: '8px',
                borderLeft: '3px solid var(--primary)',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>
                    {formatAction(log.action)}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'var(--border)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    {log.entity}
                  </span>
                </div>
                {log.details && (
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      margin: '4px 0 0',
                    }}
                  >
                    {log.details}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    display: 'block',
                  }}
                >
                  {log.username || 'System'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {formatDate(log.logged_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const FullActivityLog: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const LOGS_PER_PAGE = 50;

  useEffect(() => {
    loadLogs();
  }, [page]);

  const loadLogs = async () => {
    const offset = (page - 1) * LOGS_PER_PAGE;
    const [logData, countData] = await Promise.all([
      db.all(
        `
        SELECT al.*, u.username
        FROM activity_log al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.logged_at DESC
        LIMIT ? OFFSET ?
      `,
        [LOGS_PER_PAGE, offset]
      ),
      db.get('SELECT COUNT(*) as count FROM activity_log'),
    ]);
    setLogs(logData);
    setTotalCount(countData?.count || 0);
  };

  const totalPages = Math.ceil(totalCount / LOGS_PER_PAGE);

  const formatAction = (action: string) =>
    action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const PaginationControls = () => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: '1px solid var(--border)',
      }}
    >
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        Showing {(page - 1) * LOGS_PER_PAGE + 1} - {Math.min(page * LOGS_PER_PAGE, totalCount)} of{' '}
        {totalCount}
      </span>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          className="btn btn-outline"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{ padding: '6px 12px', fontSize: '12px' }}
        >
          Previous
        </button>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}
        >
          Page {page} of {totalPages}
        </span>
        <button
          className="btn btn-outline"
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          style={{ padding: '6px 12px', fontSize: '12px' }}
        >
          Next
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <PaginationControls />
      <table style={{ marginTop: '12px', width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th
              style={{
                textAlign: 'left',
                padding: '10px',
                borderBottom: '2px solid var(--border)',
                fontSize: '12px',
              }}
            >
              Date & Time
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '10px',
                borderBottom: '2px solid var(--border)',
                fontSize: '12px',
              }}
            >
              User
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '10px',
                borderBottom: '2px solid var(--border)',
                fontSize: '12px',
              }}
            >
              Action
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '10px',
                borderBottom: '2px solid var(--border)',
                fontSize: '12px',
              }}
            >
              Entity
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '10px',
                borderBottom: '2px solid var(--border)',
                fontSize: '12px',
              }}
            >
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '10px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                {formatDate(log.logged_at)}
              </td>
              <td style={{ padding: '10px', fontSize: '12px' }}>{log.username || 'System'}</td>
              <td style={{ padding: '10px', fontSize: '12px', fontWeight: 600 }}>
                {formatAction(log.action)}
              </td>
              <td style={{ padding: '10px', fontSize: '12px' }}>
                <span
                  style={{
                    backgroundColor: 'var(--secondary)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '11px',
                  }}
                >
                  {log.entity}
                </span>
              </td>
              <td
                style={{
                  padding: '10px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  maxWidth: '300px',
                }}
              >
                {log.details || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <PaginationControls />
    </div>
  );
};
