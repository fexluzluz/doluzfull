import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLogAccess } from '@/hooks/useLogAccess';
import { Navigate } from 'react-router-dom';
import { Loader2, Package, LayoutDashboard, BoxesIcon, Users, Truck, ArrowDownUp, LogOut, Menu, ScrollText, MapPin, PackageCheck, ClipboardList } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, profile, isAdmin, isLoading, signOut } = useAuth();
  const { hasLogAccess } = useLogAccess();
  const [isOpen, setIsOpen] = useState(false);

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
        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}