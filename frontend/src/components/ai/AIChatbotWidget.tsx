import React, { useState } from 'react';
import { api } from '../../api/client';
import { Sparkles, Send, X, Bot, User, AlertTriangle, ShieldCheck } from 'lucide-react';

interface AIChatbotWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AIChatbotWidget: React.FC<AIChatbotWidgetProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string; isEmergency?: boolean }>>([
    {
      sender: 'bot',
      text: "Hello! I am the AISCOS Smart Healthcare Assistant. How can I help you today? You can ask about clinic timings, doctor schedules, waiting-time estimates, prescriptions, or billing."
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await api.sendChatMessage(userMsg);
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: res.reply,
          isEmergency: res.is_emergency
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: "I am having trouble connecting to the AISCOS AI engine right now. Please try again or ask reception."
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 glass-panel border border-teal-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[520px] animate-in fade-in slide-in-from-bottom-4 duration-200">
      
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-teal-900/90 to-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-sm text-slate-100">AISCOS Medical Assistant</h3>
            <span className="text-[10px] text-teal-400 font-medium flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Clinical CDS & Admin RAG</span>
            </span>
          </div>
        </div>

        <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex items-start space-x-2 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.sender === 'bot' && (
              <div className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center flex-shrink-0 mt-0.5 border border-teal-500/30">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}
            
            <div
              className={`p-3 rounded-2xl max-w-[80%] ${
                m.sender === 'user'
                  ? 'bg-teal-500 text-slate-950 font-semibold rounded-tr-none shadow-sm'
                  : m.isEmergency
                  ? 'bg-red-500/20 text-red-200 border border-red-500/50 rounded-tl-none'
                  : 'bg-slate-900/80 text-slate-200 border border-slate-800 rounded-tl-none'
              }`}
            >
              {m.text}
            </div>

            {m.sender === 'user' && (
              <div className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center space-x-2 text-slate-400 text-xs pl-8">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce" />
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce delay-100" />
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce delay-200" />
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center space-x-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question or describe symptoms..."
          className="flex-1 glass-input rounded-xl px-3 py-2 text-xs"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="p-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold disabled:opacity-50 transition-all shadow-glow-teal"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

    </div>
  );
};
