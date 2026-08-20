import React, { useState, useEffect, useCallback } from 'react';
import { Patient, Appointment, Prescription, Invoice, FollowUp, Doctor } from '../../types';
import { api } from '../../api/client';
import { 
  UserCheck, Clock, Calendar, Pill, FlaskConical, Receipt, 
  CreditCard, QrCode, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck,
  Printer, RefreshCw, X, Plus, Stethoscope, UserPlus, CalendarDays, Check
} from 'lucide-react';

interface PatientPortalProps {
  patientId?: number;
  onSelectPatient?: (id: number) => void;
}

export const PatientPortal: React.FC<PatientPortalProps> = ({ patientId = 1, onSelectPatient }) => {
  const [activePatientId, setActivePatientId] = useState<number>(patientId);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [labReports, setLabReports] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [activeToken, setActiveToken] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Payment Modal State
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('TEST_PAYMENT');

  // Book Appointment Modal State
  const [showBookModal, setShowBookModal] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number>(1);
  const [apptDate, setApptDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [slotTime, setSlotTime] = useState<string>('09:00');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [complaint, setComplaint] = useState<string>('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState<string | null>(null);

  // Register Fresh Patient Modal State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regDob, setRegDob] = useState('1995-05-20');
  const [regGender, setRegGender] = useState('Male');
  const [regPhone, setRegPhone] = useState('+1-555-019-2834');
  const [regEmail, setRegEmail] = useState('');
  const [regBloodGroup, setRegBloodGroup] = useState('O+');
  const [regAllergies, setRegAllergies] = useState('None');
  const [regConditions, setRegConditions] = useState('None');
  const [regLoading, setRegLoading] = useState(false);

  useEffect(() => {
    setActivePatientId(patientId);
  }, [patientId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [timelineData, rxList, invList, activeQueueRes, followList, labs, appts, docsList, patsList] = await Promise.all([
        api.getPatientTimeline(activePatientId).catch(() => ({ patient: null, timeline: [] })),
        api.getPatientPrescriptions(activePatientId).catch(() => []),
        api.getInvoices(activePatientId).catch(() => []),
        api.getPatientActiveQueue(activePatientId).catch(() => ({ has_active_token: false, active_entry: null })),
        api.getPatientFollowUps(activePatientId).catch(() => []),
        api.getPatientLabReports(activePatientId).catch(() => []),
        api.getAppointments(undefined, activePatientId).catch(() => []),
        api.getDoctors().catch(() => []),
        api.getPatients().catch(() => [])
      ]);

      if (timelineData?.patient) {
        setPatient(timelineData.patient);
        setTimeline(timelineData.timeline || []);
      }
      setPrescriptions(rxList);
      setInvoices(invList);
      setFollowUps(followList);
      setLabReports(labs);
      setAppointments(appts);
      setDoctors(docsList);
      setAllPatients(patsList);

      if (docsList.length > 0 && !selectedDoctorId) {
        setSelectedDoctorId(docsList[0].id);
      }

      if (activeQueueRes.has_active_token && activeQueueRes.active_entry) {
        setActiveToken(activeQueueRes.active_entry);
      } else {
        setActiveToken(null);
      }
    } catch (err) {
      console.error('Patient portal load error:', err);
    } finally {
      setLoading(false);
    }
  }, [activePatientId, selectedDoctorId]);

  // Cleanly switch patient
  const handleSwitchPatient = (newId: number) => {
    setActivePatientId(newId);
    setPatient(null);
    setPrescriptions([]);
    setInvoices([]);
    setAppointments([]);
    setFollowUps([]);
    setLabReports([]);
    setActiveToken(null);
    if (onSelectPatient) {
      onSelectPatient(newId);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Fetch available slots when doctor or date changes
  const fetchAvailableSlots = useCallback(async () => {
    if (!selectedDoctorId || !apptDate) return;
    try {
      setSlotsLoading(true);
      const data = await api.getAvailableSlots(selectedDoctorId, apptDate);
      setAvailableSlots(data.available_slots || []);
      if (data.available_slots && data.available_slots.length > 0) {
        setSlotTime(data.available_slots[0]);
      } else {
        setSlotTime('');
      }
    } catch (err) {
      console.error('Failed to load slots:', err);
    } finally {
      setSlotsLoading(false);
    }
  }, [selectedDoctorId, apptDate]);

  useEffect(() => {
    if (showBookModal) {
      fetchAvailableSlots();
    }
  }, [showBookModal, fetchAvailableSlots]);

  // Handle Online Appointment Booking Submit
  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotTime) {
      alert('Please select an available time slot.');
      return;
    }
    try {
      setBookingLoading(true);
      const newAppt = await api.bookAppointment({
        doctor_id: selectedDoctorId,
        patient_id: activePatientId,
        appointment_date: apptDate,
        slot_time: slotTime,
        appointment_type: 'Routine',
        chief_complaint: complaint || 'Online consultation booking'
      });
      setBookingSuccessMsg(`Appointment confirmed! Code: ${newAppt.appointment_code} for ${newAppt.appointment_date} at ${newAppt.slot_time}`);
      setComplaint('');
      await loadData();
      setTimeout(() => {
        setBookingSuccessMsg(null);
        setShowBookModal(false);
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to book appointment');
    } finally {
      setBookingLoading(false);
    }
  };

  // Handle Register Fresh Patient Submit
  const handleRegisterFreshPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFirstName.trim() || !regLastName.trim()) {
      alert('Please enter first and last name.');
      return;
    }
    try {
      setRegLoading(true);
      const newPat = await api.createPatient({
        first_name: regFirstName.trim(),
        last_name: regLastName.trim(),
        dob: regDob,
        gender: regGender,
        phone: regPhone,
        email: regEmail || `${regFirstName.toLowerCase()}.${regLastName.toLowerCase()}@example.com`,
        blood_group: regBloodGroup,
        allergies: regAllergies,
        chronic_conditions: regConditions
      });
      alert(`Fresh Patient Registered! MRN: ${newPat.mrn}. Switching to their health portal now.`);
      setShowRegisterModal(false);
      handleSwitchPatient(newPat.id);
      setRegFirstName('');
      setRegLastName('');
      setRegEmail('');
    } catch (err: any) {
      alert(err.message || 'Failed to register patient');
    } finally {
      setRegLoading(false);
    }
  };

  // 1-Click Self Check-in from Scheduled Appointment
  const handleSelfCheckIn = async (appt: Appointment) => {
    try {
      await api.checkIn({
        patient_id: activePatientId,
        doctor_id: appt.doctor_id,
        appointment_id: appt.id,
        is_emergency: false,
        triage_level: 4,
        chief_complaint: appt.chief_complaint || 'Self-check-in for scheduled appointment'
      });
      alert(`Check-in successful! Your digital token has been issued for Dr. ${appt.doctor_name}.`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Check-in failed');
    }
  };

  const handlePayInvoice = async () => {
    if (!payingInvoice) return;
    try {
      await api.recordPayment(payingInvoice.id, payingInvoice.total_amount, paymentMethod);
      alert(`Payment of $${payingInvoice.total_amount.toFixed(2)} via ${paymentMethod} successful! Receipt recorded in database.`);
      setPayingInvoice(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Payment failed');
    }
  };

  const statusBadgeMap: Record<string, string> = {
    'Paid': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    'Unpaid': 'bg-red-500/20 text-red-300 border-red-500/30',
    'Partially-Paid': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  };

  return (
    <div className="space-y-6">
      
      {/* Welcome & Action Header */}
      <div className="p-6 rounded-3xl glass-panel border border-teal-500/30 bg-gradient-to-r from-teal-950/50 via-slate-900/80 to-slate-900/50 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-slate-100">
                {patient ? `${patient.first_name} ${patient.last_name}` : 'Loading Patient Record...'}
              </h2>
              {patient?.mrn && (
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  {patient.mrn}
                </span>
              )}
              {patient?.blood_group && (
                <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {patient.blood_group}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Longitudinal Electronic Health Record • Online Consultation Booking • Digital Queue Telemetry
            </p>
          </div>

          {/* Quick Actions: Book Online + Register Fresh Patient */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowBookModal(true)}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-glow-teal flex items-center space-x-2 transition-all cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              <span>Book Online Appointment</span>
            </button>

            <button
              type="button"
              onClick={() => setShowRegisterModal(true)}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center space-x-1.5 transition-all cursor-pointer"
              title="Create a fresh patient with clean history"
            >
              <UserPlus className="w-4 h-4 text-teal-400" />
              <span>Register Fresh Patient</span>
            </button>

            {/* Quick Switch Patient Dropdown (Lists all patients with live data) */}
            <div className="flex items-center space-x-2 bg-slate-950/80 px-3 py-2 rounded-2xl border border-slate-800 text-xs">
              <span className="text-slate-400 text-[11px]">Patient:</span>
              <select
                value={activePatientId}
                onChange={(e) => handleSwitchPatient(Number(e.target.value))}
                className="bg-transparent text-teal-300 font-semibold focus:outline-none cursor-pointer text-xs max-w-[200px]"
              >
                {allPatients.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                    {p.first_name} {p.last_name} ({p.mrn})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Live Digital Token Hero Card */}
      {activeToken ? (
        <div className="p-6 rounded-3xl glass-panel border-2 border-teal-500/50 bg-gradient-to-br from-teal-950/50 via-slate-900/80 to-slate-950 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-black uppercase tracking-wider text-teal-300">
                Active Consultation Token
              </span>
            </div>
            <span className="text-xs font-bold text-slate-300">Dr. {activeToken.doctor_name} ({activeToken.doctor_specialty})</span>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Token Badge */}
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 font-black text-3xl flex items-center justify-center shadow-glow-teal font-heading">
                {activeToken.token_number}
              </div>
              <div>
                <div className="text-xs text-slate-400">Assigned Room</div>
                <div className="font-heading text-lg font-bold text-slate-100">{activeToken.room_number || 'Room 101'}</div>
                <span className={`text-[11px] font-bold ${
                  activeToken.status === 'Called' ? 'text-amber-400 animate-pulse' : 'text-emerald-400'
                }`}>
                  Status: {activeToken.status === 'Called' ? 'TOKEN CALLED — PROCEED TO ROOM' : activeToken.status}
                </span>
              </div>
            </div>

            {/* Position & ETA */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-around text-center">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Patients Ahead</div>
                <div className="font-heading text-2xl font-bold text-slate-100">{activeToken.patients_ahead}</div>
              </div>
              <div className="w-px h-8 bg-slate-800" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">AI Estimated Wait</div>
                <div className="font-heading text-2xl font-bold text-teal-300">~{activeToken.estimated_wait_minutes} min</div>
              </div>
            </div>

            {/* Telemetry Advice */}
            <div className="text-xs text-slate-300 space-y-1 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
              <div className="font-bold text-teal-400">Queue Telemetry Notice:</div>
              <p>Your token priority is dynamically adjusted using ML regressors. Please remain seated near {activeToken.room_number || 'the consultation room'}.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-2xl glass-panel border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center space-x-3 text-slate-400">
            <Clock className="w-5 h-5 text-teal-400 shrink-0" />
            <span>You currently do not have an active queue token in the waiting room. Book a new appointment or self-check-in below.</span>
          </div>
          <button
            onClick={() => setShowBookModal(true)}
            className="px-4 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 font-bold whitespace-nowrap cursor-pointer"
          >
            + Book Appointment
          </button>
        </div>
      )}

      {/* Scheduled Online Appointments Card */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <CalendarDays className="w-5 h-5 text-teal-400" />
            <h3 className="font-heading font-bold text-slate-100 text-base">
              Online Bookings & Scheduled Appointments ({appointments.length})
            </h3>
          </div>
          <button
            onClick={() => setShowBookModal(true)}
            className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center space-x-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Book New Slot</span>
          </button>
        </div>

        {appointments.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            No upcoming appointments scheduled for this patient. Click "Book Online Appointment" to reserve a doctor's slot.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {appointments.map((appt) => (
              <div key={appt.id} className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-teal-500/40 transition-all space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-teal-300 text-[11px]">{appt.appointment_code}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    appt.status === 'Scheduled' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' :
                    appt.status === 'Checked-In' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {appt.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="font-bold text-slate-200 text-sm">{appt.doctor_name}</div>
                  <div className="text-[11px] text-teal-400">{appt.doctor_specialty}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-[11px]">
                  <div className="flex items-center space-x-1.5 text-slate-300 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{appt.appointment_date}</span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-teal-300 font-bold font-mono">
                    <Clock className="w-3.5 h-3.5 text-teal-400" />
                    <span>{appt.slot_time}</span>
                  </div>
                </div>

                {appt.chief_complaint && (
                  <p className="text-slate-400 text-[11px] italic line-clamp-1">"{appt.chief_complaint}"</p>
                )}

                {/* Self Check-in Trigger */}
                {appt.status === 'Scheduled' && !activeToken && (
                  <button
                    onClick={() => handleSelfCheckIn(appt)}
                    className="w-full py-2 rounded-xl bg-gradient-to-r from-teal-500/20 to-emerald-500/20 hover:from-teal-500/30 hover:to-emerald-500/30 border border-teal-500/40 text-teal-300 font-bold text-[11px] flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                    <span>Check-In for Live Token</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grid: E-Prescriptions & Diagnostic Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Digital E-Prescriptions */}
        <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Pill className="w-5 h-5 text-emerald-400" />
              <h3 className="font-heading font-bold text-slate-100 text-base">Digital Prescriptions ({prescriptions.length})</h3>
            </div>
          </div>

          {prescriptions.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">No active prescriptions on file.</div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {prescriptions.map((rx) => (
                <div key={rx.id} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-teal-300">{rx.prescription_code}</span>
                      <span className="text-slate-400 text-[11px] block">{rx.doctor_name} ({rx.doctor_specialty})</span>
                    </div>
                    <a
                      href={api.getPrescriptionPdfUrl(rx.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-[11px] font-bold"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print PDF</span>
                    </a>
                  </div>

                  <div className="space-y-1 pt-1 border-t border-slate-800">
                    {rx.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-slate-300">
                        <span className="font-semibold">{item.medicine_name}</span>
                        <span className="text-[11px] text-slate-400">{item.dosage} • {item.frequency} ({item.duration_days || 5}d)</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Diagnostic Lab Reports */}
        <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <FlaskConical className="w-5 h-5 text-cyan-400" />
              <h3 className="font-heading font-bold text-slate-100 text-base">Diagnostic Laboratory Reports</h3>
            </div>
          </div>

          {labReports.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">No laboratory test reports ordered.</div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {labReports.map((lab, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-200">{lab.test_name}</span>
                      <span className="text-slate-500 text-[10px] font-mono block">{lab.order_number} • {lab.ordered_at}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      lab.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {lab.status}
                    </span>
                  </div>

                  {lab.results && lab.results.length > 0 && (
                    <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                      {lab.results.map((r: any, rIdx: number) => (
                        <div key={rIdx} className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400">Result Value:</span>
                          <span className={`font-mono font-bold ${r.is_abnormal ? 'text-red-400' : 'text-emerald-400'}`}>
                            {r.value} {r.unit} {r.flags ? `[${r.flags}]` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Grid: Billing Ledger & Upcoming Follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Billing & Settlement */}
        <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Receipt className="w-5 h-5 text-indigo-400" />
              <h3 className="font-heading font-bold text-slate-100 text-base">Invoices & Billing Ledger</h3>
            </div>
          </div>

          {invoices.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">No invoices on file.</div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {invoices.map((inv) => (
                <div key={inv.id} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-teal-300">{inv.invoice_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadgeMap[inv.payment_status] || 'bg-slate-800'}`}>
                        {inv.payment_status}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">{inv.created_at}</span>
                  </div>

                  <div className="text-right flex items-center space-x-3">
                    <div>
                      <div className="font-mono font-bold text-slate-100 text-sm">${inv.total_amount.toFixed(2)}</div>
                      {inv.paid_amount > 0 && (
                        <div className="text-[10px] text-emerald-400 font-mono">Paid: ${inv.paid_amount.toFixed(2)}</div>
                      )}
                    </div>

                    {inv.payment_status !== 'Paid' && (
                      <button
                        onClick={() => setPayingInvoice(inv)}
                        className="px-3.5 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-glow-teal cursor-pointer"
                      >
                        Settle
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scheduled Follow-ups */}
        <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <h3 className="font-heading font-bold text-slate-100 text-base">Scheduled Follow-up Reviews</h3>
            </div>
          </div>

          {followUps.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">No upcoming follow-ups scheduled.</div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {followUps.map((f) => (
                <div key={f.id} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-bold text-slate-200">Date: {f.follow_up_date}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-bold">
                      {f.status}
                    </span>
                  </div>
                  <p className="text-slate-300">{f.reason || 'Routine follow-up'}</p>
                  <div className="text-[11px] text-slate-500 italic">Dr. {f.doctor_name || 'Physician'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Online Appointment Booking Modal */}
      {showBookModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel border border-teal-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 bg-slate-900/95 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-lg text-slate-100">Book Online Consultation</h3>
                  <p className="text-[11px] text-slate-400">Select doctor, date & available time slot</p>
                </div>
              </div>
              <button 
                onClick={() => setShowBookModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {bookingSuccessMsg ? (
              <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center space-x-3 text-emerald-200 text-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="font-semibold">{bookingSuccessMsg}</span>
              </div>
            ) : (
              <form onSubmit={handleBookSubmit} className="space-y-4 text-xs">
                {/* Doctor Selection */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold flex items-center space-x-1.5">
                    <Stethoscope className="w-3.5 h-3.5 text-teal-400" />
                    <span>Select Specialist Doctor</span>
                  </label>
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-100 focus:outline-none focus:border-teal-500"
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name} — {d.specialty} (${d.consultation_fee || 50})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Appointment Date */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-400" />
                    <span>Appointment Date</span>
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={apptDate}
                    onChange={(e) => setApptDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                </div>

                {/* Available Slots */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 font-semibold flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-teal-400" />
                      <span>Available Time Slots</span>
                    </label>
                    {slotsLoading && <span className="text-[10px] text-teal-400 animate-pulse">Checking schedule...</span>}
                  </div>

                  {availableSlots.length === 0 && !slotsLoading ? (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-[11px]">
                      No open slots available for this doctor on {apptDate}. Please select another date.
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-36 overflow-y-auto pr-1">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSlotTime(slot)}
                          className={`py-2 px-1 rounded-xl text-center font-mono font-bold text-xs border transition-all cursor-pointer ${
                            slotTime === slot
                              ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-glow-teal'
                              : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300 border-slate-800'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chief Complaint */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Chief Complaint / Symptoms</label>
                  <textarea
                    rows={2}
                    value={complaint}
                    onChange={(e) => setComplaint(e.target.value)}
                    placeholder="E.g., Mild headache, routine checkup, palpitations..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 text-xs"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowBookModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bookingLoading || !slotTime}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold shadow-glow-teal disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                  >
                    {bookingLoading ? (
                      <span>Reserving...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Confirm Appointment</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Fresh Patient Self-Registration Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel border border-teal-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 bg-slate-900/95 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-lg text-slate-100">Register Fresh Patient Profile</h3>
                  <p className="text-[11px] text-slate-400">Creates a clean digital health record & unique MRN</p>
                </div>
              </div>
              <button 
                onClick={() => setShowRegisterModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterFreshPatient} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">First Name *</label>
                  <input
                    type="text"
                    required
                    value={regFirstName}
                    onChange={(e) => setRegFirstName(e.target.value)}
                    placeholder="E.g., Sarah"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={regLastName}
                    onChange={(e) => setRegLastName(e.target.value)}
                    placeholder="E.g., Connor"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Gender</label>
                  <select
                    value={regGender}
                    onChange={(e) => setRegGender(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-100"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Blood Group</label>
                  <select
                    value={regBloodGroup}
                    onChange={(e) => setRegBloodGroup(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-100"
                  >
                    <option value="O+">O+</option>
                    <option value="A+">A+</option>
                    <option value="B+">B+</option>
                    <option value="AB+">AB+</option>
                    <option value="O-">O-</option>
                    <option value="A-">A-</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Date of Birth</label>
                  <input
                    type="date"
                    value={regDob}
                    onChange={(e) => setRegDob(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-100 text-[11px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Phone Number</label>
                  <input
                    type="text"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+1-555-019-2834"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Email (Optional)</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="sarah@example.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Known Allergies</label>
                  <input
                    type="text"
                    value={regAllergies}
                    onChange={(e) => setRegAllergies(e.target.value)}
                    placeholder="None, Penicillin, etc."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Chronic Conditions</label>
                  <input
                    type="text"
                    value={regConditions}
                    onChange={(e) => setRegConditions(e.target.value)}
                    placeholder="None, Hypertension, etc."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={regLoading}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold shadow-glow-teal disabled:opacity-50 cursor-pointer"
                >
                  {regLoading ? 'Registering...' : 'Register Patient & Open Portal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Invoice Modal */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-heading font-bold text-lg text-slate-100">
                Settle Invoice ({payingInvoice.invoice_number})
              </h3>
              <button onClick={() => setPayingInvoice(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Billed:</span>
                <span className="font-mono font-bold text-slate-100">${payingInvoice.total_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount Due:</span>
                <span className="font-mono font-bold text-teal-300">
                  ${(payingInvoice.total_amount - payingInvoice.paid_amount).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block text-slate-300 font-semibold">Select Payment Gateway / Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
              >
                <option value="TEST_PAYMENT">TEST_PAYMENT (Instant Sandbox Settlement)</option>
                <option value="UPI">UPI / Instant Bank Pay</option>
                <option value="Card">Credit / Debit Card</option>
                <option value="Cash">Cash at Counter</option>
                <option value="Insurance">Insurance Pre-Auth Claim</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPayingInvoice(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handlePayInvoice}
                className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold shadow-glow-teal cursor-pointer"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
