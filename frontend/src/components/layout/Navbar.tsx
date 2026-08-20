import React from 'react';
import { User, UserRole } from '../../types';
import { 
  Activity, Bell, Shield, UserCheck, Stethoscope, HeartPulse, 
  UserPlus, Pill, FlaskConical, Receipt, LayoutDashboard, Sparkles, 
  ChevronDown, LogOut 
} from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  onRoleSwitch: (role: UserRole) => void;
  onLogout: () => void;
  unreadNotifsCount: number;
  onOpenNotifs: () => void;
  onOpenAIChat: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onRoleSwitch,
  onLogout,
  unreadNotifsCount,
  onOpenNotifs,
  onOpenAIChat
}) => {
  const [roleMenuOpen, setRoleMenuOpen] = React.useState(false);

  const roles: { role: UserRole; label: string; icon: any; color: string }[] = [
    { role: 'clinic_admin', label: 'Clinic Admin', icon: LayoutDashboard, color: 'text-purple-400' },
    { role: 'doctor', label: 'Doctor Station (Specialists)', icon: Stethoscope, color: 'text-teal-400' },
    { role: 'patient', label: 'Patient Portal', icon: UserCheck, color: 'text-blue-400' },
    { role: 'receptionist', label: 'Receptionist (Sarah Davis)', icon: UserPlus, color: 'text-amber-400' },
    { role: 'nurse', label: 'Triage Nurse (Mary Johnson)', icon: HeartPulse, color: 'text-rose-400' },
    { role: 'pharmacist', label: 'Pharmacist (David Miller)', icon: Pill, color: 'text-emerald-400' },
    { role: 'lab_technician', label: 'Lab Tech (Alex Wilson)', icon: FlaskConical, color: 'text-cyan-400' },
    { role: 'billing_staff', label: 'Billing Specialist (Emma)', icon: Receipt, color: 'text-indigo-400' },
    { role: 'super_admin', label: 'Super Admin', icon: Shield, color: 'text-red-400' },
  ];

  const currentRoleInfo = roles.find(r => r.role === currentUser?.role) || roles[0];

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 px-4 lg:px-8 py-3 transition-all">
      <div className="flex items-center justify-between">
        
        {/* Brand Logo & Realtime Status */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 via-teal-500 to-cyan-400 text-white shadow-glow-teal font-bold text-xl">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-heading font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-teal-200 bg-clip-text text-transparent">
                AISCOS
              </span>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30">
                PROD v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              AI-Powered Smart Clinic Operating System
            </p>
          </div>
        </div>

        {/* Action Center & Quick Role Switcher */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          
          {/* AI Assistant Quick Trigger */}
          <button
            onClick={onOpenAIChat}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-teal-500/10 to-indigo-500/10 hover:from-teal-500/20 hover:to-indigo-500/20 border border-teal-500/30 text-teal-300 text-xs font-medium transition-all shadow-sm group cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-teal-400 group-hover:rotate-12 transition-transform" />
            <span className="hidden md:inline">AI Medical Assistant</span>
          </button>

          {/* Notifications Bell */}
          <button
            onClick={onOpenNotifs}
            className="relative p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-teal-500 text-slate-950 font-bold text-[10px] flex items-center justify-center animate-bounce">
                {unreadNotifsCount}
              </span>
            )}
          </button>

          {/* Interactive Role Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setRoleMenuOpen(!roleMenuOpen)}
              className="flex items-center space-x-2.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium transition-all shadow-inner cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <currentRoleInfo.icon className={`w-4 h-4 ${currentRoleInfo.color}`} />
              <div className="text-left hidden sm:block">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Active Persona</div>
                <div className="font-semibold text-slate-200">{currentUser?.full_name || currentRoleInfo.label}</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {roleMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 glass-panel border border-slate-700/80 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 border-b border-slate-800 uppercase tracking-wider">
                  Switch Clinical Persona (Demo Mode)
                </div>
                <div className="mt-1 space-y-1 max-h-80 overflow-y-auto">
                  {roles.map((r) => {
                    const Icon = r.icon;
                    const isActive = r.role === currentUser?.role;
                    return (
                      <button
                        key={r.role}
                        onClick={() => {
                          onRoleSwitch(r.role);
                          setRoleMenuOpen(false);
                        }}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          isActive
                            ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                            : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${r.color}`} />
                        <span className="flex-1 text-left">{r.label}</span>
                        {isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/30 text-teal-200">Active</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            title="Sign Out"
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-red-500/20 border border-slate-700 hover:border-red-500/40 text-slate-300 hover:text-red-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>

        </div>
      </div>
    </header>
  );
};
