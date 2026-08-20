import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { User } from '../../types';
import { 
  Activity, ShieldCheck, UserCheck, Stethoscope, HeartPulse, 
  FlaskConical, Pill, Receipt, Users, AlertCircle, ArrowRight, Lock, Mail
} from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoUsers, setDemoUsers] = useState<any[]>([]);

  useEffect(() => {
    api.getDemoUsers()
      .then(users => setDemoUsers(users))
      .catch(err => console.error('Failed to load demo accounts', err));
  }, []);

  const handleLogin = async (loginEmail?: string, loginPassword?: string) => {
    setError(null);
    setLoading(true);
    const targetEmail = loginEmail || email;
    const targetPassword = loginPassword || password;

    try {
      const response = await api.login(targetEmail, targetPassword);
      localStorage.setItem('aiscos_token', response.access_token);
      onLoginSuccess(response.user);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password credentials');
    } finally {
      setLoading(false);
    }
  };

  const getPersonaIcon = (role: string) => {
    switch (role) {
      case 'clinic_admin':
      case 'super_admin':
        return <ShieldCheck className="w-5 h-5 text-teal-400" />;
      case 'doctor':
        return <Stethoscope className="w-5 h-5 text-sky-400" />;
      case 'nurse':
        return <HeartPulse className="w-5 h-5 text-rose-400" />;
      case 'receptionist':
        return <UserCheck className="w-5 h-5 text-amber-400" />;
      case 'pharmacist':
        return <Pill className="w-5 h-5 text-emerald-400" />;
      case 'lab_technician':
        return <FlaskConical className="w-5 h-5 text-purple-400" />;
      case 'billing_staff':
        return <Receipt className="w-5 h-5 text-indigo-400" />;
      case 'patient':
        return <Users className="w-5 h-5 text-teal-300" />;
      default:
        return <Activity className="w-5 h-5 text-teal-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Dynamic ambient background glow */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-5xl z-10 space-y-8">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center space-x-3 p-2 px-4 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 font-mono text-xs tracking-wider mb-2">
            <Activity className="w-4 h-4 animate-pulse text-teal-400" />
            <span>AISCOS ENTERPRISE HEALTHCARE PLATFORM</span>
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-sky-200 to-indigo-300">
            Sign In to AISCOS
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
            AI-Powered Smart Clinic & Hospital Operating System. Access clinical workstations, live triage queues, e-prescriptions & diagnostics.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Credentials Form */}
          <div className="lg:col-span-5 p-6 sm:p-8 rounded-3xl glass-panel border border-slate-800/80 shadow-2xl bg-slate-900/80 space-y-6">
            <div>
              <h2 className="font-heading text-xl font-bold text-slate-100">Secure Staff & Patient Login</h2>
              <p className="text-xs text-slate-400 mt-1">Authenticate using your AISCOS credentials</p>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 flex items-start space-x-3 text-red-200 text-xs">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                  <Mail className="w-3.5 h-3.5 text-teal-400" />
                  <span>Email Address</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@aiscos.health"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700/70 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                  <Lock className="w-3.5 h-3.5 text-teal-400" />
                  <span>Password</span>
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700/70 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-sky-600 hover:from-teal-400 hover:to-sky-500 text-slate-950 font-bold text-sm tracking-wide shadow-glow-teal flex items-center justify-center space-x-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Enter Clinical Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-800 text-center">
              <span className="text-[11px] text-slate-500">
                Encrypted via SHA-256 JWT Token Rotation • HIPAA & HL7 FHIR R4 Ready
              </span>
            </div>
          </div>

          {/* 1-Click Quick Demo Personas Grid */}
          <div className="lg:col-span-7 p-6 sm:p-8 rounded-3xl glass-panel border border-slate-800/80 bg-slate-900/60 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading text-lg font-bold text-slate-100 flex items-center space-x-2">
                  <span>1-Click Demo Personas</span>
                  <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-mono font-bold">
                    PRE-CONFIGURED
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select any clinical or administrative persona for immediate evaluation
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
              {demoUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    setEmail(user.email);
                    setPassword('password123');
                    handleLogin(user.email, 'password123');
                  }}
                  disabled={loading}
                  className="p-3.5 rounded-2xl bg-slate-950/60 hover:bg-teal-950/30 border border-slate-800 hover:border-teal-500/50 text-left transition-all group flex items-start space-x-3 cursor-pointer"
                >
                  <div className="p-2 rounded-xl bg-slate-900 group-hover:bg-teal-500/20 border border-slate-800 group-hover:border-teal-500/40 shrink-0 transition-colors">
                    {getPersonaIcon(user.role)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-xs text-slate-200 group-hover:text-teal-300 truncate">
                        {user.full_name}
                      </h4>
                    </div>
                    <p className="text-[11px] text-teal-400 font-medium truncate">
                      {user.role_title}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                      {user.email}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
              <span>All demo accounts use password: <code className="text-teal-300 font-mono">password123</code></span>
              <span className="text-emerald-400 font-semibold">● Database Live & Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
