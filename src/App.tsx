/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Upload, Sliders, RefreshCw, Download, Image as ImageIcon, CheckCircle2, AlertCircle, Loader2, X, Trash2, Archive, Plus, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Initialize Gemini AI
const ai = new GoogleGenAI(import.meta.env.VITE_GEMINI_API_KEY);

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface Task {
  id: string;
  original: string;
  edited: string | null;
  status: 'idle' | 'processing' | 'done' | 'error';
  error?: string;
}

const COMMON_COLORS = [
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Black', hex: '#000000' },
  { name: 'Red', hex: '#FF0000' },
  { name: 'Blue', hex: '#0000FF' },
  { name: 'Green', hex: '#00FF00' },
  { name: 'Yellow', hex: '#FFFF00' },
  { name: 'Orange', hex: '#FFA500' },
  { name: 'Purple', hex: '#800080' },
  { name: 'Pink', hex: '#FFC0CB' },
  { name: 'Navy', hex: '#000080' },
  { name: 'Gray', hex: '#808080' },
  { name: 'Emerald', hex: '#10B981' },
];

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rgb, setRgb] = useState<RGB>({ r: 255, g: 0, b: 0 });
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [customColors, setCustomColors] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('ai_clothing_custom_colors');
    if (saved) {
      try { setCustomColors(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ai_clothing_custom_colors', JSON.stringify(customColors));
  }, [customColors]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const id = Math.random().toString(36).substring(7);
          setTasks(prev => [...prev, { id, original: e.target?.result as string, edited: null, status: 'idle' }]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const processTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'processing' } : t));
    try {
      const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
      const base64Data = task.original.split(',')[1];
      const prompt = `Change clothing color to RGB(${rgb.r}, ${rgb.g}, ${rgb.b}). Keep textures.`;
      const result = await model.generateContent([prompt, { inlineData: { data: base64Data, mimeType: "image/png" } }]);
      const edited = `data:image/png;base64,${result.response.text()}`; // 简化逻辑
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'done', edited } : t));
    } catch (err) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error', error: 'Failed' } : t));
    }
  };

  const hexColor = `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;

  return (
    <div className="h-screen w-screen flex flex-col bg-black text-white overflow-hidden">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎨</span>
          <h1 className="text-xl font-bold tracking-tight">AI Clothing Colorizer Pro</h1>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-full text-sm font-medium transition-colors">
          升级方案
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar Controls */}
        <aside className="w-80 border-r border-gray-800 p-6 overflow-y-auto flex flex-col gap-6 bg-[#050505]">
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-semibold uppercase tracking-widest opacity-50">Color Controls</h2>
            </div>

            {/* RGB Sliders */}
            {(['r', 'g', 'b'] as const).map(channel => (
              <div key={channel} className="space-y-2">
                <div className="flex justify-between text-xs font-mono uppercase">
                  <span>{channel}</span>
                  <span>{rgb[channel]}</span>
                </div>
                <input
                  type="range" min="0" max="255" value={rgb[channel]}
                  onChange={(e) => setRgb(prev => ({ ...prev, [channel]: parseInt(e.target.value) }))}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            ))}

            <div className="w-full h-20 rounded-xl border border-white/20" style={{ backgroundColor: hexColor }} />
            
            <button 
              onClick={() => tasks.forEach(t => processTask(t.id))}
              className="w-full py-4 bg-emerald-500 text-black rounded-xl font-bold hover:bg-emerald-400 transition-all"
            >
              Apply to All
            </button>
          </section>
        </aside>

        {/* Image Grid Area */}
        <section className="flex-1 bg-[#0a0a0a] overflow-y-auto p-8">
          {tasks.length === 0 ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="h-full w-full border-2 border-dashed border-gray-800 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all"
            >
              <Upload className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-gray-500">Click or Drag to Upload Images</p>
              <input type="file" ref={fileInputRef} onChange={(e) => handleFiles(e.target.files)} multiple className="hidden" accept="image/*" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {tasks.map(task => (
                  <motion.div key={task.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden relative group">
                    <img src={task.original} className="w-full aspect-[4/5] object-cover opacity-50" />
                    {task.edited && <img src={task.edited} className="absolute inset-0 w-full h-full object-cover" />}
                    <div className="p-3 flex justify-between items-center">
                      <span className="text-[10px] opacity-40">Status: {task.status}</span>
                      <button onClick={() => setTasks(prev => prev.filter(t => t.id !== task.id))}>
                        <X className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-[4/5] border-2 border-dashed border-gray-800 rounded-2xl flex items-center justify-center hover:bg-white/5"
              >
                <Plus className="opacity-20" />
              </button>
            </div>
          )}
        </section>
      </main>
      
      <footer className="h-10 border-t border-white/10 flex items-center justify-center">
         <p className="text-[10px] text-gray-600 uppercase tracking-widest">AI Power Batch Processing • Vercel Deployed</p>
      </footer>
    </div>
  );
}