/**
 * UnitSelector - Dropdown for selecting active unit
 */
import { useUnit } from '../contexts/UnitContext';

export function UnitSelector() {
    const { unitId, setUnitId, units, loading } = useUnit();

    if (loading) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <span className="text-slate-400 text-sm">Loading...</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Unit:</span>
            <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50"
            >
                {units.map((unit) => (
                    <option key={unit.unit_id} value={unit.unit_id}>
                        {unit.name} ({unit.stage_count} stages)
                    </option>
                ))}
            </select>
        </div>
    );
}
