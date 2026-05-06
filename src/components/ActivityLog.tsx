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
    <div style={{ padding: '2rem' }}>
      <h1>Activity Log</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
            <th>User</th>
            <th>Action</th>
            <th>Details</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log: any) => (
            <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
              <td>{log.username}</td>
              <td>{log.action}</td>
              <td>{log.details}</td>
              <td>{log.timestamp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ActivityLog;
