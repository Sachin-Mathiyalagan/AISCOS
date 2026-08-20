import React, { useState, useEffect } from 'react';
import { Patient } from '../../types';
import { api } from '../../api/client';
import { HeartPulse, Activity, Thermometer, ShieldAlert, CheckCircle, Scale, Flame } from 'lucide-react';

export const NurseTriagePortal: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number>(1);
  const [temp, setTemp] = useState<number>(98.6);
  const [systolic, setSystolic] = useState<number>(120);
  const [diastolic, setDiastolic] = useState<number>(80);
  const [hr, setHr] = useState<number>(75);
  const [spo2, setSpo2] = useState<number>(98);
  const [weight, setWeight] = useState<number>(70);
  const [height, setHeight] = useState<number>(170);
  const [pain, setPain] = useState<number>(0);
  const [triageLevel, setTriageLevel] = useState<number>(4);
  const [notes, setNotes] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    api.getPatients().then(setPatients).catch(console.error);
  }, []);

  const bmi = (weight && height && height > 0) ? (weight / ((height / 100) * (height / 100))).toFixed(1) : '24.2';

  const handleSubmitVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.recordVitals({
        patient_id: selectedPatientId,
        temperature_f: temp,
        systolic_bp: systolic,
        diastolic_bp: diastolic,
        heart_rate_bpm: hr,
        respiratory_rate: 16,
        spo2_percent: spo2,
        weight_kg: weight,
        height_cm: height,
        bmi: parseFloat(bmi),
        pain_score: pain,
        triage_level: triageLevel,
        triage_notes: notes || 'Routine nurse triage intake complete.'
      });
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to record vitals');
    }
  };

  const selectedPatient = patients.find(p => p.id === selectedPatientId) || patients[0];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="p-6 rounded-2xl glass-panel border border-rose-500/30 bg-gradient-to-r from-rose-950/30 via-slate-900/60 to-slate-900/40 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40">
            <HeartPulse className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold text-slate-100">Nurse Intake & Triage Station</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Rapid clinical vitals telemetry & acute triage classification
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmitVitals} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Col: Patient Selection & Triage Classification */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-4">
            <h3 className="font-heading font-bold text-sm text-slate-100">1. Select Patient</h3>
            
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(Number(e.target.value))}
              className="w-full glass-input rounded-xl px-3 py-2 text-xs"
            >
              {patients.map(p => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                  {p.first_name} {p.last_name} ({p.mrn}) — {p.blood_group}
                </option>
              ))}
            </select>

            {selectedPatient && (
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-1 text-slate-300">
                <div>Allergies: <strong className="text-red-300">{selectedPatient.allergies}</strong></div>
                <div>Conditions: <strong className="text-amber-300">{selectedPatient.chronic_conditions}</strong></div>
                <div>Age / Gender: {selectedPatient.gender}, {selectedPatient.is_senior ? 'Senior Citizen' : 'Adult'}</div>
              </div>
            )}
          </div>

          <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-3">
            <h3 className="font-heading font-bold text-sm text-slate-100">2. Emergency Severity Index (Triage Level)</h3>
            
            <div className="space-y-2">
              {[
                { level: 1, label: 'Level 1: Resuscitation (Immediate Life Threat)', color: 'border-red-500/50 text-red-300' },
                { level: 2, label: 'Level 2: Emergent (Severe Pain / High Risk)', color: 'border-amber-500/50 text-amber-300' },
                { level: 3, label: 'Level 3: Urgent (Moderate Distress)', color: 'border-blue-500/50 text-blue-300' },
                { level: 4, label: 'Level 4: Routine (Standard Primary Care)', color: 'border-emerald-500/50 text-emerald-300' },
              ].map(t => (
                <button
                  type="button"
                  key={t.level}
                  onClick={() => setTriageLevel(t.level)}
                  className={`w-full p-3 rounded-xl border text-xs font-semibold text-left transition-all ${
                    triageLevel === t.level
                      ? 'bg-slate-800 ' + t.color + ' ring-1 ring-rose-500'
                      : 'border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Vitals Input Matrix */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-4">
            <h3 className="font-heading font-bold text-sm text-slate-100">3. Vitals Telemetry</h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Temperature (°F)</label>
                <input
                  type="number"
                  step="0.1"
                  value={temp}
                  onChange={(e) => setTemp(Number(e.target.value))}
                  className="w-full glass-input rounded-xl p-2.5 font-bold text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Blood Pressure (Systolic/Diastolic)</label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    value={systolic}
                    onChange={(e) => setSystolic(Number(e.target.value))}
                    className="w-full glass-input rounded-xl p-2.5 font-bold text-slate-100"
                  />
                  <span className="text-slate-500 font-bold">/</span>
                  <input
                    type="number"
                    value={diastolic}
                    onChange={(e) => setDiastolic(Number(e.target.value))}
                    className="w-full glass-input rounded-xl p-2.5 font-bold text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Heart Rate (bpm)</label>
                <input
                  type="number"
                  value={hr}
                  onChange={(e) => setHr(Number(e.target.value))}
                  className="w-full glass-input rounded-xl p-2.5 font-bold text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Oxygen Saturation (SpO2 %)</label>
                <input
                  type="number"
                  value={spo2}
                  onChange={(e) => setSpo2(Number(e.target.value))}
                  className="w-full glass-input rounded-xl p-2.5 font-bold text-teal-300"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Weight (kg) / Height (cm)</label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(Number(e.target.value))}
                    className="w-full glass-input rounded-xl p-2.5 font-bold text-slate-100"
                  />
                  <span className="text-slate-500 font-bold">/</span>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    className="w-full glass-input rounded-xl p-2.5 font-bold text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Computed BMI (kg/m²)</label>
                <div className="w-full glass-input rounded-xl p-2.5 font-bold text-amber-300 bg-slate-900/80">
                  {bmi}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Nurse Intake Observations</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Patient alert, oriented x3, no acute respiratory distress..."
                className="w-full glass-input rounded-xl p-2.5 text-xs"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-heading font-black text-xs tracking-wide shadow-sm transition-all flex items-center justify-center space-x-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Record Vitals & Sync to Clinical Encounter</span>
            </button>

            {submitted && (
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center">
                Vitals successfully transmitted to Doctor consultation queue!
              </div>
            )}
          </div>
        </div>

      </form>

    </div>
  );
};
