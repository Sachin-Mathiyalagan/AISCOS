import React, { useState, useEffect, useCallback } from 'react';
import { Appointment, Doctor, Patient, AvailableSlotsData } from '../../types';
import { api } from '../../api/client';
import { 
  Calendar, Plus, Clock, User, Stethoscope, CheckCircle2, 
  RefreshCw, UserPlus, AlertCircle, CalendarDays, X, Check, ArrowRight
} from 'lucide-react';

export const AppointmentsCalendar: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showBookModal, setShowBookModal] = useState(false);
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);

  // Booking Form State
  const [selectedDoctorId, setSelectedDoctorId] = useState<number>(1);
  const [selectedPatientId, setSelectedPatientId] = useState<number>(1);
  const [apptDate, setApptDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [slotTime, setSlotTime] = useState<string>('09:00');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [complaint, setComplaint] = useState<string>('');

  // Reschedule Form State
  const [newRescheduleDate, setNewRescheduleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newRescheduleSlot, setNewRescheduleSlot] = useState<string>('09:00');
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([]);

  // Walk-in Registration Form State
  const [walkinFirstName, setWalkinFirstName] = useState('');
  const [walkinLastName, setWalkinLastName] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [walkinGender, setWalkinGender] = useState('Male');
  const [walkinDob, setWalkinDob] = useState('1990-01-01');
  const [walkinAllergies, setWalkinAllergies] = useState('None');
  const [walkinConditions, setWalkinConditions] = useState('None');
  const [walkinDoctorId, setWalkinDoctorId] = useState(1);
  const [walkinComplaint, setWalkinComplaint] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [appts, docs, pats] = await Promise.all([
        api.getAppointments(),
        api.getDoctors(),
        api.getPatients()
      ]);
      setAppointments(appts);
      setDoctors(docs);
      setPatients(pats);
      if (docs.length > 0 && !selectedDoctorId) setSelectedDoctorId(docs[0].id);
      if (pats.length > 0 && !selectedPatientId) setSelectedPatientId(pats[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch dynamic available slots when booking doctor or date changes
  const fetchBookingSlots = useCallback(async () => {
    if (!selectedDoctorId || !apptDate) return;
    try {
      setSlotsLoading(true);
      const data = await api.getAvailableSlots(selectedDoctorId, apptDate);
      setAvailableSlots(data.available_slots || []);
      if (data.available_slots && data.available_slots.length > 0) {
        setSlotTime(data.available_slots[0]);
      }
    } catch (err) {
      console.error('Failed to load slots:', err);
    } finally {
      setSlotsLoading(false);
    }
  }, [selectedDoctorId, apptDate]);

  useEffect(() => {
    if (showBookModal) {
      fetchBookingSlots();
    }
  }, [showBookModal, fetchBookingSlots]);

  // Fetch slots for reschedule modal
  useEffect(() => {
    if (rescheduleTarget && newRescheduleDate) {
      api.getAvailableSlots(rescheduleTarget.doctor_id, newRescheduleDate)
        .then(data => {
          setRescheduleSlots(data.available_slots || []);
          if (data.available_slots && data.available_slots.length > 0) {
            setNewRescheduleSlot(data.available_slots[0]);
          }
        })
        .catch(err => console.error(err));
    }
  }, [rescheduleTarget, newRescheduleDate]);

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.bookAppointment({
        doctor_id: selectedDoctorId,
        patient_id: selectedPatientId,
        appointment_date: apptDate,
        slot_time: slotTime,
        appointment_type: 'Routine',
        chief_complaint: complaint || 'Scheduled consultation'
      });
      setShowBookModal(false);
      setComplaint('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Booking failed');
    }
  };

  const handleWalkinRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 1. Create Patient
      const newPatient = await api.createPatient({
        first_name: walkinFirstName,
        last_name: walkinLastName,
        phone: walkinPhone,
        gender: walkinGender,
        dob: walkinDob,
        allergies: walkinAllergies,
        chronic_conditions: walkinConditions
      });

      // 2. Check in Walk-in immediately
      await api.checkIn({
        patient_id: newPatient.id,
        doctor_id: walkinDoctorId,
        is_emergency: false,
        triage_level: 4,
        chief_complaint: walkinComplaint || 'Walk-in consultation'
      });

      alert(`Patient ${newPatient.first_name} registered (MRN: ${newPatient.mrn}) and checked into queue!`);
      setShowWalkinModal(false);
      setWalkinFirstName('');
      setWalkinLastName('');
      setWalkinPhone('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Walk-in registration failed');
    }
  };

  const handleCheckInAppointment = async (appt: Appointment) => {
    try {
      const q = await api.checkIn({
        patient_id: appt.patient_id,
        doctor_id: appt.doctor_id,
        appointment_id: appt.id,
        triage_level: 3,
        chief_complaint: appt.chief_complaint
      });
      alert(`Patient checked in! Token issued: ${q.token_number} (Est. wait: ~${q.estimated_wait_minutes} mins)`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Check-in failed');
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTarget) return;
    try {
      await api.rescheduleAppointment(
        rescheduleTarget.id,
        newRescheduleDate,
        newRescheduleSlot,
        'Patient requested reschedule'
      );
      setRescheduleTarget(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Reschedule failed');
    }
  };

  const handleCancelSubmit = async () => {
    if (!cancelTarget) return;
    try {
      await api.cancelAppointment(cancelTarget.id, 'Patient cancelled');
      setCancelTarget(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Cancellation failed');
    }
  };

  const statusBadgeMap: Record<string, string> = {
    'Scheduled': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'Checked-In': 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    'In-Consultation': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    'Completed': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    'Cancelled': 'bg-red-500/20 text-red-300 border-red-500/30',
    'No-Show': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  };

  return (
    <div className="space-y-6">
      
      {/* Top Action Header */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/80 to-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-teal-500/20 text-teal-300 border border-teal-500/40">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-heading text-2xl font-bold text-slate-100">Outpatient Appointments Schedule</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Doctor slot allocation, double-booking prevention & reception walk-in synchronization
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowWalkinModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-amber-400" />
            <span>Walk-In Registration</span>
          </button>

          <button
            onClick={() => setShowBookModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-glow-teal transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Book Appointment Slot</span>
          </button>
        </div>
      </div>

      {/* Appointments List Table */}
      <div className="rounded-3xl glass-panel overflow-hidden border border-slate-800/80 shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 font-heading font-bold text-sm text-slate-100 flex items-center justify-between">
          <span>Scheduled & Active Appointments ({appointments.length})</span>
          <button onClick={loadData} className="text-xs text-teal-400 hover:text-teal-300 flex items-center space-x-1.5 cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-4">Appointment Code</th>
                <th className="p-4">Patient</th>
                <th className="p-4">Doctor & Specialty</th>
                <th className="p-4">Date & Slot</th>
                <th className="p-4">Type</th>
                <th className="p-4">Chief Complaint</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {appointments.map((a) => (
                <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-mono font-bold text-teal-300">{a.appointment_code}</td>
                  <td className="p-4">
                    <div className="font-bold text-slate-200">{a.patient_name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{a.patient_mrn}</div>
                  </td>
                  <td className="p-4 text-slate-300">
                    <div>{a.doctor_name}</div>
                    <span className="text-[10px] text-teal-400 font-medium">{a.doctor_specialty}</span>
                  </td>
                  <td className="p-4 font-mono text-slate-200">
                    {a.appointment_date} @ <strong className="text-teal-300">{a.slot_time}</strong>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px]">
                      {a.appointment_type}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400 max-w-xs truncate">{a.chief_complaint || 'Outpatient consultation'}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusBadgeMap[a.status] || 'bg-slate-800 text-slate-400'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      {a.status === 'Scheduled' && (
                        <>
                          <button
                            onClick={() => handleCheckInAppointment(a)}
                            className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 font-bold border border-teal-500/40 text-[11px] cursor-pointer"
                          >
                            Check In
                          </button>
                          <button
                            onClick={() => {
                              setRescheduleTarget(a);
                              setNewRescheduleDate(a.appointment_date);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium border border-slate-700 text-[11px] cursor-pointer"
                          >
                            Reschedule
                          </button>
                          <button
                            onClick={() => setCancelTarget(a)}
                            className="px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 font-medium border border-red-500/30 text-[11px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Book Appointment Modal */}
      {showBookModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-heading font-bold text-lg text-slate-100">
                Book Outpatient Appointment
              </h3>
              <button onClick={() => setShowBookModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBookSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Doctor & Specialty</label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                >
                  {doctors.map(d => (
                    <option key={d.id} value={d.id} className="bg-slate-900 text-slate-200">
                      {d.full_name} ({d.specialty}) — Consultation Fee: ${d.consultation_fee}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Patient</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                >
                  {patients.map(p => (
                    <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                      {p.first_name} {p.last_name} ({p.mrn})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Appointment Date</label>
                  <input
                    type="date"
                    value={apptDate}
                    onChange={(e) => setApptDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Available Time Slot {slotsLoading && <span className="text-teal-400 animate-pulse">(Calculating...)</span>}
                  </label>
                  <select
                    value={slotTime}
                    onChange={(e) => setSlotTime(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  >
                    {availableSlots.length === 0 ? (
                      <option value="" disabled>No slots available on this date</option>
                    ) : (
                      availableSlots.map(s => (
                        <option key={s} value={s} className="bg-slate-900 text-slate-200">{s}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Chief Complaint / Clinical Indication</label>
                <input
                  type="text"
                  value={complaint}
                  onChange={(e) => setComplaint(e.target.value)}
                  placeholder="e.g. Hypertension management follow-up"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={availableSlots.length === 0}
                  className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-bold shadow-glow-teal cursor-pointer"
                >
                  Confirm & Reserve Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Walk-in Registration & Check-In Modal */}
      {showWalkinModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-heading font-bold text-lg text-slate-100">
                  Walk-In Patient Registration & Check-In
                </h3>
                <p className="text-xs text-slate-400">Creates permanent patient record and issues instant queue token</p>
              </div>
              <button onClick={() => setShowWalkinModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWalkinRegister} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={walkinFirstName}
                    onChange={(e) => setWalkinFirstName(e.target.value)}
                    placeholder="e.g. Sachin"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={walkinLastName}
                    onChange={(e) => setWalkinLastName(e.target.value)}
                    placeholder="e.g. Kumar"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={walkinPhone}
                    onChange={(e) => setWalkinPhone(e.target.value)}
                    placeholder="+91-9876543210"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Gender</label>
                  <select
                    value={walkinGender}
                    onChange={(e) => setWalkinGender(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={walkinDob}
                    onChange={(e) => setWalkinDob(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Known Drug Allergies</label>
                  <input
                    type="text"
                    value={walkinAllergies}
                    onChange={(e) => setWalkinAllergies(e.target.value)}
                    placeholder="e.g. Sulfa Drugs, Penicillin"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Chronic Conditions</label>
                  <input
                    type="text"
                    value={walkinConditions}
                    onChange={(e) => setWalkinConditions(e.target.value)}
                    placeholder="e.g. Hypertension, Type 2 Diabetes"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Assign Doctor</label>
                <select
                  value={walkinDoctorId}
                  onChange={(e) => setWalkinDoctorId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                >
                  {doctors.map(d => (
                    <option key={d.id} value={d.id} className="bg-slate-900 text-slate-200">
                      {d.full_name} ({d.specialty})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Chief Complaint</label>
                <input
                  type="text"
                  value={walkinComplaint}
                  onChange={(e) => setWalkinComplaint(e.target.value)}
                  placeholder="e.g. Acute sore throat, elevated BP"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowWalkinModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-teal-500 hover:from-amber-400 hover:to-teal-400 text-slate-950 font-bold shadow-md cursor-pointer"
                >
                  Register & Issue Token
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="font-heading font-bold text-lg text-slate-100">
              Reschedule Appointment ({rescheduleTarget.appointment_code})
            </h3>
            <p className="text-xs text-slate-400">
              Select new date and available slot for {rescheduleTarget.patient_name} with {rescheduleTarget.doctor_name}.
            </p>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">New Date</label>
                  <input
                    type="date"
                    value={newRescheduleDate}
                    onChange={(e) => setNewRescheduleDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Available Slot</label>
                  <select
                    value={newRescheduleSlot}
                    onChange={(e) => setNewRescheduleSlot(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  >
                    {rescheduleSlots.map(s => (
                      <option key={s} value={s} className="bg-slate-900 text-slate-200">{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRescheduleTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rescheduleSlots.length === 0}
                  className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-bold shadow-glow-teal cursor-pointer"
                >
                  Save Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="font-heading font-bold text-lg text-slate-100">
              Confirm Cancellation
            </h3>
            <p className="text-xs text-slate-300">
              Are you sure you want to cancel appointment <strong className="text-teal-300">{cancelTarget.appointment_code}</strong> for {cancelTarget.patient_name}?
            </p>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
              >
                Keep Appointment
              </button>
              <button
                onClick={handleCancelSubmit}
                className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-slate-950 font-bold shadow-md cursor-pointer"
              >
                Cancel Appointment
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
