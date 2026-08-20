import React, { useState, useEffect } from 'react';
import { MedicineInventory } from '../../types';
import { api } from '../../api/client';
import { 
  Pill, CheckCircle2, AlertTriangle, Package, RefreshCw, 
  ShoppingCart, ArrowRight, Plus, X, ShieldAlert 
} from 'lucide-react';

export const PharmacyConsole: React.FC = () => {
  const [inventory, setInventory] = useState<MedicineInventory[]>([]);
  const [pendingRx, setPendingRx] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispenseError, setDispenseError] = useState<string | null>(null);
  
  // Add Stock Modal State
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [selectedMedId, setSelectedMedId] = useState<number>(1);
  const [batchNumber, setBatchNumber] = useState<string>('BAT-2026-N01');
  const [expiryDate, setExpiryDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2);
    return d.toISOString().split('T')[0];
  });
  const [stockQuantity, setStockQuantity] = useState<number>(100);
  const [costPrice, setCostPrice] = useState<number>(4.5);
  const [unitSellingPrice, setUnitSellingPrice] = useState<number>(8.0);
  const [supplierName, setSupplierName] = useState<string>('Apex Healthcare Global');

  const loadData = async () => {
    try {
      setLoading(true);
      const [invData, rxData] = await Promise.all([
        api.getPharmacyInventory(),
        api.getPendingPrescriptions()
      ]);
      setInventory(invData);
      setPendingRx(rxData);
      if (invData.length > 0 && !selectedMedId) {
        setSelectedMedId(invData[0].medicine_id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDispense = async (rxId: number) => {
    setDispenseError(null);
    try {
      await api.dispensePrescription(rxId);
      alert('Prescription successfully dispensed. Stock deducted using FEFO batches in database.');
      await loadData();
    } catch (err: any) {
      setDispenseError(err.message || 'Dispense failed due to insufficient batch stock.');
    }
  };

  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addInventoryStock({
        medicine_id: selectedMedId,
        batch_number: batchNumber,
        expiry_date: expiryDate,
        quantity_in_stock: stockQuantity,
        cost_price: costPrice,
        unit_selling_price: unitSellingPrice,
        supplier_name: supplierName
      });
      alert(`Batch ${batchNumber} added successfully to active database inventory.`);
      setShowAddStockModal(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to add batch');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="p-6 rounded-3xl glass-panel border border-emerald-500/30 bg-gradient-to-r from-emerald-950/30 via-slate-900/60 to-slate-900/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <Pill className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-heading text-2xl font-bold text-slate-100">Pharmacy & FEFO Inventory Dispenser</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated First-Expiry-First-Out batch deduction & electronic prescription dispensing
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAddStockModal(true)}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Add Stock Batch</span>
          </button>
          <button
            onClick={loadData}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-xs font-semibold border border-teal-500/40 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Callout Banner if dispensing fails */}
      {dispenseError && (
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-start justify-between text-xs text-red-200">
          <div className="flex items-center space-x-3">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <strong className="block font-bold text-red-300">Dispensing Blocked — Insufficient Inventory:</strong>
              <span>{dispenseError}</span>
            </div>
          </div>
          <button onClick={() => setDispenseError(null)} className="text-red-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pending Prescriptions Worklist */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-heading font-bold text-base text-slate-100 flex items-center space-x-2">
            <span>Pending Electronic Prescriptions</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {pendingRx.length} Orders Pending
            </span>
          </h3>
        </div>

        {pendingRx.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            All electronic prescriptions have been fulfilled.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingRx.map((rx) => (
              <div key={rx.id} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3.5 shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-teal-300 text-xs">{rx.prescription_code}</span>
                    <h4 className="font-bold text-slate-100 text-sm mt-0.5">{rx.patient_name}</h4>
                    <span className="text-[11px] text-slate-400">MRN: {rx.patient_mrn} • Dr: {rx.doctor_name}</span>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {rx.status}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Prescribed Items</div>
                  {rx.items?.map((item: any) => (
                    <div key={item.item_id} className="flex justify-between items-center">
                      <span>• {item.medicine_name} ({item.dosage})</span>
                      <strong className={`font-mono ${item.is_dispensed ? 'text-emerald-400' : 'text-slate-100'}`}>
                        {item.is_dispensed ? '✓ Dispensed' : `x${item.quantity}`}
                      </strong>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleDispense(rx.id)}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Dispense Medicines via FEFO Batches</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Formulary & Stock Table */}
      <div className="rounded-3xl glass-panel overflow-hidden border border-slate-800/80 shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 font-heading font-bold text-sm text-slate-100 flex items-center justify-between">
          <span>Pharmacy Drug Formulary & FEFO Batch Expiry Status</span>
          <span className="text-xs text-slate-400">{inventory.length} Formularies</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-4">Medicine Name</th>
                <th className="p-4">Generic Molecule</th>
                <th className="p-4">Form / Strength</th>
                <th className="p-4">Available Stock</th>
                <th className="p-4">Earliest Expiry (FEFO)</th>
                <th className="p-4">Unit Price</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {inventory.map((med) => (
                <tr key={med.medicine_id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-bold text-slate-200">{med.name}</td>
                  <td className="p-4 text-slate-400">{med.generic_name}</td>
                  <td className="p-4 text-slate-300">{med.dosage_form} • {med.strength}</td>
                  <td className="p-4 font-mono font-bold">
                    <span className={med.total_stock <= 20 ? 'text-red-400' : 'text-emerald-400'}>
                      {med.total_stock} units
                    </span>
                  </td>
                  <td className="p-4 font-mono text-slate-300">{med.earliest_expiry}</td>
                  <td className="p-4 font-mono text-teal-300 font-bold">${med.unit_price.toFixed(2)}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      med.reorder_needed 
                        ? 'bg-red-500/20 text-red-300 border-red-500/40' 
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}>
                      {med.reorder_needed ? 'Reorder Alert' : 'In Stock'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Stock Batch Modal */}
      {showAddStockModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-heading font-bold text-lg text-slate-100">
                Receive Supplier Inventory Batch
              </h3>
              <button onClick={() => setShowAddStockModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStockSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Medication SKU</label>
                <select
                  value={selectedMedId}
                  onChange={(e) => setSelectedMedId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                >
                  {inventory.map(m => (
                    <option key={m.medicine_id} value={m.medicine_id} className="bg-slate-900 text-slate-200">
                      {m.name} ({m.strength}) — Current Stock: {m.total_stock}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Batch Number</label>
                  <input
                    type="text"
                    required
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Expiry Date (FEFO)</label>
                  <input
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Quantity</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Cost ($)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={costPrice}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Sell ($)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={unitSellingPrice}
                    onChange={(e) => setUnitSellingPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Supplier / Distributor</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddStockModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md cursor-pointer"
                >
                  Confirm & Stock Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
