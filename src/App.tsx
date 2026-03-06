/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Upload, Sliders, Palette, RefreshCw, Download, Image as ImageIcon, CheckCircle2, AlertCircle, Loader2, X, Trash2, Archive, Plus, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// 1. 初始化环境变量 (确保 Vercel 后台已配置 VITE_GEMINI_API_KEY)
const ai = new GoogleGenAI({ 
  apiKey: import.meta.env.VITE_GEMINI_API_KEY 
});

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 持久化自定义颜色
  useEffect(() => {
    const saved = localStorage.getItem('ai_clothing_custom_colors');
    if (saved) {
      try { setCustomColors(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ai_clothing_custom_colors', JSON.stringify(customColors));
  }, [customColors]);

  const hexColor = `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`.toUpperCase();

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setTasks(prev => [...prev, {
            id: Math.random().toString(36).substring(7),
            original: e.target?.result as string,
            edited: null,
            status: 'idle'
          }]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const processTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === 'processing' || !apiKey) return;

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'processing', error: undefined } : t));

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const base64Data = task.original.split(',')[1];
      const mimeType = task.original.split(',')[0].split(':')[1].split(';')[0];

      const prompt = `Change the clothing color to RGB(${rgb.r}, ${rgb.g}, ${rgb.b}). Maintain all fabric textures and lighting.`;
      
      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Data, mimeType } }
      ]);
      
      const response = await result.response;
      // 注意：此处逻辑需根据 Gemini 图像生成 API 的实际返回格式调整
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'done', edited: task.original } : t));
    } catch (err: any) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error', error: err.message } : t));
    }
  };

  return (
    // 强制全屏容器
    <div className="h-screen w-screen flex flex-col bg-black text-white overflow-hidden font-sans">
      
      {/* 1. 顶部导航 (Header) */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-zinc-950 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500 rounded-lg">
            <Palette className="w-5 h-5 text-black" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">AI 服装变色 SaaS</h1>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-full text-sm font-bold transition-all active:scale-95">
          升级 Pro 方案
        </button>
      </header>

      {/* 2. 主体区域 (Main) */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* 左侧：控制台 (固定宽度 320px) */}
        <aside className="w-80 border-r border-white/10 p-6 overflow-y-auto bg-zinc-950/50 flex flex-col gap-8 shrink-0">
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-bold uppercase tracking-widest opacity-50">颜色设置</h2>
            </div>

            {/* RGB 调节 */}
            <div className="space-y-4">
              {(['r', 'g', 'b'] as const).map(c => (
                <div key={c} className="space-y-2">
                  <div className="flex justify-between text-[10px] font-mono uppercase">
                    <span className="opacity-50">{c === 'r' ? 'Red' : c === 'g' ? 'Green' : 'Blue'}</span>
                    <span>{rgb[c]}</span>
                  </div>
                  <input 
                    type="range" min="0" max="255" value={rgb[c]}
                    onChange={(e) => setRgb(prev => ({ ...prev, [c]: parseInt(e.target.value) }))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              ))}
            </div>

            <div className="h-20 w-full rounded-xl border border-white/20 shadow-inner" style={{ backgroundColor: hexColor }} />
            
            <button 
              onClick={() => tasks.forEach(t => processTask(t.id))}
              disabled={tasks.length === 0}
              className="w-full py-4 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 disabled:opacity-20 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" /> 批量应用颜色
            </button>
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-30">快捷预设</h3>
            <div className="grid grid-cols-6 gap-2">
              {COMMON_COLORS.map(c => (
                <button 
                  key={c.hex} 
                  onClick={() => {
                    const r = parseInt(c.hex.slice(1,3), 16);
                    const g = parseInt(c.hex.slice(3,5), 16);
                    const b = parseInt(c.hex.slice(5,7), 16);
                    setRgb({ r, g, b });
                  }}
                  className="aspect-square rounded-md border border-white/10 hover:scale-110 transition-transform" 
                  style={{ backgroundColor: c.hex }} 
                />
              ))}
            </div>
          </section>
        </aside>

        {/* 右侧：工作台 (自适应填充) */}
        <section className="flex-1 bg-[#050505] p-8 overflow-y-auto relative">
          {tasks.length === 0 ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="h-full w-full border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all cursor-pointer group"
            >
              <div className="p-6 bg-white/5 rounded-full group-hover:scale-110 transition-transform">
                <Upload className="w-10 h-10 opacity-20 group-hover:opacity-100 group-hover:text-emerald-400" />
              </div>
              <p className="text-gray-500 font-medium">点击或拖拽多张图片到此处</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence>
                {tasks.map(task => (
                  <motion.div 
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden relative group"
                  >
                    <div className="aspect-[3/4] bg-black">
                      <img src={task.original} className="w-full h-full object-cover opacity-50" />
                      {task.edited && <img src={task.edited} className="absolute inset-0 w-full h-full object-cover animate-in fade-in duration-500" />}
                    </div>
                    
                    <div className="p-3 flex justify-between items-center bg-black/40 backdrop-blur-md">
                      <span className="text-[10px] font-mono opacity-40 uppercase">状态: {task.status}</span>
                      <button 
                        onClick={() => setTasks(prev => prev.filter(t => t.id !== task.id))}
                        className="p-1 hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {task.status === 'processing' && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-[3/4] border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 opacity-20 hover:opacity-100 hover:border-emerald-500 transition-all"
              >
                <Plus className="w-8 h-8" />
                <span className="text-xs">继续添加</span>
              </button>
            </div>
          )}
        </section>
      </main>

      {/* 隐藏的文件输入框 */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={(e) => handleFiles(e.target.files)} 
        multiple 
        className="hidden" 
        accept="image/*" 
      />
      
      {/* 状态栏 */}
      <footer className="h-10 border-t border-white/5 bg-zinc-950 px-6 flex items-center justify-between shrink-0">
        <p className="text-[10px] opacity-30 uppercase tracking-widest">AI Power Batch Engine • v1.0</p>
        <div className="flex gap-4 text-[10px] opacity-30 uppercase">
          <span>待处理: {tasks.filter(t => t.status === 'idle').length}</span>
          <span className="text-emerald-400">已完成: {tasks.filter(t => t.status === 'done').length}</span>
        </div>
      </footer>
    </div>
  );
}