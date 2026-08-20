import React from 'react';
import { UserRole } from '../../types';
import { 
  Users, Calendar, ListOrdered, Stethoscope, FileText, 
  FlaskConical, Pill, Receipt, BarChart3, LineChart, 
  FileCheck2, ShieldCheck, HeartPulse, UserCheck, Sparkles, MonitorSmartphone
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: UserRole;
  queueCount?: number;
  pendingRxCount?: number;
  pendingLabCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  userRole,
  queueCount = 4,
  pendingRxCount = 2,
  pendingLabCount = 3
}) => {

  // Role-targeted navigation configuration
  const allNavItems = [
    // General & Admin
    { id: 'dashboard', label: 'Executive Overview', icon: BarChart3, roles: ['super_admin', 'clinic_admin'] },
    { id: 'research', label: 'Academic Research Lab', icon: LineChart, badge: 'AI Sim', roles: ['super_admin', 'clinic_admin', 'doctor'] },
    
    // Clinical Operations
    { id: 'queue', label: 'Smart Hybrid Queue', icon: ListOrdered, badge: queueCount ? `${queueCount}` : undefined, roles: ['super_admin', 'clinic_admin', 'doctor', 'nurse', 'receptionist'] },
    { id: 'kiosk', label: 'Waiting Room TV Display', icon: MonitorSmartphone, roles: ['super_admin', 'clinic_admin', 'receptionist'] },
    { id: 'doctor_station', label: 'Clinical Workspace', icon: Stethoscope, roles: ['doctor', 'clinic_admin', 'super_admin'] },
    { id: 'nurse_triage', label: 'Nurse Triage & Vitals', icon: HeartPulse, roles: ['nurse', 'clinic_admin', 'super_admin'] },
    { id: 'patients', label: 'Longitudinal EHR', icon: Users, roles: ['super_admin', 'clinic_admin', 'doctor', 'nurse', 'receptionist'] },
    { id: 'appointments', label: 'Appointments Calendar', icon: Calendar, roles: ['super_admin', 'clinic_admin', 'doctor', 'receptionist'] },
    
    // Patient Portal
    { id: 'patient_portal', label: 'My Health Portal', icon: UserCheck, badge: 'Active', roles: ['patient'] },
    
    // Fulfillment & Ancillary
    { id: 'lab', label: 'Laboratory Diagnostics', icon: FlaskConical, badge: pendingLabCount ? `${pendingLabCount}` : undefined, roles: ['lab_technician', 'clinic_admin', 'super_admin', 'doctor'] },
    { id: 'pharmacy', label: 'Pharmacy & FEFO Stock', icon: Pill, badge: pendingRxCount ? `${pendingRxCount}` : undefined, roles: ['pharmacist', 'clinic_admin', 'super_admin'] },
    { id: 'billing', label: 'Billing & Invoicing', icon: Receipt, roles: ['billing_staff', 'clinic_admin', 'super_admin', 'receptionist'] },
    
    // Intelligence & Governance
    { id: 'ai_engine', label: 'Clinical CDS & RAG', icon: Sparkles, badge: 'AI', roles: ['doctor', 'clinic_admin', 'super_admin'] },
    { id: 'audit_logs', label: 'Security & Audit Trail', icon: ShieldCheck, roles: ['super_admin', 'clinic_admin'] },
  ];

  const visibleItems = allNavItems.filter(item => item.roles.includes(userRole));

  return (
    <aside className="w-64 glass-panel border-r border-slate-800/80 min-h-[calc(100vh-61px)] flex flex-col justify-between p-3 hidden md:flex">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Clinical Navigation
        </div>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                isActive
                  ? 'bg-gradient-to-r from-teal-500/20 to-teal-500/5 text-teal-300 border border-teal-500/30 shadow-glow-teal'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-teal-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-teal-500/30 text-teal-200' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Health Tech Badge */}
      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
        <div className="flex items-center space-x-2 text-[11px] font-semibold text-slate-300">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Queue Engine Active</span>
        </div>
        <p className="text-[10px] text-slate-400 mt-1">
          ML Regressor: GradientBoosting (MAE: 3.1m)
        </p>
      </div>
    </aside>
  );
};
