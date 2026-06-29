import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
// import { logout } from '@/store/slices/authSlice';
import {
  LayoutDashboard,
  FileText,
  Building2,
  Users,
  Phone,
  ChevronLeft,
  LogOut,
  Briefcase,
  Settings,
  Clock,
  Repeat,
  Hourglass,
  PhoneIncoming
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

interface AdminLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }, // Fixed path to '/'
  // { path: '/clients', label: 'Clients', icon: Building2 },
  // { path: '/jobs', label: 'Job Descriptions', icon: FileText },
  // { path: '/candidates', label: 'Candidates', icon: Users },
  // { path: '/users', label: 'Users', icon: Users },
  // { path: '/upcoming', label: 'Upcoming Calls', icon: PhoneIncoming }, // Preserved this link
  { path: '/sessions', label: 'Session Logs', icon: Phone },
  { path: '/ai-feedback-log', label: 'AI Feedback Log', icon: Briefcase }, // New Link
  { path: '/session-config', label: 'Session Config', icon: Clock },
];

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  // const { user } = useAppSelector((state) => state.auth);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  // Configuration State
  const [schedulerConfig, setSchedulerConfig] = useState({
    retry_limit: 3,
    retry_interval: 60, // in minutes
    start_delay: 10     // in minutes
  });

  const handleLogout = () => {
    // dispatch(logout());
    navigate('/login');
  };

  const handleSaveConfig = () => {
    // Placeholder for backend dispatch
    console.log("Saving Global Config:", schedulerConfig);
    setIsConfigOpen(false);
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`bg-card border-r border-border flex flex-col transition-all duration-300 ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-5 h-5 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <span className="font-semibold text-foreground">BLUE CROSS</span>
          )}
        </div>

        {/* Collapse Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 px-4 py-3 text-muted-foreground hover:text-foreground transition-colors border-b border-border"
        >
          <ChevronLeft
            className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
          />
          {!isCollapsed && <span className="text-sm">Collapse</span>}
        </button>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-end px-6">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-3 cursor-pointer outline-none">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {/* {user?.name ? getInitials(user.name) : 'U'} */}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-foreground">
                {/* {user?.name || 'User'} */}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {/* <DropdownMenuItem onClick={() => setIsConfigOpen(true)} className="cursor-pointer">
                <Settings className="w-4 h-4 mr-2" />
                Scheduler Configuration
              </DropdownMenuItem> */}
              
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Scheduler Config Dialog */}
        <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Auto-Schedule Settings
              </DialogTitle>
            </DialogHeader>
            
            <div className="grid gap-6 py-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Hourglass className="w-4 h-4 text-muted-foreground" />
                  Initial Delay (Minutes)
                </Label>
                <Input 
                  type="number" 
                  value={schedulerConfig.start_delay}
                  onChange={(e) => setSchedulerConfig({...schedulerConfig, start_delay: parseInt(e.target.value) || 0})}
                  placeholder="Minutes to wait before first call"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-muted-foreground" />
                  Max Retry Attempts
                </Label>
                <Input 
                  type="number" 
                  value={schedulerConfig.retry_limit}
                  onChange={(e) => setSchedulerConfig({...schedulerConfig, retry_limit: parseInt(e.target.value) || 0})}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Retry Interval (Minutes)
                </Label>
                <Input 
                  type="number" 
                  value={schedulerConfig.retry_interval}
                  onChange={(e) => setSchedulerConfig({...schedulerConfig, retry_interval: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsConfigOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveConfig}>Save Configuration</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6 bg-slate-50/50">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;