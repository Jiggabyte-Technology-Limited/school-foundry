import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';

const ActivityLog = () => {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const data = await db.all('SELECT * FROM activity_log ORDER BY timestamp DESC');
    setLogs(data);
  };

  return (
    <div>
      <h1 className="mb-4">Activity Log</h1>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Action</th>
              <th>Details</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log: any) => (
              <tr key={log.id}>
                <td>{log.username}</td>
                <td>{log.action}</td>
                <td>{log.details}</td>
                <td className="td-id">{log.timestamp}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="table-empty">No activity logged yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ActivityLog;
