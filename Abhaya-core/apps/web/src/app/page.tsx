'use client';

import { useEffect, useState } from 'react';

interface SystemStatus {
  status: number;
  service: string;
  spatial_engine: boolean;
}

export default function SaheliDashboard() {
  const [backendState, setBackendState] = useState<SystemStatus | null>(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/health')
      .then((res) => res.json())
      .then((data: SystemStatus) => setBackendState(data))
      .catch((err) => console.error('Backend connection failed:', err));
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ color: '#e11d48' }}>Saheli Command Center</h1>
      <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
        <h2>System Telemetry</h2>
        {backendState ? (
          <ul>
            <li><strong>Service:</strong> {backendState.service}</li>
            <li><strong>Spatial Engine:</strong> {backendState.spatial_engine ? 'Online' : 'Offline'}</li>
          </ul>
        ) : (
          <p>Connecting to FastAPI Core...</p>
        )}
      </div>
    </div>
  );
}