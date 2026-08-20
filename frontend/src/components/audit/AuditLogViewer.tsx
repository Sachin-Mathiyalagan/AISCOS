import React, { useState, useEffect } from 'react';
import { AuditLogItem } from '../../types';
import { api } from '../../api/client';
import { ShieldCheck, Lock, RefreshCw, Filter, Search } from 'lucide-react';

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter(l => 
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.resource_type.toLowerCase().includes(search.toLowerCase()) ||
    (l.user_email && l.user_email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="p-6 rounded-2xl glass-panel border border-purple-500/30 bg-gradient-to-r from-purple-950/30 via-slate-900/60 to-slate-900/40 shadow-xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold text-slate-100">Cryptographic Security & Audit Trail</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Append-only immutable record of all Protected Health Information (PHI) transactions
            </p>
          </div>
        </div>

        <button
          onClick={loadLogs}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-semibold border border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl glass-panel border border-slate-800 flex items-center space-x-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by action (e.g. ISSUE_PRESCRIPTION, CHECK_IN, VIEW_EHR), resource, or user..."
          className="w-full bg-transparent text-xs text-slate-200 outline-none placeholder-slate-500"
        />
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl glass-panel overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-sans">
              <tr>
                <th className="p-3.5">Timestamp (UTC)</th>
                <th className="p-3.5">Action Event</th>
                <th className="p-3.5">User Identity</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">Resource Target</th>
                <th className="p-3.5">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/30">
                  <td className="p-3.5 text-slate-400 whitespace-nowrap">{log.timestamp}</td>
                  <td className="p-3.5">
                    <span className="font-bold text-teal-300">{log.action}</span>
                  </td>
                  <td className="p-3.5 text-slate-300">{log.user_email || `User #${log.user_id}`}</td>
                  <td className="p-3.5">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                      {log.user_role}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-300 font-bold">
                    {log.resource_type} ({log.resource_id || 'N/A'})
                  </td>
                  <td className="p-3.5 text-slate-500">{log.ip_address || '127.0.0.1'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
