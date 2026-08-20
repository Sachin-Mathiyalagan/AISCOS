import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { MetricCard } from '../common/MetricCard';
import { 
  Users, Calendar, Clock, DollarSign, Activity, 
  Smile, UserCheck, Sparkles, TrendingUp, BarChart3, AlertCircle
} from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend 
} from 'recharts';

export const AnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAnalyticsDashboard().then(res => {
      setData(res);
      setLoading(false);
    }).catch(console.error);
  }, []);

  if (loading || !data) {
    return (
      <div className="p-12 text-center text-slate-400 text-sm">
        <Activity className="w-8 h-8 animate-spin mx-auto mb-2 text-teal-400" />
        Loading clinic executive intelligence metrics...
      </div>
    );
  }

  const summary = data.summary;
  const sentimentData = [
    { name: 'Positive', value: data.sentiment_breakdown.positive, color: '#10b981' },
    { name: 'Neutral', value: data.sentiment_breakdown.neutral, color: '#3b82f6' },
    { name: 'Negative', value: data.sentiment_breakdown.negative, color: '#ef4444' },
  ];

  return (
    <div className="space-y-6">
      
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Registered Patients"
          value={summary.total_patients}
          subtitle="Longitudinal EHR profiles"
          trend={{ value: '+12% this month', isPositive: true }}
          icon={Users}
          colorVariant="teal"
        />
        <MetricCard
          title="Today's Outpatient Revenue"
          value={`$${summary.today_revenue_usd.toLocaleString()}`}
          subtitle={`Total Billed: $${summary.total_billed_usd.toLocaleString()}`}
          trend={{ value: '+8.4% vs last week', isPositive: true }}
          icon={DollarSign}
          colorVariant="blue"
        />
        <MetricCard
          title="Average Patient Wait Time"
          value={`${summary.average_waiting_time_minutes} min`}
          subtitle="Target: < 15 min"
          trend={{ value: '-34% via AI Queue', isPositive: true }}
          icon={Clock}
          colorVariant="purple"
        />
        <MetricCard
          title="Patient Satisfaction Index"
          value={`${summary.patient_satisfaction_score} / 5.0`}
          subtitle={`No-Show Rate: ${summary.no_show_rate_percent}%`}
          trend={{ value: '94% Positive Feedback', isPositive: true }}
          icon={Smile}
          colorVariant="amber"
        />
      </div>

      {/* Hourly Flow Chart & Doctor Utilization Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Hourly Volume & Congestion Trend */}
        <div className="lg:col-span-7 p-5 rounded-2xl glass-panel border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-heading font-bold text-sm text-slate-100">Hourly Patient Arrival Flow & Wait Delay</h3>
              <p className="text-[11px] text-slate-400">Peak hours observed between 10:00 AM - 12:00 PM and 04:00 PM - 05:00 PM</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300">Live Traffic</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.hourly_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="patients" name="Arriving Patients" stroke="#14b8a6" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="avg_wait" name="Avg Wait (mins)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sentiment Distribution Pie Chart */}
        <div className="lg:col-span-5 p-5 rounded-2xl glass-panel border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-heading font-bold text-sm text-slate-100">Patient Sentiment & Feedback NLP</h3>
            <span className="text-[10px] text-slate-400">VADER & Rule Classifier</span>
          </div>

          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {sentimentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-around text-center text-xs">
            {sentimentData.map(s => (
              <div key={s.name}>
                <div className="text-[10px] text-slate-400">{s.name}</div>
                <div className="font-bold text-slate-100">{s.value} Reviews</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Doctor Utilization Breakdown Table */}
      <div className="rounded-2xl glass-panel overflow-hidden border border-slate-800">
        <div className="px-5 py-4 border-b border-slate-800 font-heading font-bold text-sm text-slate-100">
          Doctor Clinical Capacity & Utilization Analytics
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3.5">Doctor & Specialty</th>
                <th className="p-3.5">Active Queue</th>
                <th className="p-3.5">Completed Consultations</th>
                <th className="p-3.5">Capacity Utilization</th>
                <th className="p-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {data.doctor_utilization.map((doc: any, i: number) => (
                <tr key={i} className="hover:bg-slate-800/30">
                  <td className="p-3.5 font-bold text-slate-200">
                    {doc.doctor_name}
                    <span className="text-[10px] text-teal-400 block font-normal">{doc.specialty}</span>
                  </td>
                  <td className="p-3.5 text-slate-300 font-bold">{doc.waiting_count} waiting</td>
                  <td className="p-3.5 text-slate-300">{doc.completed_count} served</td>
                  <td className="p-3.5">
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-teal-400 h-full rounded-full"
                          style={{ width: `${doc.utilization_percent}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-200">{doc.utilization_percent}%</span>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                      Optimal
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
