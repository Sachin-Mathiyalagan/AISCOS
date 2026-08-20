import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole, Doctor, QueueEntry } from './types';
import { api } from './api/client';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { LoginPage } from './components/auth/LoginPage';
import { LiveQueueBoard } from './components/queue/LiveQueueBoard';
import { ConsultationWorkspace } from './components/doctor/ConsultationWorkspace';
import { PatientPortal } from './components/patient/PatientPortal';
import { LongitudinalEHR } from './components/patient/LongitudinalEHR';
import { AnalyticsDashboard } from './components/admin/AnalyticsDashboard';
import { ResearchSimulation } from './components/research/ResearchSimulation';
import { NurseTriagePortal } from './components/nurse/NurseTriagePortal';
import { PharmacyConsole } from './components/pharmacy/PharmacyConsole';
import { LabConsole } from './components/lab/LabConsole';
import { BillingConsole } from './components/billing/BillingConsole';
import { AppointmentsCalendar } from './components/appointments/AppointmentsCalendar';
import { WaitingRoomKiosk } from './components/queue/WaitingRoomKiosk';
import { AuditLogViewer } from './components/audit/AuditLogViewer';
import { AIChatbotWidget } from './components/ai/AIChatbotWidget';
import { Bell, X, CheckCircle, RefreshCw } from 'lucide-react';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number>(1);
  const [activePatientPortalId, setActivePatientPortalId] = useState<number>(1);
  const [activeConsultationEntry, setActiveConsultationEntry] = useState<QueueEntry | null>(null);
  
  // Dynamic Badge Counts
  const [queueCount, setQueueCount] = useState<number>(0);
  const [pendingRxCount, setPendingRxCount] = useState<number>(0);
  const [pendingLabCount, setPendingLabCount] = useState<number>(0);

  // Modals & Drawers
  const [showAIChat, setShowAIChat] = useState(false);
  const [showNotifsModal, setShowNotifsModal] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const fetchLiveTelemetry = useCallback(async () => {
    try {
      const [docs, notifs, qSummary, rxCount, labCount] = await Promise.all([
        api.getDoctors().catch(() => []),
        api.getNotifications().catch(() => []),
        api.getQueueSummary().catch(() => ({ total_waiting: 0 })),
        api.getPendingPrescriptionsCount().catch(() => ({ pending_count: 0 })),
        api.getLabWorklistCount().catch(() => ({ pending_count: 0 }))
      ]);
      setDoctors(docs);
      setNotifications(notifs);
      setQueueCount(qSummary.total_waiting || 0);
      setPendingRxCount(rxCount.pending_count || 0);
      setPendingLabCount(labCount.pending_count || 0);
      if (docs.length > 0 && !selectedDoctorId) {
        setSelectedDoctorId(docs[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch live telemetry:', err);
    }
  }, [selectedDoctorId]);

  // Initial Auth Check
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('aiscos_token');
      if (token) {
        try {
          const user = await api.getCurrentUser();
          setCurrentUser(user);
          if (user.role === 'patient') setActiveTab('patient_portal');
          else if (user.role === 'doctor') setActiveTab('doctor_station');
          else if (user.role === 'nurse') setActiveTab('nurse_triage');
          else if (user.role === 'pharmacist') setActiveTab('pharmacy');
          else if (user.role === 'lab_technician') setActiveTab('lab');
          else if (user.role === 'billing_staff') setActiveTab('billing');
          else setActiveTab('dashboard');
        } catch (err) {
          console.warn('Session expired or invalid token:', err);
          localStorage.removeItem('aiscos_token');
          setCurrentUser(null);
        }
      }
      setAuthChecking(false);
    };
    checkAuth();
  }, []);

  // Sync telemetry when user is logged in
  useEffect(() => {
    if (currentUser) {
      fetchLiveTelemetry();
      const interval = setInterval(fetchLiveTelemetry, 5000);
      return () => clearInterval(interval);
    }
  }, [currentUser, fetchLiveTelemetry]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'doctor' && user.doctor_profile?.id) {
      setSelectedDoctorId(user.doctor_profile.id);
    }
    if (user.role === 'patient' && user.patient_profile?.id) {
      setActivePatientPortalId(user.patient_profile.id);
    }
    if (user.role === 'patient') setActiveTab('patient_portal');
    else if (user.role === 'doctor') setActiveTab('doctor_station');
    else if (user.role === 'nurse') setActiveTab('nurse_triage');
    else if (user.role === 'pharmacist') setActiveTab('pharmacy');
    else if (user.role === 'lab_technician') setActiveTab('lab');
    else if (user.role === 'billing_staff') setActiveTab('billing');
    else setActiveTab('dashboard');
    fetchLiveTelemetry();
  };

  const handleLogout = () => {
    localStorage.removeItem('aiscos_token');
    setCurrentUser(null);
    setActiveConsultationEntry(null);
    setActivePatientPortalId(1);
    setActiveTab('dashboard');
  };

  // Role switching helper for quick demo switching
  const handleRoleSwitch = async (role: UserRole) => {
    const roleCredentials: Record<UserRole, { email: string; pass: string }> = {
      super_admin: { email: 'superadmin@aiscos.health', pass: 'Admin@123' },
      clinic_admin: { email: 'clinicadmin@aiscos.health', pass: 'Admin@123' },
      doctor: { email: 'dr.sharma@aiscos.health', pass: 'Doctor@123' },
      nurse: { email: 'nurse.mary@aiscos.health', pass: 'Nurse@123' },
      receptionist: { email: 'reception@aiscos.health', pass: 'Reception@123' },
      pharmacist: { email: 'pharmacist.david@aiscos.health', pass: 'Pharmacy@123' },
      lab_technician: { email: 'labtech.alex@aiscos.health', pass: 'Lab@123' },
      billing_staff: { email: 'billing.sarah@aiscos.health', pass: 'Billing@123' },
      patient: { email: 'patient.john@aiscos.health', pass: 'Patient@123' },
    };

    try {
      const cred = roleCredentials[role] || { email: 'clinicadmin@aiscos.health', pass: 'password123' };
      const res = await api.login(cred.email, cred.pass);
      localStorage.setItem('aiscos_token', res.access_token);
      setCurrentUser(res.user);

      if (res.user.role === 'doctor' && res.user.doctor_profile?.id) {
        setSelectedDoctorId(res.user.doctor_profile.id);
      }
      if (role === 'patient') {
        setActivePatientPortalId(res.user.patient_profile?.id || 1);
      }

      if (role === 'patient') setActiveTab('patient_portal');
      else if (role === 'doctor') setActiveTab('doctor_station');
      else if (role === 'nurse') setActiveTab('nurse_triage');
      else if (role === 'pharmacist') setActiveTab('pharmacy');
      else if (role === 'lab_technician') setActiveTab('lab');
      else if (role === 'billing_staff') setActiveTab('billing');
      else if (role === 'clinic_admin' || role === 'super_admin') setActiveTab('dashboard');
      else setActiveTab('queue');

      fetchLiveTelemetry();
    } catch (err) {
      console.error('Role switch failed:', err);
    }
  };

  const handleStartConsultation = (entry: QueueEntry) => {
    setActiveConsultationEntry(entry);
    if (entry.patient_id) {
      setActivePatientPortalId(entry.patient_id);
    }
    setActiveTab('doctor_station');
  };

  const handleFinishConsultation = () => {
    setActiveConsultationEntry(null);
    fetchLiveTelemetry();
    setActiveTab('queue');
  };

  const handleMarkNotificationRead = async (notifId: number) => {
    try {
      await api.markNotificationRead(notifId);
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-mono text-teal-400">Initializing AISCOS Clinical Engine...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const currentRole = currentUser.role;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-teal-500 selection:text-white">
      
      {/* Top Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        onRoleSwitch={handleRoleSwitch}
        onLogout={handleLogout}
        unreadNotifsCount={notifications.filter(n => !n.is_read).length}
        onOpenNotifs={() => setShowNotifsModal(true)}
        onOpenAIChat={() => setShowAIChat(true)}
      />

      {/* Body Layout */}
      <div className="flex-1 flex">
        
        {/* Dynamic Sidebar with Live Badge Counts */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userRole={currentRole}
          queueCount={queueCount}
          pendingRxCount={pendingRxCount}
          pendingLabCount={pendingLabCount}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
          
          {activeTab === 'dashboard' && <AnalyticsDashboard />}
          
          {activeTab === 'research' && <ResearchSimulation />}

          {activeTab === 'queue' && (
            <LiveQueueBoard
              doctors={doctors}
              selectedDoctorId={selectedDoctorId}
              onSelectDoctor={setSelectedDoctorId}
              onStartConsultation={handleStartConsultation}
            />
          )}

          {activeTab === 'kiosk' && <WaitingRoomKiosk />}

          {activeTab === 'doctor_station' && (
            <ConsultationWorkspace
              activeQueueEntry={activeConsultationEntry}
              onFinishConsultation={handleFinishConsultation}
              doctors={doctors}
              selectedDoctorId={selectedDoctorId}
              onSelectDoctor={setSelectedDoctorId}
            />
          )}

          {activeTab === 'patient_portal' && (
            <PatientPortal 
              patientId={activePatientPortalId} 
              onSelectPatient={setActivePatientPortalId} 
            />
          )}

          {activeTab === 'nurse_triage' && <NurseTriagePortal />}

          {activeTab === 'patients' && <LongitudinalEHR />}

          {activeTab === 'appointments' && <AppointmentsCalendar />}

          {activeTab === 'pharmacy' && <PharmacyConsole />}

          {activeTab === 'lab' && <LabConsole />}

          {activeTab === 'billing' && <BillingConsole />}

          {activeTab === 'audit_logs' && <AuditLogViewer />}

          {activeTab === 'ai_engine' && (
            <div className="space-y-6">
              <ResearchSimulation />
            </div>
          )}

        </main>
      </div>

      {/* Floating AI Medical Assistant Drawer */}
      <AIChatbotWidget isOpen={showAIChat} onClose={() => setShowAIChat(false)} />

      {/* Real-time Notifications Modal */}
      {showNotifsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-slate-100">Live Health Notifications</h3>
                  <p className="text-[11px] text-slate-400">System, Clinical & In-App Alerts</p>
                </div>
              </div>
              <button 
                onClick={() => setShowNotifsModal(false)} 
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No notifications recorded yet.
                </div>
              ) : (
                notifications.map((n) => (
                  <div 
                    key={n.id} 
                    onClick={() => handleMarkNotificationRead(n.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                      n.is_read 
                        ? 'bg-slate-900/40 border-slate-800/60 opacity-70' 
                        : 'bg-gradient-to-r from-teal-950/40 to-slate-900/80 border-teal-500/40 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {!n.is_read && <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />}
                        <span className="font-bold text-xs text-teal-300">{n.title}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 font-mono text-slate-400">
                        {n.channel || 'In-App'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{n.message}</p>
                    <div className="text-[10px] text-slate-500 font-mono text-right">
                      {n.sent_at ? new Date(n.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">
                {notifications.filter(n => !n.is_read).length} unread alerts
              </span>
              <button
                onClick={() => fetchLiveTelemetry()}
                className="flex items-center space-x-1.5 text-teal-400 hover:text-teal-300 font-semibold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Feed</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
export default App;
