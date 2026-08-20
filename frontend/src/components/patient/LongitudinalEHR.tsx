import React, { useState, useEffect } from 'react';
import { Patient } from '../../types';
import { api } from '../../api/client';
import { 
  Users, Search, Plus, Calendar, Clock, Activity, Pill, 
  FlaskConical, AlertTriangle, ShieldCheck, FileText, QrCode, 
  TrendingUp, ArrowUpRight, CheckCircle2, UserCheck, HeartPulse,
  Printer, Download, X, Stethoscope, ChevronRight, Sparkles, Filter
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend
} from 'recharts';

export const LongitudinalEHR: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [ehrData, setEhrData] = useState<{ patient: any; timeline: any[] } | null>(null);

  // New Patient Modal State
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [newPatientData, setNewPatientData] = useState({
    first_name: '',
    last_name: '',
    dob: '1990-05-15',
    gender: 'Male',
    phone: '+1 (555) 0123',
    email: '',
    blood_group: 'O+',
    allergies: 'None',
    chronic_conditions: 'None',
    current_medications: 'None',
    insurance_provider: 'Aetna Global Health',
    insurance_policy_number: 'POL-99201',
    emergency_contact_name: 'Jane Doe',
    emergency_contact_phone: '+1 (555) 0199'
  });

  // Filter Timeline
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'consultations' | 'prescriptions' | 'labs'>('all');

  // Load patient list
  const loadPatients = async (query?: string) => {
    try {
      setLoading(true);
      const data = await api.getPatients(query);
      setPatients(data);
      if (data.length > 0 && !selectedPatientId) {
        setSelectedPatientId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load patient directory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadPatients(searchQuery.trim() || undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load Longitudinal Timeline for selected patient
  const loadPatientTimeline = async (patientId: number) => {
    try {
      setTimelineLoading(true);
      const res = await api.getPatientTimeline(patientId);
      setEhrData(res);
    } catch (err) {
      console.error('Failed to fetch EHR records:', err);
    } finally {
      setTimelineLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPatientId) {
      loadPatientTimeline(selectedPatientId);
    }
  }, [selectedPatientId]);

  // Handle New Patient Registration
  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.createPatient(newPatientData);
      alert(`Patient ${created.first_name} ${created.last_name} registered successfully with MRN ${created.mrn}!`);
      setShowNewPatientModal(false);
      await loadPatients();
      setSelectedPatientId(created.id);
    } catch (err: any) {
      alert(err.message || 'Patient registration failed');
    }
  };

  // FHIR Export
  const handleExportFHIR = async () => {
    if (!selectedPatientId) return;
    try {
      const fhirRes = await api.getFhirPatient(selectedPatientId);
      const blob = new Blob([JSON.stringify(fhirRes, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FHIR-Patient-${ehrData?.patient?.mrn || selectedPatientId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'FHIR export failed');
    }
  };

  // Prepare Vitals historical chart data from encounters
  const vitalsChartData = (ehrData?.timeline || [])
    .filter(t => t.vitals && t.vitals.bp)
    .map(t => {
      const parts = t.vitals.bp.split('/')[0] ? t.vitals.bp.split('/') : ['120', '80'];
      const systolic = parseInt(parts[0]) || 120;
      const diastolic = parseInt(parts[1]?.split(' ')[0]) || 80;
      const pulse = parseInt(t.vitals.pulse?.split(' ')[0]) || 72;
      return {
        date: t.date?.split(' ')[0] || 'Encounter',
        systolic,
        diastolic,
        pulse
      };
    })
    .reverse();

  const patient = ehrData?.patient;
  const rawTimeline = ehrData?.timeline || [];

  const filteredTimeline = rawTimeline.filter(item => {
    if (timelineFilter === 'prescriptions') return !!item.prescription;
    if (timelineFilter === 'labs') return item.lab_orders && item.lab_orders.length > 0;
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="p-6 rounded-3xl glass-panel border border-teal-500/30 bg-gradient-to-r from-teal-950/40 via-slate-900/60 to-slate-900/40 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3.5 rounded-2xl bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-glow-teal">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <h2 className="font-heading text-2xl font-bold text-slate-100">
              Longitudinal Electronic Health Records (EHR)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive patient registry, clinical encounter history, longitudinal vitals telemetry & FHIR Interoperability
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowNewPatientModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black text-xs shadow-glow-teal cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Patient</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Patient Directory (4 cols) & Right Longitudinal Chart (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Patient Directory Selector */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-3xl glass-panel border border-slate-800 space-y-4 shadow-xl">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Name, MRN, or Phone..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-950/80 border border-slate-700 text-slate-200 text-xs focus:border-teal-500 transition-all placeholder:text-slate-500"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 px-1 border-b border-slate-800 pb-2">
              <span className="font-bold uppercase tracking-wider text-[10px]">Patient Directory</span>
              <span className="font-mono text-[11px] text-teal-400 font-bold">{patients.length} Profiles</span>
            </div>

            {/* Patients Scrollable List */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {loading ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  <Activity className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-400" />
                  Loading patient registry...
                </div>
              ) : patients.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No patients matching query.
                </div>
              ) : (
                patients.map((p) => {
                  const isSelected = selectedPatientId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPatientId(p.id)}
                      className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between group ${
                        isSelected
                          ? 'bg-gradient-to-r from-teal-500/20 to-teal-500/5 border-teal-500/50 text-slate-100 shadow-glow-teal'
                          : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                      }`}
                    >
                      <div className="space-y-1 overflow-hidden">
                        <div className="flex items-center space-x-2">
                          <span className={`font-bold text-xs truncate ${isSelected ? 'text-teal-300' : 'text-slate-200'}`}>
                            {p.first_name} {p.last_name}
                          </span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                            {p.mrn}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center space-x-2 truncate">
                          <span>{p.gender || 'Unknown'}</span>
                          <span>•</span>
                          <span>{p.blood_group || 'O+'}</span>
                          <span>•</span>
                          <span>{p.phone}</span>
                        </div>
                        {p.allergies && p.allergies !== 'None' && (
                          <span className="inline-block text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 truncate">
                            Allergy: {p.allergies}
                          </span>
                        )}
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'text-teal-400 translate-x-0.5' : 'text-slate-600 group-hover:text-slate-400'}`} />
                    </button>
                  );
                })
              )}
            </div>

          </div>
        </div>

        {/* Right Column: Longitudinal Health Record & Clinical Timeline */}
        <div className="lg:col-span-8 space-y-6">
          
          {timelineLoading ? (
            <div className="p-16 rounded-3xl glass-panel border border-slate-800 text-center space-y-3">
              <Activity className="w-8 h-8 animate-spin mx-auto text-teal-400" />
              <p className="text-xs text-slate-400 font-mono">Querying longitudinal EHR timeline & historical charts...</p>
            </div>
          ) : !patient ? (
            <div className="p-16 rounded-3xl glass-panel border border-slate-800 text-center space-y-2">
              <Users className="w-10 h-10 mx-auto text-slate-600" />
              <h3 className="font-heading font-bold text-base text-slate-200">No Patient Selected</h3>
              <p className="text-xs text-slate-400">Select a patient from the directory on the left to inspect their complete longitudinal record.</p>
            </div>
          ) : (
            <>
              {/* Patient Longitudinal Overview Card */}
              <div className="p-6 rounded-3xl glass-panel border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-teal-950/20 shadow-2xl space-y-5">
                
                {/* Top Row: Demographics & QR Identity */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center space-x-3">
                      <h3 className="font-heading text-2xl font-bold text-slate-100">
                        {patient.name}
                      </h3>
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40">
                        {patient.mrn}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1.5">
                      <span>DOB: <strong className="text-slate-200 font-mono">{patient.dob || 'N/A'}</strong></span>
                      <span>•</span>
                      <span>Gender: <strong className="text-slate-200">{patient.gender || 'N/A'}</strong></span>
                      <span>•</span>
                      <span>Blood Group: <strong className="text-rose-400 font-bold">{patient.blood_group || 'O+'}</strong></span>
                      <span>•</span>
                      <span>Insurance: <strong className="text-slate-300">{patient.insurance || 'Private Pay'}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleExportFHIR}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
                      title="Export HL7 FHIR JSON Resource"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export FHIR</span>
                    </button>
                    <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-teal-400" title="Digital QR Health Identifier">
                      <QrCode className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Longitudinal Clinical Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  
                  {/* Allergies Callout */}
                  <div className={`p-3.5 rounded-2xl border space-y-1 ${
                    patient.allergies && patient.allergies !== 'None'
                      ? 'bg-red-500/10 border-red-500/30 text-red-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300'
                  }`}>
                    <div className="flex items-center space-x-1.5">
                      <AlertTriangle className={`w-3.5 h-3.5 ${patient.allergies && patient.allergies !== 'None' ? 'text-red-400' : 'text-slate-500'}`} />
                      <span className="text-[10px] uppercase font-bold tracking-wider">Known Allergies</span>
                    </div>
                    <div className="font-bold text-xs">{patient.allergies || 'None Documented'}</div>
                  </div>

                  {/* Chronic Conditions */}
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 space-y-1">
                    <div className="flex items-center space-x-1.5">
                      <Activity className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[10px] uppercase font-bold tracking-wider">Chronic Conditions</span>
                    </div>
                    <div className="font-bold text-xs">{patient.chronic_conditions || 'None Documented'}</div>
                  </div>

                  {/* Active Medications */}
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-200 space-y-1">
                    <div className="flex items-center space-x-1.5">
                      <Pill className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] uppercase font-bold tracking-wider">Current Regimen</span>
                    </div>
                    <div className="font-bold text-xs">{patient.current_medications || 'None Documented'}</div>
                  </div>

                </div>

              </div>

              {/* Vitals Telemetry Longitudinal Trend Chart */}
              {vitalsChartData.length > 0 && (
                <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-2">
                      <HeartPulse className="w-5 h-5 text-rose-400" />
                      <h4 className="font-heading font-bold text-slate-100 text-sm">Longitudinal Blood Pressure & Pulse Telemetry</h4>
                    </div>
                    <span className="text-xs font-mono text-slate-400">{vitalsChartData.length} Recorded Readings</span>
                  </div>

                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={vitalsChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} domain={[40, 180]} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                          itemStyle={{ color: '#f8fafc' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="systolic" name="Systolic BP (mmHg)" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="diastolic" name="Diastolic BP (mmHg)" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="pulse" name="Heart Rate (bpm)" stroke="#10b981" strokeWidth={1.5} strokeDasharray="3 3" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Timeline Header & Filter Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-teal-400" />
                  <h4 className="font-heading font-bold text-slate-100 text-base">
                    Clinical Encounter Journey ({filteredTimeline.length})
                  </h4>
                </div>

                <div className="flex items-center space-x-1.5 bg-slate-900/80 p-1 rounded-2xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setTimelineFilter('all')}
                    className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${timelineFilter === 'all' ? 'bg-teal-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    All Events
                  </button>
                  <button
                    onClick={() => setTimelineFilter('prescriptions')}
                    className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${timelineFilter === 'prescriptions' ? 'bg-teal-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Prescriptions
                  </button>
                  <button
                    onClick={() => setTimelineFilter('labs')}
                    className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${timelineFilter === 'labs' ? 'bg-teal-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Lab Reports
                  </button>
                </div>
              </div>

              {/* Chronological Encounter Cards List */}
              {filteredTimeline.length === 0 ? (
                <div className="p-12 rounded-3xl glass-panel border border-slate-800 text-center text-xs text-slate-500 space-y-1">
                  <Activity className="w-6 h-6 mx-auto text-slate-600" />
                  <p>No clinical encounters recorded in this patient's electronic health record yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTimeline.map((enc, idx) => (
                    <div
                      key={enc.encounter_id || idx}
                      className="p-6 rounded-3xl glass-panel border border-slate-800/80 bg-slate-900/60 shadow-xl space-y-4 hover:border-teal-500/40 transition-all"
                    >
                      {/* Top Encounter Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 rounded-xl bg-teal-500/10 text-teal-300 font-mono font-bold text-xs border border-teal-500/20">
                            {enc.encounter_code || `ENC-${idx + 1}`}
                          </div>
                          <div>
                            <span className="font-bold text-slate-200 text-sm">{enc.doctor_name}</span>
                            <span className="text-[11px] text-slate-400 block">{enc.specialty}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
                          <Clock className="w-3.5 h-3.5 text-teal-400" />
                          <span>{enc.date}</span>
                        </div>
                      </div>

                      {/* Chief Complaint & Diagnosis */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Chief Complaint</span>
                          <p className="text-slate-200 font-medium">{enc.chief_complaint || 'General medical follow-up'}</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                          <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block mb-1">Clinical Diagnosis</span>
                          <p className="text-teal-200 font-bold">{enc.diagnosis_title || 'Routine assessment'}</p>
                        </div>
                      </div>

                      {/* Vitals Ribbon */}
                      {enc.vitals && (
                        <div className="p-3 rounded-2xl bg-slate-950/40 border border-slate-800 flex flex-wrap items-center justify-between text-xs gap-3 text-slate-300">
                          <div>BP: <strong className="text-rose-400 font-mono">{enc.vitals.bp}</strong></div>
                          <div>Pulse: <strong className="text-emerald-400 font-mono">{enc.vitals.pulse}</strong></div>
                          <div>Temp: <strong className="text-amber-400 font-mono">{enc.vitals.temp}</strong></div>
                          <div>SpO2: <strong className="text-teal-400 font-mono">{enc.vitals.spo2}</strong></div>
                          <div>BMI: <strong className="text-indigo-400 font-mono">{enc.vitals.bmi || 'N/A'}</strong></div>
                        </div>
                      )}

                      {/* Treatment Plan */}
                      {enc.treatment_plan && (
                        <div className="text-xs text-slate-300 space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Treatment Plan & Advice</span>
                          <p className="text-slate-300 italic">{enc.treatment_plan}</p>
                        </div>
                      )}

                      {/* Prescriptions Block */}
                      {enc.prescription && enc.prescription.items && enc.prescription.items.length > 0 && (
                        <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/20 space-y-2 text-xs">
                          <div className="flex items-center justify-between text-emerald-300 font-bold">
                            <div className="flex items-center space-x-1.5">
                              <Pill className="w-4 h-4" />
                              <span>Prescription: {enc.prescription.code}</span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                              {enc.prescription.status}
                            </span>
                          </div>

                          <div className="space-y-1.5 pt-1 border-t border-slate-800">
                            {enc.prescription.items.map((med: any, mIdx: number) => (
                              <div key={mIdx} className="flex justify-between items-center text-slate-300 text-[11px]">
                                <span className="font-semibold text-slate-200">• {med.medicine} ({med.dosage})</span>
                                <span className="text-slate-400 font-mono">{med.frequency} • {med.duration}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Lab Orders Block */}
                      {enc.lab_orders && enc.lab_orders.length > 0 && (
                        <div className="p-4 rounded-2xl bg-slate-950/80 border border-cyan-500/20 space-y-2 text-xs">
                          <div className="flex items-center justify-between text-cyan-300 font-bold">
                            <div className="flex items-center space-x-1.5">
                              <FlaskConical className="w-4 h-4" />
                              <span>Diagnostic Laboratory Orders ({enc.lab_orders.length})</span>
                            </div>
                          </div>

                          <div className="space-y-2 pt-1 border-t border-slate-800">
                            {enc.lab_orders.map((lab: any, lIdx: number) => (
                              <div key={lIdx} className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                                <div className="flex justify-between items-center font-semibold text-slate-200">
                                  <span>{lab.test_name} ({lab.sample_type})</span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                                    {lab.status}
                                  </span>
                                </div>
                                {lab.results && lab.results.length > 0 && (
                                  <div className="text-[11px] text-slate-300 space-y-0.5">
                                    {lab.results.map((r: any, rIdx: number) => (
                                      <div key={rIdx} className="flex justify-between">
                                        <span className="text-slate-400">Result:</span>
                                        <span className={`font-mono font-bold ${r.is_abnormal ? 'text-red-400' : 'text-emerald-400'}`}>
                                          {r.value} {r.flags ? `[${r.flags}]` : ''}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  ))}
                </div>
              )}

            </>
          )}

        </div>

      </div>

      {/* New Patient Registration Modal */}
      {showNewPatientModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl glass-panel border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
                  <UserCheck className="w-5 h-5" />
                </div>
                <h3 className="font-heading font-bold text-lg text-slate-100">
                  Register New Patient in Clinical Registry
                </h3>
              </div>
              <button onClick={() => setShowNewPatientModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterPatient} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={newPatientData.first_name}
                    onChange={(e) => setNewPatientData({ ...newPatientData, first_name: e.target.value })}
                    placeholder="e.g. Ramesh"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={newPatientData.last_name}
                    onChange={(e) => setNewPatientData({ ...newPatientData, last_name: e.target.value })}
                    placeholder="e.g. Verma"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={newPatientData.dob}
                    onChange={(e) => setNewPatientData({ ...newPatientData, dob: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Gender</label>
                  <select
                    value={newPatientData.gender}
                    onChange={(e) => setNewPatientData({ ...newPatientData, gender: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Blood Group</label>
                  <select
                    value={newPatientData.blood_group}
                    onChange={(e) => setNewPatientData({ ...newPatientData, blood_group: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  >
                    {['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={newPatientData.phone}
                    onChange={(e) => setNewPatientData({ ...newPatientData, phone: e.target.value })}
                    placeholder="+91-9876543210"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newPatientData.email}
                    onChange={(e) => setNewPatientData({ ...newPatientData, email: e.target.value })}
                    placeholder="patient@example.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Known Drug Allergies</label>
                  <input
                    type="text"
                    value={newPatientData.allergies}
                    onChange={(e) => setNewPatientData({ ...newPatientData, allergies: e.target.value })}
                    placeholder="e.g. Penicillin, Sulfa Drugs, None"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Chronic Medical Conditions</label>
                  <input
                    type="text"
                    value={newPatientData.chronic_conditions}
                    onChange={(e) => setNewPatientData({ ...newPatientData, chronic_conditions: e.target.value })}
                    placeholder="e.g. Hypertension, Type 2 Diabetes"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Insurance Provider</label>
                  <input
                    type="text"
                    value={newPatientData.insurance_provider}
                    onChange={(e) => setNewPatientData({ ...newPatientData, insurance_provider: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Policy / Member ID</label>
                  <input
                    type="text"
                    value={newPatientData.insurance_policy_number}
                    onChange={(e) => setNewPatientData({ ...newPatientData, insurance_policy_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewPatientModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-glow-teal cursor-pointer"
                >
                  Complete Registration
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
