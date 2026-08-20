import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { MonitorSmartphone, Clock, Users, Volume2, Activity, Zap } from 'lucide-react';

export const WaitingRoomKiosk: React.FC = () => {
  const [boardData, setBoardData] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState<string>('');

  const fetchBoard = async () => {
    try {
      const data = await api.getPublicDisplayQueue();
      setBoardData(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBoard();
    const interval = setInterval(fetchBoard, 4000);
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(clockInterval);
    };
  }, []);

  return (
    <div className="space-y-6">
      
      {/* Top Monitor Header */}
      <div className="p-6 rounded-3xl glass-panel border-2 border-teal-500/40 bg-gradient-to-r from-teal-950/60 via-slate-900/90 to-slate-950 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-500 text-slate-950 flex items-center justify-center font-bold shadow-glow-teal">
            <MonitorSmartphone className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-black text-slate-100 tracking-tight">
              AISCOS Public Waiting Room Display
            </h1>
            <p className="text-xs text-teal-300 font-medium">
              Live Token Calling & AI-Estimated Waiting Time Telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400">Clinic Local Time</div>
            <div className="font-mono text-2xl font-black text-teal-300">{currentTime || '10:45:00 AM'}</div>
          </div>
        </div>
      </div>

      {/* Grid of Doctor Consultation Rooms */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {boardData.map((room) => {
          const isServing = room.current_token && room.current_token !== 'None';

          return (
            <div
              key={room.doctor_id}
              className={`p-6 rounded-3xl glass-panel border-2 transition-all shadow-xl space-y-5 ${
                isServing
                  ? 'border-teal-500/60 bg-gradient-to-b from-teal-950/40 to-slate-900/80'
                  : 'border-slate-800/80 bg-slate-900/60'
              }`}
            >
              {/* Doctor & Room Info */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-heading text-lg font-bold text-slate-100">{room.doctor_name}</h3>
                  <span className="text-xs text-teal-400 font-medium">{room.specialty}</span>
                </div>
                <div className="px-3 py-1 rounded-xl bg-slate-800 text-xs font-mono font-bold text-slate-300 border border-slate-700">
                  {room.room_number || 'Room 101'}
                </div>
              </div>

              {/* Current Calling Token Hero */}
              <div className="text-center py-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Now Serving</span>
                <div className={`font-heading text-4xl font-black ${
                  isServing ? 'text-teal-300 animate-pulse' : 'text-slate-500'
                }`}>
                  {room.current_token}
                </div>
                <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  isServing ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {room.current_patient_status}
                </span>
              </div>

              {/* Next In Line Tokens */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Next In Queue</span>
                  <span>AI Estimated Wait</span>
                </div>

                {room.next_tokens.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-2">No waiting tokens in queue</div>
                ) : (
                  <div className="space-y-1.5">
                    {room.next_tokens.map((next: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                          next.is_emergency
                            ? 'bg-red-500/20 border-red-500/40 text-red-200 font-bold'
                            : 'bg-slate-900/60 border-slate-800 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-teal-300">{next.token}</span>
                          {next.is_emergency && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500 text-white font-black">
                              EMERGENCY
                            </span>
                          )}
                        </div>
                        <span className="font-medium text-slate-400 font-mono">
                          ~{next.eta_mins} mins
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
