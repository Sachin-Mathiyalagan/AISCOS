import React, { useState, useEffect } from 'react';
import { Invoice } from '../../types';
import { api } from '../../api/client';
import { Receipt, DollarSign, CreditCard, CheckCircle2, RefreshCw, FileText, X } from 'lucide-react';

export const BillingConsole: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const data = await api.getInvoices();
      setInvoices(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
    const interval = setInterval(loadInvoices, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;
    try {
      const due = payingInvoice.total_amount - payingInvoice.paid_amount;
      await api.recordPayment(payingInvoice.id, due, paymentMethod, `Settled via counter (${paymentMethod})`);
      alert(`Payment of $${due.toFixed(2)} recorded for ${payingInvoice.invoice_number}.`);
      setPayingInvoice(null);
      await loadInvoices();
    } catch (err: any) {
      alert(err.message || 'Payment recording failed');
    }
  };

  const totalBilled = invoices.reduce((acc, inv) => acc + inv.total_amount, 0);
  const totalCollected = invoices.reduce((acc, inv) => acc + inv.paid_amount, 0);
  const totalPending = totalBilled - totalCollected;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="p-6 rounded-3xl glass-panel border border-indigo-500/30 bg-gradient-to-r from-indigo-950/30 via-slate-900/60 to-slate-900/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-heading text-2xl font-bold text-slate-100">Billing, Invoicing & Financial Settlement</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Consolidated automated charge aggregation from Consultations, Lab & Pharmacy
            </p>
          </div>
        </div>

        <button
          onClick={loadInvoices}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-semibold border border-slate-700 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Financial Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl glass-panel border border-slate-800 shadow-lg">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gross Outpatient Billed</div>
          <div className="font-heading text-3xl font-bold text-slate-100 mt-2 font-mono">${totalBilled.toFixed(2)}</div>
        </div>
        <div className="p-5 rounded-3xl glass-panel border border-emerald-500/30 bg-emerald-500/5 shadow-lg">
          <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Settled & Collected</div>
          <div className="font-heading text-3xl font-bold text-emerald-300 mt-2 font-mono">${totalCollected.toFixed(2)}</div>
        </div>
        <div className="p-5 rounded-3xl glass-panel border border-amber-500/30 bg-amber-500/5 shadow-lg">
          <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">Accounts Receivable (A/R)</div>
          <div className="font-heading text-3xl font-bold text-amber-300 mt-2 font-mono">${totalPending.toFixed(2)}</div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="rounded-3xl glass-panel overflow-hidden border border-slate-800/80 shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 font-heading font-bold text-sm text-slate-100 flex items-center justify-between">
          <span>Consolidated Patient Invoices</span>
          <span className="text-xs text-slate-400">{invoices.length} Invoices</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-4">Invoice #</th>
                <th className="p-4">Patient Details</th>
                <th className="p-4">Itemized Charges</th>
                <th className="p-4">Subtotal</th>
                <th className="p-4">Tax (5%)</th>
                <th className="p-4">Total Due</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-mono font-bold text-teal-300">{inv.invoice_number}</td>
                  <td className="p-4">
                    <span className="font-bold text-slate-200 block">{inv.patient_name}</span>
                    <span className="text-[10px] text-slate-400">MRN: {inv.patient_mrn}</span>
                  </td>
                  <td className="p-4 text-slate-300">
                    <div className="space-y-0.5">
                      {inv.items?.map((it, idx) => (
                        <div key={idx} className="text-[11px] text-slate-400">
                          • {it.item_type}: {it.description} (${it.total_price.toFixed(2)})
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 text-slate-300">${inv.subtotal.toFixed(2)}</td>
                  <td className="p-4 text-slate-400">${inv.tax.toFixed(2)}</td>
                  <td className="p-4 font-bold text-slate-100 text-sm font-mono">${inv.total_amount.toFixed(2)}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      inv.payment_status === 'Paid'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                      {inv.payment_status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {inv.payment_status !== 'Paid' ? (
                      <button
                        onClick={() => setPayingInvoice(inv)}
                        className="px-3.5 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-glow-teal cursor-pointer"
                      >
                        Receive Pay
                      </button>
                    ) : (
                      <span className="text-emerald-400 text-xs font-bold flex items-center justify-end space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Settled</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collect Payment Modal */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-heading font-bold text-lg text-slate-100">
                Collect Payment ({payingInvoice.invoice_number})
              </h3>
              <button onClick={() => setPayingInvoice(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Patient:</span>
                  <span className="font-bold text-slate-200">{payingInvoice.patient_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Billed:</span>
                  <span className="font-mono font-bold text-slate-100">${payingInvoice.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount Due:</span>
                  <span className="font-mono font-bold text-teal-300 text-sm">
                    ${(payingInvoice.total_amount - payingInvoice.paid_amount).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200"
                >
                  <option value="Cash">Cash at Counter</option>
                  <option value="Card">Credit / Debit POS Card</option>
                  <option value="UPI">UPI / QR Digital Pay</option>
                  <option value="Insurance">Insurance Third-Party Pay</option>
                  <option value="TEST_PAYMENT">TEST_PAYMENT (Sandbox)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPayingInvoice(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-glow-teal cursor-pointer"
                >
                  Record Payment & Finalize
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
