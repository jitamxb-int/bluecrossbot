import { ReactNode, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { UploadCloud, Database, ChevronLeft } from 'lucide-react';
import { ROUTES } from '../../routes/routePaths';

interface UploadLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: ROUTES.UPLOAD, label: 'Upload Documents', icon: UploadCloud },
  { path: ROUTES.MANAGE, label: 'Manage Vector Store', icon: Database },
];

const UploadLayout = ({ children }: UploadLayoutProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

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
            <UploadCloud className="w-5 h-5 text-primary-foreground" />
          </div>
          {!isCollapsed && <span className="font-semibold text-foreground">BlueCross Upload</span>}
        </div>

        {/* Collapse Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 px-4 py-3 text-muted-foreground hover:text-foreground transition-colors border-b border-border"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
          {!isCollapsed && <span className="text-sm">Collapse</span>}
        </button>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`
                }
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {!isCollapsed && (
          <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
            Ingestion console
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-card border-b border-border flex items-center px-6">
          <span className="text-sm text-muted-foreground">
            Blue Cross Laboratories — Knowledge Base Ingestion
          </span>
        </header>
        <main className="flex-1 overflow-auto p-6 bg-slate-50/50">{children}</main>
      </div>
    </div>
  );
};

export default UploadLayout;
