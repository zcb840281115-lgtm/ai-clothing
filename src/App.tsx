import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Upload, Sliders, RefreshCw, X, Plus } from 'lucide-react';

const genAI = new GoogleGenAI(import.meta.env.VITE_GEMINI_API_KEY || "dummy_key");

export default function App() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [rgb, setRgb] = useState({ r: 255, g: 0, b: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTasks(prev => [...prev, { id: Math.random().toString(36), original: e.target?.result, status: 'idle' }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const hexColor = `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;

  return (
    <div className="h-screen w-screen flex flex-col bg-black text-white overflow-hidden font-sans">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-gray-800 shrink-0">
        <h1 className="text-xl font-bold text-emerald-400">AI Clothing Colorizer</h1>
        <button className="bg-blue-600 px-4 py-2 rounded-full text-sm">Upgrade Pro</button>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 border-r border-gray-800 p-6 flex flex-col gap-6 bg-zinc-950">
          <div className="space-y-4">
            <label className="text-xs uppercase tracking-widest opacity-50">Target Color</label>
            <div className="h-24 rounded-2xl border border-white/20 shadow-lg" style={{ backgroundColor: hexColor }} />
            {['r', 'g', 'b'].map((c: any) => (
              <input 
                key={c} type="range" min="0" max="255" 
                value={(rgb as any)[c]} 
                onChange={(e) => setRgb(prev => ({ ...prev, [c]: parseInt(e.target.value) }))}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            ))}
          </div>
          <button className="w-full py-4 bg-emerald-500 text-black rounded-xl font-bold">Apply Color to All</button>
        </aside>

        {/* Content Area */}
        <section className="flex-1 bg-black p-8 overflow-y-auto">
          {tasks.length === 0 ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="h-full border-2 border-dashed border-gray-800 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all"
            >
              <Upload className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-gray-500">Click to Upload Images</p>
              <input type="file" ref={fileInputRef} onChange={(e) => handleFiles(e.target.files)} multiple className="hidden" accept="image/*" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {tasks.map(task => (
                <div key={task.id} className="aspect-[3/4] bg-zinc-900 rounded-2xl relative overflow-hidden group">
                  <img src={task.original} className="w-full h-full object-cover opacity-60" />
                  <button 
                    onClick={() => setTasks(prev => prev.filter(t => t.id !== task.id))}
                    className="absolute top-2 right-2 p-1 bg-black/50 rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-[3/4] border-2 border-dashed border-gray-800 rounded-2xl flex items-center justify-center cursor-pointer hover:bg-white/5"
              >
                <Plus className="opacity-20" />
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}