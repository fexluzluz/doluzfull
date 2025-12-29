import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLogAccess } from '@/hooks/useLogAccess';
import { Navigate } from 'react-router-dom';
import { Loader2, Package, LayoutDashboard, BoxesIcon, Users, Truck, ArrowDownUp, LogOut, Menu, ScrollText, MapPin, PackageCheck, ClipboardList, BarChart3, UserCog, ArrowLeft } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import ChangePasswordDialog from '@/components/auth/ChangePasswordDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, profile, isAdmin, isLoading, signOut, mustChangePassword, refreshProfile } = useAuth();
  const { hasLogAccess } = useLogAccess();
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  
  // Check if impersonating
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState<string | null>(null);
  
  useEffect(() => {
    const impersonating = localStorage.getItem('impersonating') === 'true';
    const userName = localStorage.getItem('impersonated_user');
    setIsImpersonating(impersonating);
    setImpersonatedUser(userName);
  }, []);
  
  const handleExitImpersonation = async () => {
    try {
      const adminSessionStr = localStorage.getItem('admin_session');
      if (!adminSessionStr) {
        throw new Error('Sessão de admin não encontrada');
      }
      
      const adminSession = JSON.parse(adminSessionStr);
      
      // Restore admin session
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });
      
      // Clear impersonation flags
      localStorage.removeItem('impersonating');
      localStorage.removeItem('impersonated_user');
      localStorage.removeItem('admin_session');
      
      toast({ title: 'Voltando para sua conta de admin' });
      
      // Redirect to users page
      window.location.href = '/users';
    } catch (error: any) {
      console.error('Error exiting impersonation:', error);
      // If restore fails, sign out and redirect to auth
      await signOut();
      window.location.href = '/auth';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handlePasswordChanged = async () => {
    await refreshProfile();
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/products', icon: BoxesIcon, label: 'Produtos' },
    { to: '/receiving', icon: PackageCheck, label: 'Recebimento' },
    { to: '/picking', icon: ClipboardList, label: 'Picking' },
    { to: '/shipments', icon: Truck, label: 'Envios' },
    { to: '/movements', icon: ArrowDownUp, label: 'Movimentações' },
  ];

  if (isAdmin) {
    navItems.splice(2, 0, { to: '/clients', icon: Users, label: 'Clientes' });
    navItems.push({ to: '/locations', icon: MapPin, label: 'Localizações' });
    navItems.push({ to: '/reports', icon: BarChart3, label: 'Relatórios' });
    navItems.push({ to: '/users', icon: UserCog, label: 'Usuários' });
  }

  if (hasLogAccess) {
    navItems.push({ to: '/logs', icon: ScrollText, label: 'Logs' });
  }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-4 flex items-center gap-3">
        <div className="bg-sidebar-primary p-2 rounded-lg">
          <Package className="h-6 w-6 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="font-bold text-lg">Do Luz Full</h1>
          <p className="text-xs text-sidebar-foreground/70">Fulfillment</p>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            activeClassName="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
            onClick={() => setIsOpen(false)}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* User info */}
      <div className="p-4">
        <div className="mb-3">
          <p className="font-medium text-sm truncate">{profile?.full_name || 'Usuário'}</p>
          <p className="text-xs text-sidebar-foreground/60 truncate">{profile?.email}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row w-full bg-background">
      {/* Change Password Dialog */}
      {profile && (
        <ChangePasswordDialog
          open={mustChangePassword}
          profileId={profile.id}
          onSuccess={handlePasswordChanged}
        />
      )}

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3">
          <div className="bg-sidebar-primary p-2 rounded-lg">
            <Package className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <h1 className="font-bold">Do Luz Full</h1>
        </div>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 bg-sidebar text-sidebar-foreground border-sidebar-border">
            <div className="flex flex-col h-full">
              <SidebarContent />
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border shrink-0">
        <SidebarContent />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Impersonation Banner */}
        {isImpersonating && (
          <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                👁️ Você está acessando como: {impersonatedUser || 'outro usuário'}
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExitImpersonation}
              className="bg-white text-amber-600 hover:bg-amber-50"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para Admin
            </Button>
          </div>
        )}
        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}