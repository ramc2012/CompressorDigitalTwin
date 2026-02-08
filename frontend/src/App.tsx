/**
 * GCS Digital Twin - Main Application with Full Routing
 * Updated for Phase 5: UnitProvider, TrendingPage, AlarmsPage
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { UnitProvider } from './contexts/UnitContext';
import { Dashboard } from './pages/Dashboard';
import { CompressorPage } from './pages/CompressorPage';
import { EnginePage } from './pages/EnginePage';
import { DiagramsPage } from './pages/DiagramsPage';
import { AlarmsPage } from './pages/AlarmsPage';
import { TrendingPage } from './pages/TrendingPage';
import { ConfigPage } from './pages/ConfigPage';
import { LoginPage } from './pages/LoginPage';
import { SimulatorDashboard } from './pages/SimulatorDashboard';
import { EquipmentSpecsPage } from './pages/config/EquipmentSpecsPage';
import { GasPropertiesPage } from './pages/config/GasPropertiesPage';
import { SiteConditionsPage } from './pages/config/SiteConditionsPage';
import { ModbusMappingPage } from './pages/config/ModbusMappingPage';
import { UserManagementPage } from './pages/config/UserManagementPage';
import './index.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    // For demo, we allow access but in production we'd redirect to login
    return <>{children}</>;
}

function App() {
    return (
        <BrowserRouter>
            <UnitProvider>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route
                        path="/*"
                        element={
                            <ProtectedRoute>
                                <Layout>
                                    <Routes>
                                        <Route path="/" element={<Dashboard />} />
                                        <Route path="/compressor" element={<CompressorPage />} />
                                        <Route path="/engine" element={<EnginePage />} />
                                        <Route path="/trending" element={<TrendingPage />} />
                                        <Route path="/diagrams" element={<DiagramsPage />} />
                                        <Route path="/alarms" element={<AlarmsPage />} />
                                        <Route path="/config" element={<ConfigPage />} />
                                        {/* Config Sub-pages */}
                                        <Route path="/config/equipment" element={<EquipmentSpecsPage />} />
                                        <Route path="/config/gas" element={<GasPropertiesPage />} />
                                        <Route path="/config/site" element={<SiteConditionsPage />} />
                                        <Route path="/config/modbus" element={<ModbusMappingPage />} />
                                        <Route path="/config/users" element={<UserManagementPage />} />

                                        <Route path="/simulator" element={<SimulatorDashboard />} />
                                    </Routes>
                                </Layout>
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </UnitProvider>
        </BrowserRouter>
    );
}

export default App;
