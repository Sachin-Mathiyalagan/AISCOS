import React, { useState, useEffect, useCallback } from 'react';
import { QueueEntry, Doctor, Patient, Appointment } from '../../types';
import { api } from '../../api/client';
import { 
  Users, Clock, Zap, AlertTriangle, CheckCircle2, 
  ArrowRight, PhoneCall, Plus, RefreshCw, UserCheck, ShieldAlert,
  ArrowRightLeft, Play, Calendar, CalendarDays
} from 'lucide-react';

interface LiveQueueBoardProps {
  doctors: Doctor[];
  selectedDoctorId: number;
  onSelectDoctor: (docId: number) => void;
  onStartConsultation?: (queueEntry: QueueEntry) => void;
}

export const LiveQueueBoard: React.FC<LiveQueueBoardProps> = ({
  doctors,
  selectedDoctorId,
  onSelectDoctor,
  onStartConsultation
}) => {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [scheduledAppts, setScheduledAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState<QueueEntry | null>(null);
  const [transferDocId, setTransferDocId] = useState<number>(1);
  const [transferReason, setTransferReason] = useState<string>('Specialist referral');
  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  
  // Check-in form state
  const [selectedPatientId, setSelectedPatientId] = useState<number>(1);
  const [triageLevel, setTriageLevel] = useState<number>(4);
  const [isEmergency, setIsEmergency] = useState<boolean>(false);
  const [chiefComplaint, setChiefComplaint] = useState<string>('');

  const fetchQueue = useCallback(async () => {
    if (!selectedDoctorId) return;
    try {
      setLoading(true);
      const [qData, apptsData] = await Promise.all([
        api.getDoctorQueue(selectedDoctorId).catch(() => []),
        api.getAppointments(selectedDoctorId).catch(() => [])
      ]);
      setQueue(qData);
      setScheduledAppts(apptsData.filter(a => a.status === 'Scheduled'));
    } catch (err) {
      console.error('Queue load error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDoctorId]);

  useEffect(() => {
    fetchQueue();
    api.getPatients().then(setPatientsList).catch(console.error);
    const interval = setInterval(fetchQueue, 4000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const handleCallPatient = async (queueId: number) => {
    try {
      await api.callNextPatient(queueId);
      await fetchQueue();
    } catch (err: any) {
      alert(err.message || 'Failed to call patient');
    }
  };

  const handleStartConsultationSession = async (queueEntry: QueueEntry) => {
    try {
      await api.startConsultation(queueEntry.id);
      await fetchQueue();
      if (onStartConsultation) {
        onStartConsultation({
          ...queueEntry,
          status: 'In-Consultation'
        });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to start consultation');
    }
  };

  const handleCompleteConsultation = async (queueId: number) => {
    try {
      await api.completeConsultation(queueId);
      await fetchQueue();
    } catch (err: any) {
      alert(err.message || 'Failed to complete consultation');
    }
  };

  const handleCheckInAppointment = async (appt: Appointment) => {
    try {
      const entry = await api.checkIn({
        patient_id: appt.patient_id,
        doctor_id: appt.doctor_id,
        appointment_id: appt.id,
        is_emergency: false,
        triage_level: 4,
        chief_complaint: appt.chief_complaint || 'Scheduled consultation'
      });
      alert(`Token ${entry.token_number} issued for ${appt.patient_name}!`);
      await fetchQueue();
    } catch (err: any) {
      alert(err.message || 'Failed to check-in appointment');
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTarget) return;
    try {
      await api.transferQueueEntry(transferTarget.id, transferDocId, transferReason);
      setShowTransferModal(false);
      setTransferTarget(null);
      await fetchQueue();
    } catch (err: any) {
      alert(err.message || 'Transfer failed');
    }
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.checkIn({
        patient_id: selectedPatientId,
        doctor_id: selectedDoctorId,
        is_emergency: isEmergency,
        triage_level: triageLevel,
        chief_complaint: chiefComplaint || 'Outpatient consultation'
      });
      setShowCheckInModal(false);
      setIsEmergency(false);
      setTriageLevel(4);
      setChiefComplaint('');
      await fetchQueue();
    } catch (err: any) {
      alert(err.message || 'Check-in error');
    }
  };

  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId) || doctors[0];
  const inConsultationPatient = queue.find(q => q.status === 'In-Consultation');
  const calledPatient = queue.find(q => q.status === 'Called');
  const activeRoomEntry = inConsultationPatient || calledPatient;
  const waitingPatients = queue.filter(q => q.status === 'Waiting');

  const triageBadgeMap: Record<number, { label: string; color: string; border: string }> = {
    1: { label: 'Triage 1 (Emergency)', color: 'bg-red-500/20 text-red-300', border: 'border-red-500/40' },
    2: { label: 'Triage 2 (Emergent)', color: 'bg-amber-500/20 text-amber-300', border: 'border-amber-500/40' },
    3: { label: 'Triage 3 (Urgent)', color: 'bg-blue-500/20 text-blue-300', border: 'border-blue-500/40' },
    4: { label: 'Triage 4 (Routine)', color: 'bg-emerald-500/20 text-emerald-300', border: 'border-emerald-500/40' },
  };

  return (
    <div className="space-y-6">
      
      {/* Top Controls: Doctor Selector & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl glass-panel shadow-xl">
        <div>
          <h2 className="text-xl font-black font-heading text-slate-100 flex items-center space-x-2.5">
            <Zap className="w-5 h-5 text-teal-400" />
            <span>Smart Hybrid Priority Queue</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Dynamic AI priority re-ranking • Anti-starvation aging • Live token broadcast
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Doctor Switcher */}
          <select
            value={selectedDoctorId}
            onChange={(e) => onSelectDoctor(Number(e.target.value))}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
          >
            {doctors.map(d => (
              <option key={d.id} value={d.id} className="bg-slate-900 text-slate-200">
                {d.full_name} ({d.specialty}) — {d.room_number || 'Room 101'}
              </option>
            ))}
          </select>

          {/* Quick Check-in Button */}
          <button
            onClick={() => setShowCheckInModal(true)}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-glow-teal transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Check-in Patient</span>
          </button>
        </div>
      </div>

      {/* Active Consultation Hero Card */}
      <div className="p-6 rounded-3xl glass-panel border-2 border-teal-500/40 bg-gradient-to-r from-teal-950/40 via-slate-900/70 to-slate-900/50 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wider text-teal-300">
              Consultation Room ({selectedDoctor?.room_number || 'Room 101'})
            </span>
          </div>
          <span className="text-xs text-slate-400 font-medium">Doctor: {selectedDoctor?.full_name} ({selectedDoctor?.specialty})</span>
        </div>

        {activeRoomEntry ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-slate-950 font-black text-2xl flex items-center justify-center shadow-glow-teal font-heading">
                {activeRoomEntry.token_number}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-heading text-xl font-bold text-slate-100">{activeRoomEntry.patient_name}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeRoomEntry.status === 'In-Consultation'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                  }`}>
                    {activeRoomEntry.status === 'Called' ? 'Token Called (Waiting Entry)' : 'In Consultation'}
                  </span>
                </div>
                <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
                  <span>MRN: <strong className="text-slate-300 font-mono">{activeRoomEntry.patient_mrn}</strong></span>
                  <span>•</span>
                  <span>Priority Score: <strong className="text-teal-300">{activeRoomEntry.priority_score.toFixed(1)}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {activeRoomEntry.status === 'Called' && (
                <button
                  onClick={() => handleStartConsultationSession(activeRoomEntry)}
                  className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-black shadow-glow-teal transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Start Consultation & EHR</span>
                </button>
              )}

              {activeRoomEntry.status === 'In-Consultation' && onStartConsultation && (
                <button
                  onClick={() => onStartConsultation(activeRoomEntry)}
                  className="px-4 py-2.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Open Consultation Workspace
                </button>
              )}

              <button
                onClick={() => {
                  setTransferTarget(activeRoomEntry);
                  setShowTransferModal(true);
                }}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                title="Transfer to another doctor"
              >
                <ArrowRightLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleCompleteConsultation(activeRoomEntry.id)}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Finish Consultation</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-slate-400 text-xs space-y-1">
            <p className="font-semibold text-slate-300 text-sm">Consultation Room is Currently Open</p>
            <p>Call the next waiting patient below or check in an appointment to begin the clinical encounter.</p>
          </div>
        )}
      </div>

      {/* Dynamic Ordered Waiting List */}
      <div className="rounded-3xl glass-panel overflow-hidden border border-slate-800/80 shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="w-5 h-5 text-slate-400" />
            <h3 className="font-heading font-bold text-slate-100 text-sm">
              Active Waiting Room ({waitingPatients.length} Patients In Line)
            </h3>
          </div>
          <button
            onClick={fetchQueue}
            className="flex items-center space-x-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh State</span>
          </button>
        </div>

        {waitingPatients.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <UserCheck className="w-8 h-8 mx-auto mb-2 text-slate-500" />
            <p className="font-semibold text-slate-300">No waiting patients in queue for Dr. {selectedDoctor?.full_name}.</p>
            <p className="text-slate-500 mt-1">Check in scheduled patients below or use "Check-in Patient" to issue new tokens.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {waitingPatients.map((entry, index) => {
              const triage = triageBadgeMap[entry.triage_level] || triageBadgeMap[4];
              const isNext = index === 0;

              return (
                <div
                  key={entry.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    entry.is_emergency
                      ? 'bg-red-500/10 border-l-4 border-l-red-500'
                      : isNext
                      ? 'bg-teal-500/5 border-l-4 border-l-teal-500'
                      : 'hover:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-heading font-black text-lg ${
                      isNext
                        ? 'bg-teal-500 text-slate-950 shadow-glow-teal'
                        : 'bg-slate-800/80 text-slate-200 border border-slate-700'
                    }`}>
                      {entry.token_number}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center space-x-2.5">
                        <span className="font-bold text-sm text-slate-100">{entry.patient_name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          {entry.patient_mrn}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${triage.color} ${triage.border}`}>
                          {triage.label}
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 text-xs text-slate-400">
                        <span>Score: <strong className="text-teal-300 font-mono">{entry.priority_score.toFixed(1)}</strong></span>
                        <span>•</span>
                        <span>Position: <strong className="text-slate-200">#{entry.queue_position}</strong></span>
                        {entry.appointment_id && (
                          <>
                            <span>•</span>
                            <span className="text-sky-300 font-medium">Booked Appt</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 self-end sm:self-center">
                    <div className="text-right">
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-200">
                        <Clock className="w-3.5 h-3.5 text-teal-400" />
                        <span>Est. Wait: ~{entry.estimated_wait_minutes} mins</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        90% CI: {entry.confidence_interval_min} - {entry.confidence_interval_max} mins
                      </span>
                    </div>

                    <button
                      onClick={() => handleCallPatient(entry.id)}
                      className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        isNext
                          ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-glow-teal'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      }`}
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>Call Next</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scheduled Online Appointments for this Doctor */}
      <div className="rounded-3xl glass-panel overflow-hidden border border-slate-800/80 shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CalendarDays className="w-5 h-5 text-sky-400" />
            <h3 className="font-heading font-bold text-slate-100 text-sm">
              Today's Scheduled Appointments for Dr. {selectedDoctor?.full_name} ({scheduledAppts.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400">Click to check in & issue live token</span>
        </div>

        {scheduledAppts.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            No upcoming online bookings scheduled for Dr. {selectedDoctor?.full_name}.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {scheduledAppts.map((appt) => (
              <div key={appt.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/30 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2.5">
                    <span className="font-bold text-sm text-slate-200">{appt.patient_name}</span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-sky-300 border border-slate-700">
                      {appt.patient_mrn}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-teal-300">
                      {appt.appointment_code}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 text-slate-400 text-[11px]">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-sky-400" />
                      <span>Slot: <strong className="text-slate-200">{appt.slot_time}</strong> ({appt.appointment_date})</span>
                    </span>
                    {appt.chief_complaint && (
                      <>
                        <span>•</span>
                        <span className="italic">"{appt.chief_complaint}"</span>
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleCheckInAppointment(appt)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-glow-teal flex items-center space-x-1.5 cursor-pointer self-end sm:self-center shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Check-In & Issue Token</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Check-in Modal */}
      {showCheckInModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel border border-slate-700 rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-heading font-bold text-lg text-slate-100 mb-1">
              Patient Check-In & Digital Token Issuance
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Generates dynamic priority token with instant AI waiting-time inference.
            </p>

            <form onSubmit={handleCheckInSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Select Patient</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200 text-xs"
                >
                  {patientsList.map(p => (
                    <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                      {p.first_name} {p.last_name} ({p.mrn}) — Blood: {p.blood_group || 'O+'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Triage Acuity Level</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { level: 1, label: 'Level 1: Emergency (Resuscitation)', color: 'border-red-500/50 text-red-300' },
                    { level: 2, label: 'Level 2: Emergent (Severe)', color: 'border-amber-500/50 text-amber-300' },
                    { level: 3, label: 'Level 3: Urgent (Moderate)', color: 'border-blue-500/50 text-blue-300' },
                    { level: 4, label: 'Level 4: Routine (Standard)', color: 'border-emerald-500/50 text-emerald-300' },
                  ].map(t => (
                    <button
                      type="button"
                      key={t.level}
                      onClick={() => setTriageLevel(t.level)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                        triageLevel === t.level
                          ? 'bg-slate-800 ' + t.color + ' ring-1 ring-teal-500'
                          : 'border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Chief Complaint</label>
                <input
                  type="text"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="E.g., Fever, headache, chest tightness..."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200 text-xs"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="emergency"
                  checked={isEmergency}
                  onChange={(e) => setIsEmergency(e.target.checked)}
                  className="rounded border-slate-700 text-red-500 focus:ring-red-500"
                />
                <label htmlFor="emergency" className="text-xs text-red-400 font-bold cursor-pointer">
                  Emergency Case (Overrides queue to position #1)
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCheckInModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold shadow-glow-teal cursor-pointer"
                >
                  Generate Token
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Patient Modal */}
      {showTransferModal && transferTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel border border-slate-700 rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-heading font-bold text-lg text-slate-100 mb-1">
              Transfer Token {transferTarget.token_number}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Transfer patient <strong className="text-slate-200">{transferTarget.patient_name}</strong> to another physician.
            </p>

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Destination Doctor</label>
                <select
                  value={transferDocId}
                  onChange={(e) => setTransferDocId(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200 text-xs"
                >
                  {doctors.filter(d => d.id !== selectedDoctorId).map(d => (
                    <option key={d.id} value={d.id} className="bg-slate-900 text-slate-200">
                      {d.full_name} ({d.specialty})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Referral Reason</label>
                <input
                  type="text"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="E.g., Specialist cardiology evaluation..."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200 text-xs"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold shadow-glow-teal cursor-pointer"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
