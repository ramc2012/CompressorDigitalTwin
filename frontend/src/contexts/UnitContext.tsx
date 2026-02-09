/**
 * UnitContext - Provides global access to current unit selection
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { UnitSummary } from '../lib/api';

interface UnitContextType {
    unitId: string;
    setUnitId: (id: string) => void;
    units: UnitSummary[];
    loading: boolean;
    availableUnits: string[]; // Keep for backward compatibility if needed
}

const UnitContext = createContext<UnitContextType | undefined>(undefined);

export function UnitProvider({ children }: { children: ReactNode }) {
    const [unitId, setUnitId] = useState<string>(() => {
        return localStorage.getItem('last_unit_id') || 'GCS-001';
    });
    
    // In real app, we'd fetch these from backend
    // Mocking UnitSummary objects
    const [units] = useState<UnitSummary[]>([
        { unit_id: 'GCS-001', name: 'GCS Unit 1', stage_count: 3, is_active: true, has_modbus: true },
        { unit_id: 'GCS-002', name: 'GCS Unit 2', stage_count: 3, is_active: true, has_modbus: false },
        { unit_id: 'GCS-003', name: 'GCS Unit 3', stage_count: 2, is_active: false, has_modbus: false }
    ]);
    const [loading] = useState(false);

    useEffect(() => {
        localStorage.setItem('last_unit_id', unitId);
    }, [unitId]);

    return (
        <UnitContext.Provider value={{ 
            unitId, 
            setUnitId, 
            units, 
            loading, 
            availableUnits: units.map(u => u.unit_id) 
        }}>
            {children}
        </UnitContext.Provider>
    );
}

export function useUnit() {
    const context = useContext(UnitContext);
    if (!context) {
        throw new Error('useUnit must be used within a UnitProvider');
    }
    return context;
}
