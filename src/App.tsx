import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { PlainLayout } from '@/layouts/PlainLayout';
import { Dashboard } from '@/pages/Dashboard';
import { PickupRequestList } from '@/pages/PickupRequestList';
import { PickupRequestDetail } from '@/pages/PickupRequestDetail';
import { LoadList } from '@/pages/LoadList';
import { CreateLoad } from '@/pages/CreateLoad';
import { LoadWorkspace } from '@/pages/LoadWorkspace';
import { ShipmentList } from '@/pages/ShipmentList';
import { ShipmentDetail } from '@/pages/ShipmentDetail';
import { WarehouseDashboard } from '@/pages/WarehouseDashboard';
import { PlantGate } from '@/pages/PlantGate';
import { SettingsPage } from '@/pages/Settings';
import { SettingsClients } from '@/pages/SettingsClients';
import { SettingsTransporters } from '@/pages/SettingsTransporters';
import { SettingsVehicles } from '@/pages/SettingsVehicles';
import { SettingsLocations } from '@/pages/SettingsLocations';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Plant Gate — no sidebar */}
        <Route element={<PlainLayout />}>
          <Route path="/plant-gate" element={<PlantGate />} />
        </Route>

        {/* Main app with sidebar */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pickup-requests" element={<PickupRequestList />} />
          <Route path="/pickup-requests/:id" element={<PickupRequestDetail />} />
          <Route path="/loads" element={<LoadList />} />
          <Route path="/loads/create" element={<CreateLoad />} />
          <Route path="/loads/:id" element={<LoadWorkspace />} />
          <Route path="/shipments" element={<ShipmentList />} />
          <Route path="/shipments/:id" element={<ShipmentDetail />} />
          <Route path="/warehouse" element={<WarehouseDashboard />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/clients" element={<SettingsClients />} />
          <Route path="/settings/transporters" element={<SettingsTransporters />} />
          <Route path="/settings/vehicles" element={<SettingsVehicles />} />
          <Route path="/settings/locations" element={<SettingsLocations />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
