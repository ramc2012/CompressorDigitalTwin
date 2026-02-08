/**
 * API client for communicating with the FastAPI backend
 * Enhanced for Phase 5: Config persistence, multi-unit, alarms, trending
 */

const API_BASE = '/api';
const WS_BASE = `ws://${window.location.hostname}:8000`;

// ============ TYPES ============

export interface LiveDataResponse {
    unit_id: string;
    timestamp: string;
    sources?: Record<string, 'LIVE' | 'MANUAL'>;
    [key: string]: any;
}

export interface UnitSummary {
    unit_id: string;
    name: string;
    stage_count: number;
    is_active: boolean;
    has_modbus: boolean;
}

export interface EquipmentConfig {
    compressor: {
        manufacturer: string;
        model: string;
        serialNumber: string;
        numStages: number;
        compressorType: string;
        frameRatingHP: number;
        maxRodLoad: number;
        stages: StageConfig[];
    };
    engine: {
        manufacturer: string;
        model: string;
        fuelType: string;
        ratedBHP: number;
        ratedRPM: number;
    };
}

export interface StageConfig {
    cylinders: number;
    action: string;
    boreDiameter: number;
    strokeLength: number;
    rodDiameter: number;
    clearanceHE: number;
    clearanceCE: number;
    designSuctionPressure: number;
    designDischargePressure: number;
    designSuctionTemp: number;
    suctionPressSource?: string;
    dischargePressSource?: string;
    suctionTempSource?: string;
    dischargeTempSource?: string;
}

export interface AlarmActive {
    id: string;
    parameter: string;
    level: 'LL' | 'L' | 'H' | 'HH';
    value: number;
    setpoint: number;
    timestamp: string;
    acknowledged: boolean;
}

export interface TrendQuery {
    parameters: string[];
    start: string;
    end: string;
    aggregation?: '1s' | '1m' | '5m' | '1h';
}

// ============ AUTH ============

let authToken: string | null = localStorage.getItem('auth_token');

export function setAuthToken(token: string | null) {
    authToken = token;
    if (token) {
        localStorage.setItem('auth_token', token);
    } else {
        localStorage.removeItem('auth_token');
    }
}

function authHeaders(): HeadersInit {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    return headers;
}

export async function login(username: string, password: string): Promise<{ access_token: string; role: string }> {
    const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (!response.ok) throw new Error('Login failed');
    const data = await response.json();
    setAuthToken(data.access_token);
    return data;
}

export function logout() {
    setAuthToken(null);
}

// ============ UNITS ============

export async function fetchUnits(): Promise<{ units: UnitSummary[]; count: number }> {
    const response = await fetch(`${API_BASE}/units/`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch units');
    return response.json();
}

export async function fetchUnit(unitId: string): Promise<any> {
    const response = await fetch(`${API_BASE}/units/${unitId}`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch unit');
    return response.json();
}

// ============ LIVE DATA ============

export async function fetchLiveData(unitId: string = 'GCS-001'): Promise<LiveDataResponse> {
    const response = await fetch(`${API_BASE}/units/${unitId}/live`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
}

export async function fetchResolvedData(unitId: string = 'GCS-001'): Promise<LiveDataResponse> {
    const response = await fetch(`${API_BASE}/units/${unitId}/resolved`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
}

// ============ CONFIG ============

export async function fetchEquipmentConfig(unitId: string): Promise<EquipmentConfig> {
    const response = await fetch(`${API_BASE}/config/equipment/${unitId}`);
    if (!response.ok) throw new Error('Failed to fetch equipment config');
    return response.json();
}

export async function saveEquipmentConfig(unitId: string, config: EquipmentConfig): Promise<{ status: string }> {
    const response = await fetch(`${API_BASE}/config/equipment/${unitId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error('Failed to save equipment config');
    return response.json();
}

export async function fetchGasConfig(unitId: string): Promise<any> {
    const response = await fetch(`${API_BASE}/config/gas/${unitId}`);
    if (!response.ok) throw new Error('Failed to fetch gas config');
    return response.json();
}

export async function saveGasConfig(unitId: string, config: any): Promise<{ status: string }> {
    const response = await fetch(`${API_BASE}/config/gas/${unitId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error('Failed to save gas config');
    return response.json();
}

// ============ MODBUS ============

export async function fetchModbusConfig(): Promise<any> {
    const response = await fetch(`${API_BASE}/config/modbus`);
    if (!response.ok) throw new Error('Failed to fetch Modbus config');
    return response.json();
}

export async function updateModbusConfig(config: any): Promise<{ status: string }> {
    const response = await fetch(`${API_BASE}/config/modbus`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error('Failed to update Modbus config');
    return response.json();
}

// ============ ALARMS ============

export async function fetchActiveAlarms(unitId: string): Promise<{ alarms: AlarmActive[] }> {
    const response = await fetch(`${API_BASE}/units/${unitId}/alarms/active`);
    if (!response.ok) throw new Error('Failed to fetch alarms');
    return response.json();
}

export async function fetchAlarmsSummary(unitId: string): Promise<any> {
    const response = await fetch(`${API_BASE}/units/${unitId}/alarms/summary`);
    if (!response.ok) throw new Error('Failed to fetch alarm summary');
    return response.json();
}

export async function acknowledgeAlarm(alarmId: string): Promise<{ status: string }> {
    const response = await fetch(`${API_BASE}/alarms/${alarmId}/acknowledge`, {
        method: 'POST',
        headers: authHeaders()
    });
    if (!response.ok) throw new Error('Failed to acknowledge alarm');
    return response.json();
}

export async function fetchAlarmSetpoints(unitId: string): Promise<any[]> {
    const response = await fetch(`${API_BASE}/units/${unitId}/alarms/setpoints`);
    if (!response.ok) throw new Error('Failed to fetch alarm setpoints');
    return response.json();
}

// ============ TRENDING ============

export async function fetchTrendData(unitId: string, query: TrendQuery): Promise<any> {
    const params = new URLSearchParams({
        parameters: query.parameters.join(','),
        start: query.start,
        end: query.end,
        aggregation: query.aggregation || '1m'
    });
    const response = await fetch(`${API_BASE}/trends/${unitId}?${params}`);
    if (!response.ok) throw new Error('Failed to fetch trend data');
    return response.json();
}

// ============ DIAGRAMS ============

export async function fetchPVDiagram(unitId: string, stage: number = 1) {
    const response = await fetch(`${API_BASE}/units/${unitId}/diagrams/pv?stage=${stage}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
}

export async function fetchPTDiagram(unitId: string) {
    const response = await fetch(`${API_BASE}/units/${unitId}/diagrams/pt`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
}

// ============ PHYSICS ============

export async function fetchPhysicsResults(unitId: string): Promise<any> {
    const response = await fetch(`${API_BASE}/units/${unitId}/physics`);
    if (!response.ok) throw new Error('Failed to fetch physics results');
    return response.json();
}

// ============ WEBSOCKET ============

export function createWebSocket(unitId: string, onMessage: (data: any) => void, onError?: (error: any) => void) {
    const ws = new WebSocket(`${WS_BASE}/api/units/ws/${unitId}`);

    ws.onopen = () => console.log('WebSocket connected');
    ws.onmessage = (event) => {
        try {
            onMessage(JSON.parse(event.data));
        } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
        }
    };
    ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        if (onError) onError(event);
    };
    ws.onclose = () => console.log('WebSocket disconnected');

    return ws;
}
