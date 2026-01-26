import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Products from "./pages/Products";
import Movements from "./pages/Movements";
import Clients from "./pages/Clients";
import Shipments from "./pages/Shipments";
import Logs from "./pages/Logs";
import Locations from "./pages/Locations";
import Receiving from "./pages/Receiving";
import Picking from "./pages/Picking";
import Reports from "./pages/Reports";
import FinancialReport from "./pages/FinancialReport";
import Users from "./pages/Users";
import MyCompany from "./pages/MyCompany";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/products" element={<Products />} />
            <Route path="/movements" element={<Movements />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/shipments" element={<Shipments />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/locations" element={<Locations />} />
            <Route path="/receiving" element={<Receiving />} />
            <Route path="/picking" element={<Picking />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/financial" element={<FinancialReport />} />
            <Route path="/users" element={<Users />} />
            <Route path="/my-company" element={<MyCompany />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;