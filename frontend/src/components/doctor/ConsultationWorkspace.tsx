import React, { useState, useEffect, useCallback } from 'react';
import { QueueEntry, Patient, MedicineInventory, LabTest, Encounter, Doctor, Appointment } from '../../types';
import { api } from '../../api/client';
import { 
  Stethoscope, Mic, Sparkles, AlertOctagon, CheckCircle, 
  FileText, Pill, FlaskConical, Plus, Trash2, ShieldAlert,
  Search, ExternalLink, Activity, Printer, Calendar, Clock, CheckCircle2,
  UserCheck, ArrowRight, RefreshCw, Zap
} from 'lucide-react';

interface ConsultationWorkspaceProps {
  activeQueueEntry: QueueEntry | null;
  onFinishConsultation: () => void;
  doctors?: Doctor[];
  selectedDoctorId?: number;
  onSelectDoctor?: (docId: number) => void;
}

export const ConsultationWorkspace: React.FC<ConsultationWorkspaceProps> = ({
  activeQueueEntry: initialActiveQueueEntry,
  onFinishConsultation,
  doctors = [],
  selectedDoctorId = 1,
  onSelectDoctor
}) => {
  const [activeEntry, setActiveEntry] = useState<QueueEntry | null>(initialActiveQueueEntry);
  const [currentDoctorId, setCurrentDoctorId] = useState<number>(selectedDoctorId || 1);
  const [allDoctors, setAllDoctors] = useState<Doctor[]>(doctors);
  
  // Doctor Queue & Scheduled appointments when idle
  const [doctorQueue, setDoctorQueue] = useState<QueueEntry[]>([]);
  const [scheduledAppts, setScheduledAppts] = useState<Appointment[]>([]);
  const [loadingIdleData, setLoadingIdleData] = useState(false);

  // Active Encounter State
  const [patientData, setPatientData] = useState<any>(null);
  const [medicines, setMedicines] = useState<MedicineInventory[]>([]);
  const [labTests, setLabTests] = useState<LabTest[]>([]);
  const [currentEncounter, setCurrentEncounter] = useState<Encounter | null>(null);
  const [loadingEncounter, setLoadingEncounter] = useState(false);
  
  // SOAP Notes State
  const [subjective, setSubjective] = useState('');
  const [objective, setObjective] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [isDictating, setIsDictating] = useState(false);

  // Prescription Items State
  const [prescribedItems, setPrescribedItems] = useState<Array<{
    medicine_id: number;
    medicine_name: string;
    dosage: string;
    frequency: string;
    duration_days: number;
    quantity: number;
    instructions: string;
  }>>([]);

  // Selected Lab Tests
  const [selectedLabTestIds, setSelectedLabTestIds] = useState<number[]>([]);

  // Follow-up state
  const [scheduleFollowUp, setScheduleFollowUp] = useState(true);
  const [followUpDate, setFollowUpDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [followUpReason, setFollowUpReason] = useState('Routine clinical review & vitals check');

  // CDS Alerts State
  const [cdsAlerts, setCdsAlerts] = useState<any[]>([]);
  const [cdsChecking, setCdsChecking] = useState(false);
  const [ragQuery, setRagQuery] = useState('');
  const [ragResults, setRagResults] = useState<any[]>([]);

  // Result summary after completion
  const [completionResult, setCompletionResult] = useState<{
    invoice_number?: string;
    total_billed?: number;
    prescription_id?: number;
  } | null>(null);

  useEffect(() => {
    if (initialActiveQueueEntry) {
      setActiveEntry(initialActiveQueueEntry);
    }
  }, [initialActiveQueueEntry]);

  useEffect(() => {
    if (selectedDoctorId) {
      setCurrentDoctorId(selectedDoctorId);
    }
  }, [selectedDoctorId]);

  // Load idle queue & scheduled appointments for current doctor
  const loadDoctorIdleData = useCallback(async () => {
    try {
      setLoadingIdleData(true);
      const [docs, qEntries, appts] = await Promise.all([
        api.getDoctors().catch(() => []),
        api.getDoctorQueue(currentDoctorId).catch(() => []),
        api.getAppointments(currentDoctorId).catch(() => [])
      ]);
      setAllDoctors(docs);
      setDoctorQueue(qEntries);
      setScheduledAppts(appts.filter(a => a.status === 'Scheduled'));
    } catch (err) {
      console.error('Error loading doctor idle data:', err);
    } finally {
      setLoadingIdleData(false);
    }
  }, [currentDoctorId]);

  useEffect(() => {
    if (!activeEntry) {
      loadDoctorIdleData();
      const interval = setInterval(loadDoctorIdleData, 4000);
      return () => clearInterval(interval);
    }
  }, [activeEntry, loadDoctorIdleData]);

  // Initialize consultation session
  const initConsultationSession = useCallback(async (entry: QueueEntry) => {
    setActiveEntry(entry);
    setCompletionResult(null);
    setLoadingEncounter(true);
    try {
      // 1. Load Patient Timeline
      const pRes = await api.getPatientTimeline(entry.patient_id);
      setPatientData(pRes);
      const p = pRes.patient;
      setSubjective(`Patient presents with: ${entry.appointment_id ? 'Scheduled consultation' : 'Outpatient visit'}. Chronic conditions: ${p.chronic_conditions || 'None'}. Allergies: ${p.allergies || 'None'}.`);
      setObjective('Vitals: BP 124/80 mmHg, Pulse 72 bpm, Temp 98.4°F, SpO2 99%. General condition stable.');
      setAssessment('Acute outpatient evaluation / follow-up');
      setPlan('Prescribed standard therapy, supportive care, and lifestyle instructions.');

      // 2. Create Encounter
      const enc = await api.createEncounter({
        doctor_id: entry.doctor_id,
        patient_id: entry.patient_id,
        appointment_id: entry.appointment_id,
        queue_entry_id: entry.id,
        chief_complaint: entry.appointment_id ? 'Scheduled consultation' : 'Outpatient clinical visit'
      });
      setCurrentEncounter(enc);

      // 3. Load Medicines & Labs
      const [inv, labs] = await Promise.all([
        api.getPharmacyInventory().catch(() => []),
        api.getLabTests().catch(() => [])
      ]);
      setMedicines(inv);
      setLabTests(labs);
    } catch (err) {
      console.error('Failed to start consultation session:', err);
    } finally {
      setLoadingEncounter(false);
    }
  }, []);

  // When activeEntry changes from prop
  useEffect(() => {
    if (activeEntry?.patient_id && !currentEncounter) {
      initConsultationSession(activeEntry);
    }
  }, [activeEntry, currentEncounter, initConsultationSession]);

  // Start consultation from waiting queue
  const handleStartFromQueue = async (qEntry: QueueEntry) => {
    try {
      await api.startConsultation(qEntry.id);
      await initConsultationSession({ ...qEntry, status: 'In-Consultation' });
    } catch (err: any) {
      alert(err.message || 'Failed to start consultation');
    }
  };

  // Start consultation from scheduled appointment
  const handleStartFromAppointment = async (appt: Appointment) => {
    try {
      // 1. Check in appointment to generate queue entry
      const qEntry = await api.checkIn({
        patient_id: appt.patient_id,
        doctor_id: appt.doctor_id,
        appointment_id: appt.id,
        is_emergency: false,
        triage_level: 4,
        chief_complaint: appt.chief_complaint || 'Scheduled consultation'
      });
      // 2. Start consultation
      await api.startConsultation(qEntry.id);
      await initConsultationSession({ ...qEntry, status: 'In-Consultation' });
    } catch (err: any) {
      alert(err.message || 'Failed to check-in and start consultation');
    }
  };

  // Run CDS Check whenever prescribed items change
  const runCdsCheck = useCallback(async () => {
    if (!activeEntry?.patient_id || prescribedItems.length === 0) {
      setCdsAlerts([]);
      return;
    }
    try {
      setCdsChecking(true);
      const res = await api.checkDrugInteractions(
        activeEntry.patient_id,
        prescribedItems.map(i => i.medicine_name)
      );
      setCdsAlerts(res.alerts || []);
    } catch (err) {
      console.error('CDS check error:', err);
    } finally {
      setCdsChecking(false);
    }
  }, [activeEntry, prescribedItems]);

  useEffect(() => {
    runCdsCheck();
  }, [prescribedItems, runCdsCheck]);

  const handleSimulateVoiceDictation = async () => {
    setIsDictating(true);
    const sampleDictation = "Patient complains of mild throat irritation and fever for 2 days. Physical examination shows mild pharyngeal congestion. Prescribing Paracetamol 650mg and Azithromycin 500mg once daily with plenty of fluids.";
    try {
      const draft = await api.speechToSOAP(sampleDictation);
      if (draft.subjective) setSubjective(draft.subjective);
      if (draft.objective) setObjective(draft.objective);
      if (draft.assessment) setAssessment(draft.assessment);
      if (draft.plan) setPlan(draft.plan);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDictating(false);
    }
  };

  const handleAddMedicine = (med: MedicineInventory) => {
    if (prescribedItems.some(p => p.medicine_id === med.medicine_id)) return;
    setPrescribedItems(prev => [
      ...prev,
      {
        medicine_id: med.medicine_id,
        medicine_name: med.name,
        dosage: med.strength ? `1 Unit (${med.strength})` : '1 Unit',
        frequency: 'OD (Once Daily)',
        duration_days: 5,
        quantity: 5,
        instructions: 'After meals with water'
      }
    ]);
  };

  const handleRemoveMedicine = (index: number) => {
    setPrescribedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleToggleLabTest = (testId: number) => {
    setSelectedLabTestIds(prev => 
      prev.includes(testId) ? prev.filter(id => id !== testId) : [...prev, testId]
    );
  };

  const handleQueryRAG = async () => {
    if (!ragQuery.trim()) return;
    try {
      const res = await api.queryGuidelinesRAG(ragQuery);
      setRagResults(res.evidence_sources || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFinalizeEncounter = async () => {
    if (!activeEntry || !currentEncounter) {
      alert('Encounter not initialized.');
      return;
    }
    try {
      const encId = currentEncounter.id;

      // 1. Update Encounter diagnosis and plan
      await api.updateEncounter(encId, {
        diagnosis_title: assessment,
        treatment_plan: plan
      });

      // 2. Save SOAP Notes
      await api.saveClinicalNotes({
        encounter_id: encId,
        subjective,
        objective,
        assessment,
        plan,
        is_signed: true
      });

      // 3. Create Prescription if any items
      let createdRxId: number | undefined;
      if (prescribedItems.length > 0) {
        const rx = await api.createPrescription({
          encounter_id: encId,
          patient_id: activeEntry.patient_id,
          doctor_id: activeEntry.doctor_id,
          notes: plan,
          items: prescribedItems
        });
        createdRxId = rx.id;
      }

      // 4. Order Lab Tests if selected
      for (const testId of selectedLabTestIds) {
        await api.orderLabTest({
          encounter_id: encId,
          patient_id: activeEntry.patient_id,
          doctor_id: activeEntry.doctor_id,
          test_id: testId,
          urgency: 'Routine',
          clinical_indication: assessment
        }).catch(err => console.error('Lab order error:', err));
      }

      // 5. Schedule Follow-up if toggled
      if (scheduleFollowUp && followUpDate) {
        await api.createFollowUp({
          patient_id: activeEntry.patient_id,
          doctor_id: activeEntry.doctor_id,
          encounter_id: encId,
          follow_up_date: followUpDate,
          reason: followUpReason,
          instructions: plan
        }).catch(console.error);
      }

      // 6. Complete Encounter (Atomic: generates invoice, closes queue entry)
      const completeRes = await api.completeEncounter(encId);

      setCompletionResult({
        invoice_number: completeRes.invoice_number,
        total_billed: completeRes.total_billed,
        prescription_id: createdRxId
      });

    } catch (err: any) {
      alert(err.message || 'Error finalizing encounter');
    }
  };

  const handleResetConsultation = () => {
    setActiveEntry(null);
    setCurrentEncounter(null);
    setCompletionResult(null);
    setPrescribedItems([]);
    setSelectedLabTestIds([]);
    onFinishConsultation();
  };

  const currentDoctor = allDoctors.find(d => d.id === currentDoctorId) || allDoctors[0];

  // If no active consultation in session, show Doctor's Live Queue and Scheduled Bookings
  if (!activeEntry) {
    return (
      <div className="space-y-6">
        
        {/* Doctor Header & Selector */}
        <div className="p-6 rounded-3xl glass-panel border border-teal-500/30 bg-gradient-to-r from-teal-950/40 via-slate-900/80 to-slate-900/40 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-500/40 shadow-glow-teal">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="font-heading text-xl sm:text-2xl font-bold text-slate-100">
                    Doctor Clinical Workstation
                  </h2>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Live Station
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {currentDoctor ? `Dr. ${currentDoctor.full_name} (${currentDoctor.specialty} • ${currentDoctor.room_number || 'Room 101'})` : 'Select Doctor'}
                </p>
              </div>
            </div>

            {/* Doctor Selector Dropdown */}
            <div className="flex items-center space-x-2.5 bg-slate-950/80 px-4 py-2.5 rounded-2xl border border-slate-800 text-xs">
              <span className="text-slate-400 font-medium">Doctor:</span>
              <select
                value={currentDoctorId}
                onChange={(e) => {
                  const newId = Number(e.target.value);
                  setCurrentDoctorId(newId);
                  if (onSelectDoctor) onSelectDoctor(newId);
                }}
                className="bg-transparent text-teal-300 font-bold focus:outline-none cursor-pointer text-xs"
              >
                {allDoctors.map((d) => (
                  <option key={d.id} value={d.id} className="bg-slate-900 text-slate-200">
                    Dr. {d.full_name} — {d.specialty}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Grid: Live Waiting Queue & Today's Scheduled Appointments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* 1. Live Waiting Queue */}
          <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-teal-400" />
                <h3 className="font-heading font-bold text-slate-100 text-base">
                  Live Waiting Queue ({doctorQueue.filter(q => q.status === 'Waiting' || q.status === 'Called').length})
                </h3>
              </div>
              <button 
                onClick={loadDoctorIdleData}
                className="text-slate-400 hover:text-teal-300 text-xs flex items-center space-x-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingIdleData ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {doctorQueue.filter(q => q.status === 'Waiting' || q.status === 'Called').length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs space-y-1">
                <UserCheck className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p>No waiting tokens currently in queue for this doctor.</p>
                <p className="text-[11px] text-slate-600">Patients will appear here once checked in.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {doctorQueue.filter(q => q.status === 'Waiting' || q.status === 'Called').map((q) => (
                  <div 
                    key={q.id}
                    className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-teal-500/40 transition-all flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-xl bg-teal-500/20 text-teal-300 font-heading font-black text-lg flex items-center justify-center border border-teal-500/30">
                        {q.token_number}
                      </div>
                      <div>
                        <div className="font-bold text-slate-200 text-sm">{q.patient_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{q.patient_mrn}</div>
                        <span className="text-[10px] text-teal-400">ETA: ~{q.estimated_wait_minutes} min</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartFromQueue(q)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-glow-teal flex items-center space-x-1.5 cursor-pointer shrink-0"
                    >
                      <span>Start Consultation</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Today's Scheduled Appointments */}
          <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-sky-400" />
                <h3 className="font-heading font-bold text-slate-100 text-base">
                  Scheduled Bookings ({scheduledAppts.length})
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">Click to check-in & consult</span>
            </div>

            {scheduledAppts.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs space-y-1">
                <Calendar className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p>No upcoming online appointments booked for Dr. {currentDoctor?.full_name || 'Doctor'}.</p>
                <p className="text-[11px] text-slate-600">When patients book online, they appear here instantly.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {scheduledAppts.map((appt) => (
                  <div 
                    key={appt.id}
                    className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 transition-all flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-200 text-sm">{appt.patient_name}</span>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-sky-300 border border-slate-700">
                          {appt.patient_mrn}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-sky-400" />
                        <span>Slot: <strong className="text-slate-200">{appt.slot_time}</strong> ({appt.appointment_date})</span>
                      </div>
                      {appt.chief_complaint && (
                        <p className="text-[11px] text-slate-400 italic line-clamp-1">"{appt.chief_complaint}"</p>
                      )}
                    </div>

                    <button
                      onClick={() => handleStartFromAppointment(appt)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-glow-teal flex items-center space-x-1.5 cursor-pointer shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Consult Patient</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    );
  }

  const patient = patientData?.patient;

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Patient Demographics & Encounter Status */}
      <div className="p-6 rounded-3xl glass-panel border border-teal-500/30 bg-gradient-to-r from-slate-900 via-slate-900/90 to-teal-950/40 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/20 text-teal-300 font-heading font-black text-2xl flex items-center justify-center border border-teal-500/40 shadow-glow-teal">
              {activeEntry.token_number}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-heading text-2xl font-bold text-slate-100">
                  {patient?.first_name ? `${patient.first_name} ${patient.last_name}` : activeEntry.patient_name}
                </h2>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-teal-300 border border-slate-700">
                  {patient?.mrn || activeEntry.patient_mrn}
                </span>
                {currentEncounter && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20">
                    {currentEncounter.encounter_code}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                <span>Blood: <strong className="text-slate-200">{patient?.blood_group || 'O+'}</strong></span>
                <span>•</span>
                <span>Gender: <strong className="text-slate-200">{patient?.gender || 'Male'}</strong></span>
                <span>•</span>
                <span>Chronic Conditions: <strong className="text-amber-300">{patient?.chronic_conditions || 'None'}</strong></span>
              </div>
            </div>
          </div>

          {/* Allergy Callout */}
          <div className="flex items-center space-x-3 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30">
            <AlertOctagon className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-red-400">Known Drug Allergies</div>
              <div className="text-xs font-bold text-red-200">{patient?.allergies || 'None documented'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Completion Banner if encounter was finalized */}
      {completionResult && (
        <div className="p-6 rounded-3xl glass-panel border-2 border-emerald-500/50 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 shadow-2xl space-y-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-slate-100">
                  Consultation Successfully Finalized!
                </h3>
                <p className="text-xs text-slate-400">
                  Encounter closed • Consolidated Invoice generated • Prescription dispatched to Pharmacy
                </p>
              </div>
            </div>
            <button
              onClick={handleResetConsultation}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-glow-teal cursor-pointer"
            >
              Return to Doctor Queue
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Invoice Number</span>
              <span className="font-mono font-bold text-teal-300 text-sm">{completionResult.invoice_number}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Total Billed Amount</span>
              <span className="font-mono font-bold text-slate-100 text-sm">${completionResult.total_billed?.toFixed(2)}</span>
            </div>
            {completionResult.prescription_id && (
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[11px]">Prescription PDF</span>
                  <span className="font-semibold text-teal-300">Ready to print</span>
                </div>
                <a
                  href={api.getPrescriptionPdfUrl(completionResult.prescription_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-[11px] font-bold flex items-center space-x-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Grid: SOAP Notes & CDS Assistant */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (7 cols): SOAP Clinical Documentation */}
        <div className="lg:col-span-7 space-y-6">
          
          <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-teal-400" />
                <h3 className="font-heading font-bold text-slate-100 text-base">Structured SOAP Clinical Notes</h3>
              </div>

              {/* AI Voice-to-SOAP Trigger */}
              <button
                type="button"
                onClick={handleSimulateVoiceDictation}
                disabled={isDictating}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-bold transition-all cursor-pointer"
              >
                <Mic className={`w-3.5 h-3.5 ${isDictating ? 'text-red-400 animate-pulse' : 'text-teal-400'}`} />
                <span>{isDictating ? 'AI Dictating & Structuring...' : 'AI Voice-to-SOAP'}</span>
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-teal-400 uppercase tracking-wider text-[11px] mb-1">
                  Subjective (Symptoms & History)
                </label>
                <textarea
                  rows={2}
                  value={subjective}
                  onChange={(e) => setSubjective(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-xs focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block font-bold text-teal-400 uppercase tracking-wider text-[11px] mb-1">
                  Objective (Vitals & Physical Exam)
                </label>
                <textarea
                  rows={2}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-xs focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block font-bold text-teal-400 uppercase tracking-wider text-[11px] mb-1">
                  Assessment & Diagnosis
                </label>
                <input
                  type="text"
                  value={assessment}
                  onChange={(e) => setAssessment(e.target.value)}
                  placeholder="E.g., Acute Upper Respiratory Tract Infection"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-xs focus:border-teal-500 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-teal-400 uppercase tracking-wider text-[11px] mb-1">
                  Plan & Advice
                </label>
                <textarea
                  rows={2}
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-xs focus:border-teal-500"
                />
              </div>
            </div>
          </div>

          {/* E-Prescription Medication Writer */}
          <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Pill className="w-5 h-5 text-emerald-400" />
                <h3 className="font-heading font-bold text-slate-100 text-base">
                  E-Prescription Medications ({prescribedItems.length})
                </h3>
              </div>
            </div>

            {/* Quick Medicine Picker from FEFO Inventory */}
            <div className="space-y-2 text-xs">
              <label className="text-slate-400 text-[11px]">Click to add medication from pharmacy catalog:</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                {medicines.slice(0, 10).map((med) => (
                  <button
                    key={med.medicine_id}
                    type="button"
                    onClick={() => handleAddMedicine(med)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-teal-950/40 border border-slate-700 hover:border-teal-500/50 text-slate-200 text-[11px] font-medium flex items-center space-x-1 cursor-pointer transition-all"
                  >
                    <Plus className="w-3 h-3 text-teal-400" />
                    <span>{med.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Prescribed Items Table */}
            {prescribedItems.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                {prescribedItems.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-slate-200">{item.medicine_name}</div>
                      <div className="text-[11px] text-slate-400">{item.dosage} • {item.frequency} ({item.duration_days} days)</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveMedicine(idx)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Diagnostic Laboratory Orders */}
          <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <FlaskConical className="w-5 h-5 text-cyan-400" />
                <h3 className="font-heading font-bold text-slate-100 text-base">
                  Diagnostic Lab Orders ({selectedLabTestIds.length} selected)
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {labTests.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleToggleLabTest(t.id)}
                  className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    selectedLabTestIds.includes(t.id)
                      ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-xs">{t.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">${t.price.toFixed(2)}</div>
                  </div>
                  {selectedLabTestIds.includes(t.id) && (
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column (5 cols): CDS Assistant, Guidelines RAG, & Encounter Finalizer */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Real-time Clinical Decision Support (CDS) Alerts */}
          <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <h3 className="font-heading font-bold text-slate-100 text-base">
                Clinical Decision Support (CDS)
              </h3>
            </div>

            {cdsChecking ? (
              <div className="p-4 text-center text-teal-400 text-xs animate-pulse">
                Evaluating drug-drug interactions & allergy conflicts...
              </div>
            ) : cdsAlerts.length === 0 ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2.5">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>No drug-drug or allergy conflicts detected for selected medications.</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {cdsAlerts.map((alert, i) => (
                  <div key={i} className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs space-y-1">
                    <div className="font-bold text-red-300 flex items-center space-x-1.5">
                      <AlertOctagon className="w-4 h-4 text-red-400" />
                      <span>{alert.title || 'Clinical Safety Warning'}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">{alert.message || alert.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evidence Guidelines Medical Vector RAG */}
          <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4 shadow-xl text-xs">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
              <Sparkles className="w-5 h-5 text-teal-400" />
              <h3 className="font-heading font-bold text-slate-100 text-base">
                Clinical Guidelines RAG
              </h3>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={ragQuery}
                onChange={(e) => setRagQuery(e.target.value)}
                placeholder="Query clinical guidelines..."
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-xs"
              />
              <button
                type="button"
                onClick={handleQueryRAG}
                className="px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-glow-teal cursor-pointer"
              >
                Search
              </button>
            </div>

            {ragResults.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {ragResults.map((r, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] space-y-1">
                    <div className="font-bold text-teal-300">{r.title || 'Guideline Reference'}</div>
                    <p className="text-slate-300">{r.text || r.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Finalizer */}
          <div className="p-6 rounded-3xl glass-panel border border-teal-500/40 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/50 space-y-4 shadow-2xl">
            <h3 className="font-heading font-bold text-slate-100 text-base">
              Finalize Clinical Encounter
            </h3>

            <div className="space-y-2 text-xs">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleFollowUp}
                  onChange={(e) => setScheduleFollowUp(e.target.checked)}
                  className="rounded border-slate-700 text-teal-500 focus:ring-teal-500"
                />
                <span className="text-slate-300 font-semibold">Schedule Follow-up Review</span>
              </label>

              {scheduleFollowUp && (
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-xs"
                />
              )}
            </div>

            <button
              type="button"
              onClick={handleFinalizeEncounter}
              disabled={!currentEncounter || !!completionResult}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-sm shadow-glow-teal flex items-center justify-center space-x-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle className="w-5 h-5" />
              <span>Complete & Finalize Consultation</span>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
