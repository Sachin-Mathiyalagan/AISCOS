import React, { useState, useEffect } from 'react';
import { LabOrder, LabTest } from '../../types';
import { api } from '../../api/client';
import { 
  FlaskConical, CheckCircle2, AlertTriangle, QrCode, 
  FileText, Plus, RefreshCw, Pipette, X, ShieldCheck 
} from 'lucide-react';

export const LabConsole: React.FC = () => {
  const [worklist, setWorklist] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Result Entry Modal State
  const [activeOrder, setActiveOrder] = useState<LabOrder | null>(null);
  const [numericVal, setNumericVal] = useState<number>(7.4);
  const [textVal, setTextVal] = useState<string>('');
  const [techNotes, setTechNotes] = useState<string>('Specimen analyzed via automated clinical chemistry analyzer. Reference parameters normal.');

  const loadWorklist = async () => {
    try {
      setLoading(true);
      const data = await api.getLabWorklist();
      setWorklist(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorklist();
    const interval = setInterval(loadWorklist, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCollectSpecimen = async (orderId: number) => {
    try {
      await api.collectLabSample(orderId);
      await loadWorklist();
    } catch (err: any) {
      alert(err.message || 'Failed to update sample collection');
    }
  };

  const handleSaveResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;
    try {
      await api.recordLabResult({
        lab_order_id: activeOrder.id,
        numeric_value: numericVal,
        text_value: textVal || undefined,
        technician_notes: techNotes
      });
      alert(`Diagnostic report for ${activeOrder.test_name} verified and released to patient chart.`);
      setActiveOrder(null);
      await loadWorklist();
    } catch (err: any) {
      alert(err.message || 'Failed to save lab result');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="p-6 rounded-3xl glass-panel border border-cyan-500/30 bg-gradient-to-r from-cyan-950/30 via-slate-900/60 to-slate-900/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-heading text-2xl font-bold text-slate-100">Laboratory Diagnostics & Specimen Tracker</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Specimen barcode tracking • Automated reference range analysis • Electronic verification release
            </p>
          </div>
        </div>

        <button
          onClick={loadWorklist}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-semibold border border-slate-700 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Worklist</span>
        </button>
      </div>

      {/* Worklist Table */}
      <div className="rounded-3xl glass-panel overflow-hidden border border-slate-800/80 shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 font-heading font-bold text-sm text-slate-100 flex items-center justify-between">
          <span>Active Specimen & Testing Worklist</span>
          <span className="text-xs text-slate-400">{worklist.length} Diagnostic Orders</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-4">Order ID / Barcode</th>
                <th className="p-4">Patient Details</th>
                <th className="p-4">Diagnostic Test</th>
                <th className="p-4">Specimen Type</th>
                <th className="p-4">Urgency</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {worklist.map((ord) => (
                <tr key={ord.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4">
                    <span className="font-mono font-bold text-teal-300 block">{ord.order_number}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{ord.sample_barcode || 'BAR-9901'}</span>
                  </td>
                  <td className="p-4">
                    <span className="font-bold text-slate-200 block">{ord.patient_name}</span>
                    <span className="text-[10px] text-slate-400">MRN: {ord.patient_mrn}</span>
                  </td>
                  <td className="p-4 font-bold text-slate-100">{ord.test_name}</td>
                  <td className="p-4 text-slate-400">{ord.sample_type}</td>
                  <td className="p-4">
                    {ord.urgency === 'Stat / Urgent' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40">
                        STAT / URGENT
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                        Routine
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      ord.status === 'Completed'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : ord.status === 'Sample-Collected'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                      {ord.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      {ord.status === 'Ordered' && (
                        <button
                          onClick={() => handleCollectSpecimen(ord.id)}
                          className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold text-xs border border-cyan-500/40 flex items-center space-x-1 cursor-pointer"
                        >
                          <Pipette className="w-3.5 h-3.5" />
                          <span>Collect Specimen</span>
                        </button>
                      )}

                      {ord.status !== 'Completed' && (
                        <button
                          onClick={() => {
                            setActiveOrder(ord);
                            if (ord.test_name?.toLowerCase().includes('blood') || ord.test_name?.toLowerCase().includes('cbc')) {
                              setNumericVal(14.2);
                            } else if (ord.test_name?.toLowerCase().includes('lipid') || ord.test_name?.toLowerCase().includes('cholesterol')) {
                              setNumericVal(185.0);
                            } else {
                              setNumericVal(95.0);
                            }
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-glow-teal cursor-pointer"
                        >
                          Enter Result
                        </button>
                      )}

                      {ord.status === 'Completed' && (
                        <span className="text-emerald-400 font-bold text-xs flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Verified & Released</span>
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Result Entry Modal */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-heading font-bold text-lg text-slate-100">
                  Verify Result: {activeOrder.test_name}
                </h3>
                <p className="text-xs text-slate-400">
                  Patient: {activeOrder.patient_name} • Barcode: {activeOrder.sample_barcode}
                </p>
              </div>
              <button onClick={() => setActiveOrder(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveResult} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Numeric Analyzer Value</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={numericVal}
                  onChange={(e) => setNumericVal(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 font-bold text-teal-300 text-lg"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Diagnostic Interpretation / Qualitative Notes</label>
                <textarea
                  value={techNotes}
                  onChange={(e) => setTechNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200 text-xs"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveOrder(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-glow-teal cursor-pointer"
                >
                  Electronically Sign & Verify
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
