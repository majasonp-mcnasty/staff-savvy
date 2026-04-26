import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { DateProvider } from "./context/DateContext";
import AppLayout from "./components/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import EmployeesPage from "./pages/EmployeesPage";
import StationsPage from "./pages/StationsPage";
import SchedulePage from "./pages/SchedulePage";
import SettingsPage from "./pages/SettingsPage";
import ForecastDataPage from "./pages/ForecastDataPage";
import ReportsPage from "./pages/ReportsPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/employees", element: <EmployeesPage /> },
      { path: "/stations", element: <StationsPage /> },
      { path: "/schedule", element: <SchedulePage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/forecast-data", element: <ForecastDataPage /> },
      { path: "/reports", element: <ReportsPage /> },
      { path: "/integrations", element: <IntegrationsPage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <DateProvider>
          <RouterProvider router={router} />
        </DateProvider>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
