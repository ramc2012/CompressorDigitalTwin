/**
 * UnitContext - Provides selected unit ID and stage count to all pages
 */
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchUnits, type UnitSummary } from '../lib/api';

interface UnitContextType {
    unitId: string;
    setUnitId: (id: string) => void;
    stageCount: number;
    units: UnitSummary[];
    loading: boolean;
    refreshUnits: () => Promise<void>;
}

const UnitContext = createContext<UnitContextType | undefined>(undefined);

export function UnitProvider({ children }: { children: ReactNode }) {
    const [unitId, setUnitId] = useState('GCS-001');
    const [stageCount, setStageCount] = useState(3);
    const [units, setUnits] = useState<UnitSummary[]>([]);
    const [loading, setLoading] = useState(true);

    const refreshUnits = async () => {
        try {
            setLoading(true);
            const data = await fetchUnits();
            setUnits(data.units);

            // Update stage count for selected unit
            const selected = data.units.find(u => u.unit_id === unitId);
            if (selected) {
                setStageCount(selected.stage_count);
            }
        } catch (error) {
            console.error('Failed to fetch units:', error);
            // Use defaults if fetch fails
            setUnits([{ unit_id: 'GCS-001', name: 'GCS-001', stage_count: 3, is_active: true, has_modbus: true }]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshUnits();
    }, []);

    useEffect(() => {
        const selected = units.find(u => u.unit_id === unitId);
        if (selected) {
            setStageCount(selected.stage_count);
        }
    }, [unitId, units]);

    return (
        <UnitContext.Provider value={{ unitId, setUnitId, stageCount, units, loading, refreshUnits }}>
            {children}
        </UnitContext.Provider>
    );
}

export function useUnit() {
    const context = useContext(UnitContext);
    if (!context) {
        throw new Error('useUnit must be used within UnitProvider');
    }
    return context;
}
