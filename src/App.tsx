import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import AppLayout from "./components/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import EmployeesPage from "./pages/EmployeesPage";
import StationsPage from "./pages/StationsPage";
import SchedulePage from "./pages/SchedulePage";
import SettingsPage from "./pages/SettingsPage";
import ForecastDataPage from "./pages/ForecastDataPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/employees" element={<EmployeesPage />} />
              <Route path="/stations" element={<StationsPage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/forecast-data" element={<ForecastDataPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
