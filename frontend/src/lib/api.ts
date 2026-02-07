/**
 * API client for communicating with the FastAPI backend
 */

const API_BASE = '/api';
const WS_BASE = `ws://${window.location.hostname}:8000`;

export interface LiveDataResponse {
  unit_id: string;
  timestamp: string;
  [key: string]: any;
}

export interface ModbusConfig {
  server?: {
    host: string;
    port: number;
    slave_id: number;
  };
  registers: Array<{
    name: string;
    address: number;
    description?: string;
    data_type?: string;
    scale?: number;
    unit?: string;
    category?: string;
  }>;
}

export async function fetchLiveData(unitId: string = 'GCS-001'): Promise<LiveDataResponse> {
  const response = await fetch(`${API_BASE}/units/${unitId}/live`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function fetchPVDiagram(unitId: string, stage: number = 1) {
  const response = await fetch(`${API_BASE}/units/${unitId}/diagrams/pv?stage=${stage}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function fetchPTDiagram(unitId: string) {
  const response = await fetch(`${API_BASE}/units/${unitId}/diagrams/pt`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

// Configuration APIs
export async function fetchModbusConfig(): Promise<ModbusConfig> {
  const response = await fetch(`${API_BASE}/config/modbus`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function updateModbusConfig(config: Partial<ModbusConfig>, token?: string): Promise<{status: string; message?: string}> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}/config/modbus`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(config)
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export function createWebSocket(unitId: string, onMessage: (data: any) => void, onError?: (error: any) => void) {
  const ws = new WebSocket(`${WS_BASE}/api/units/ws/${unitId}`);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e);
    }
  };
  
  ws.onerror = (event) => {
    console.error('WebSocket error:', event);
    if (onError) onError(event);
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
  };
  
  return ws;
}
