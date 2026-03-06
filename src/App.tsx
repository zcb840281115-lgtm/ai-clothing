/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Upload, Sliders, Palette, RefreshCw, Download, Image as ImageIcon, CheckCircle2, AlertCircle, Loader2, X, Play, Trash2, Archive, Plus, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Initialize Gemini AI
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

  // Load custom colors from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ai_clothing_custom_colors');
    if (saved) {
      try {
        setCustomColors(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse custom colors', e);
      }
    }
  }, []);

  // Save custom colors to localStorage
  useEffect(() => {
    localStorage.setItem('ai_clothing_custom_colors', JSON.stringify(customColors));
  }, [customColors]);

  const addCustomColor = () => {
    const currentHex = hexColor.toUpperCase();
    if (!customColors.includes(currentHex)) {
      setCustomColors(prev => [currentHex, ...prev].slice(0, 12)); // Keep last 12
    }
  };

  const removeCustomColor = (hex: string) => {
    setCustomColors(prev => prev.filter(c => c !== hex));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    const newTasks: Task[] = [];
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const id = Math.random().toString(36).substring(7);
          setTasks(prev => [...prev, {
            id,
            original: event.target?.result as string,
            edited: null,
            status: 'idle'
          }]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, []);

  const processTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === 'processing') return;

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'processing', error: undefined } : t));

    try {
      const base64Data = task.original.split(',')[1];
      const mimeType = task.original.split(',')[0].split(':')[1].split(';')[0];

      const prompt = `Change the color of the clothes in this image to RGB(${rgb.r}, ${rgb.g}, ${rgb.b}). 
      IMPORTANT: 
      1. ONLY change the color of the clothing items (shirts, pants, dresses, etc.).
      2. Keep all clothing textures, folds, and details exactly as they are.
      3. Do NOT change the person's skin, hair, face, or the background.
      4. The resulting image should look completely natural, as if the person is wearing the same clothes but in the new color.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: mimeType } },
            { text: prompt },
          ],
        },
      });

      let foundImage = false;
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const resultBase64 = part.inlineData.data;
            setTasks(prev => prev.map(t => t.id === taskId ? {
              ...t,
              status: 'done',
              edited: `data:image/png;base64,${resultBase64}`
            } : t));
            foundImage = true;
            break;
          }
        }
      }

      if (!foundImage) throw new Error("AI did not return an image.");

    } catch (err: any) {
      setTasks(prev => prev.map(t => t.id === taskId ? {
        ...t,
        status: 'error',
        error: err.message || "Failed to process"
      } : t));
    }
  };

  const processAll = async () => {
    // Process all tasks that are not currently processing
    const tasksToProcess = tasks.filter(t => t.status !== 'processing');
    if (tasksToProcess.length === 0) return;

    setIsProcessingAll(true);
    // Process in parallel
    await Promise.all(tasksToProcess.map(task => processTask(task.id)));
    setIsProcessingAll(false);
  };

  const downloadAll = async () => {
    const doneTasks = tasks.filter(t => t.status === 'done' && t.edited);
    if (doneTasks.length === 0) return;

    setIsDownloadingAll(true);
    try {
      const zip = new JSZip();
      doneTasks.forEach((task, index) => {
        if (task.edited) {
          const base64Data = task.edited.split(',')[1];
          zip.file(`colorized-clothing-${index + 1}-${task.id}.png`, base64Data, { base64: true });
        }
      });
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'colorized-clothing-batch.zip');
    } catch (err) {
      console.error("Failed to create ZIP:", err);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const clearAll = () => {
    setTasks([]);
  };

  const handleRgbChange = (channel: keyof RGB, value: number) => {
    const sanitizedValue = Math.min(255, Math.max(0, isNaN(value) ? 0 : value));
    setRgb(prev => ({ ...prev, [channel]: sanitizedValue }));
  };

  const handleHexChange = (hex: string) => {
    // Remove # if present
    const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;

    // Support 3-digit hex
    if (cleanHex.length === 3) {
      const r = parseInt(cleanHex[0] + cleanHex[0], 16);
      const g = parseInt(cleanHex[1] + cleanHex[1], 16);
      const b = parseInt(cleanHex[2] + cleanHex[2], 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        setRgb({ r, g, b });
      }
    } else if (cleanHex.length === 6) {
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        setRgb({ r, g, b });
      }
    }
  };

  const hexColor = `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;

  const doneCount = tasks.filter(t => t.status === 'done').length;

  return (
    // 1. 最外层容器：强制 100% 视口高度，黑色背景，禁止溢出滚动
    <div className="h-screen w-screen flex flex-col bg-black text-white overflow-hidden">

      {/* 2. 顶部导航栏 (Header) */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎨</span>
          <h1 className="text-xl font-bold tracking-tight">AI Clothing Colorizer Pro</h1>
        </div>
        {/* 这里可以放你之后的“购买额度”按钮 */}
        <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-full text-sm font-medium transition-colors">
          升级方案
        </button>
      </header>

      {/* 3. 主体区域 (Main)：使用 flex-1 占据剩余所有空间 */}
      <main className="flex-1 flex overflow-hidden">

        {/* 左侧控制面板：固定宽度，如果内容多可独立滚动 */}
        <aside className="w-80 border-r border-gray-800 p-6 overflow-y-auto flex flex-col gap-6 bg-[#050505]">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">控制面板</h2>
          {/* 这里放你的上传按钮、颜色选择器等组件 */}
          <div className="space-y-4">
            {/* 你的上传代码... */}
          </div>
        </aside>

        {/* 右侧预览区：占据剩余全部空间，居中显示图片 */}
        <section className="flex-1 bg-[#0a0a0a] relative flex items-center justify-center p-8">
          <div className="max-w-4xl w-full h-full border-2 border-dashed border-gray-800 rounded-2xl flex items-center justify-center relative overflow-hidden">
            {/* 这里放你的图片预览逻辑... */}
            <p className="text-gray-500">等待上传图片...</p>
          </div>
        </section>

      </main>
    </div>
  );
}

export default App;

<main className="max-w-7xl mx-auto px-6 py-12">
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

    {/* Left Column: Controls */}
    <div className="lg:col-span-4 space-y-6">
      <section className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6 sticky top-24">
        <div className="flex items-center gap-2 mb-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold uppercase tracking-widest opacity-50">Color Controls</h2>
        </div>

        <div className="space-y-6">
          {/* Hex & Color Picker */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-white/50 uppercase tracking-widest">Hex Code / Picker</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  defaultValue={hexColor.toUpperCase()}
                  key={hexColor}
                  onChange={(e) => handleHexChange(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 font-mono text-sm focus:outline-none focus:border-emerald-500/50 transition-colors uppercase"
                  placeholder="#FF0000"
                />
              </div>
              <div className="relative w-12 h-10 shrink-0">
                <input
                  type="color"
                  value={hexColor}
                  onChange={(e) => handleHexChange(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div
                  className="absolute inset-0 rounded-lg border border-white/20 shadow-sm"
                  style={{ backgroundColor: hexColor }}
                />
              </div>
            </div>
          </div>

          {/* Common Colors */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-white/50 uppercase tracking-widest">Common Colors</label>
            <div className="grid grid-cols-6 gap-2">
              {COMMON_COLORS.map((color) => (
                <button
                  key={color.hex}
                  onClick={() => handleHexChange(color.hex)}
                  className={`w-full aspect-square rounded-md border transition-all hover:scale-110 active:scale-95 ${hexColor.toUpperCase() === color.hex ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-white/10'
                    }`}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* My Colors */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-mono text-white/50 uppercase tracking-widest">My Colors</label>
              <button
                onClick={addCustomColor}
                className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Current
              </button>
            </div>
            <div className="grid grid-cols-6 gap-2 min-h-[32px]">
              {customColors.length === 0 ? (
                <div className="col-span-6 border border-dashed border-white/10 rounded-md py-2 text-center">
                  <span className="text-[10px] text-white/20 uppercase tracking-widest">No saved colors</span>
                </div>
              ) : (
                customColors.map((hex) => (
                  <div key={hex} className="relative group/color">
                    <button
                      onClick={() => handleHexChange(hex)}
                      className={`w-full aspect-square rounded-md border transition-all hover:scale-110 active:scale-95 ${hexColor.toUpperCase() === hex ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-white/10'
                        }`}
                      style={{ backgroundColor: hex }}
                      title={hex}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); removeCustomColor(hex); }}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover/color:opacity-100 transition-opacity z-10"
                    >
                      <Minus className="w-2.5 h-2.5 text-white" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RGB Sliders */}
          {(['r', 'g', 'b'] as const).map(channel => (
            <div key={channel} className="space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className={channel === 'r' ? 'text-red-400' : channel === 'g' ? 'text-green-400' : 'text-blue-400'}>
                  {channel === 'r' ? 'RED' : channel === 'g' ? 'GREEN' : 'BLUE'}
                </span>
                <input
                  type="number" min="0" max="255" value={rgb[channel]}
                  onChange={(e) => handleRgbChange(channel, parseInt(e.target.value))}
                  className="w-16 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-right focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <input
                type="range" min="0" max="255" value={rgb[channel]}
                onChange={(e) => handleRgbChange(channel, parseInt(e.target.value))}
                className={`w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-${channel === 'r' ? 'red' : channel === 'g' ? 'green' : 'blue'}-500`}
              />
            </div>
          ))}

          {/* Preview Box */}
          <div className="pt-4">
            <div
              className="w-full h-20 rounded-xl border border-white/20 shadow-inner flex items-center justify-center transition-colors duration-200"
              style={{ backgroundColor: hexColor }}
            >
              <span className="text-xs font-mono mix-blend-difference text-white uppercase tracking-widest">
                Target Color
              </span>
            </div>
          </div>
        </div>

        <div className="pt-4 space-y-3">
          <button
            onClick={processAll}
            disabled={tasks.length === 0 || isProcessingAll}
            className={`w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${tasks.length === 0 || isProcessingAll
              ? 'bg-white/10 text-white/30 cursor-not-allowed'
              : 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
              }`}
          >
            {isProcessingAll ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Updating Colors...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Apply Color to All
              </>
            )}
          </button>

          {doneCount > 0 && (
            <button
              onClick={downloadAll}
              disabled={isDownloadingAll}
              className="w-full py-4 rounded-xl font-semibold bg-white/10 text-white hover:bg-white/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              {isDownloadingAll ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Archive className="w-5 h-5" />
                  Download All ({doneCount})
                </>
              )}
            </button>
          )}

          {tasks.length > 0 && (
            <button
              onClick={clearAll}
              className="w-full py-3 rounded-xl font-medium text-xs uppercase tracking-widest text-white/40 hover:text-white/80 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Clear All
            </button>
          )}
        </div>
      </section>
    </div>

    {/* Right Column: Task Grid */}
    <div className="lg:col-span-8 space-y-8">
      {tasks.length === 0 ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className="aspect-video rounded-3xl border-2 border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center gap-6 cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group"
        >
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Upload className="w-10 h-10 opacity-30 group-hover:opacity-100 group-hover:text-emerald-400 transition-all" />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium">Upload Multiple Images</p>
            <p className="text-sm opacity-40 mt-1">Drag and drop or click to select files</p>
          </div>
          <input
            type="file" ref={fileInputRef} onChange={handleImageUpload}
            accept="image/*" multiple className="hidden"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence>
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden group relative"
              >
                {/* Task Header */}
                <div className="absolute top-3 left-3 right-3 z-10 flex justify-between items-center">
                  <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest backdrop-blur-md border ${task.status === 'done' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' :
                    task.status === 'processing' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' :
                      task.status === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-400' :
                        'bg-black/40 border-white/10 text-white/60'
                    }`}>
                    {task.status}
                  </div>
                  <button
                    onClick={() => removeTask(task.id)}
                    className="w-7 h-7 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-red-500/50 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Image Display */}
                <div className="aspect-[4/5] relative bg-black/20">
                  <div className="absolute inset-0 grid grid-cols-2 gap-[1px] bg-white/5">
                    <div className="relative overflow-hidden">
                      <img src={task.original} alt="Original" className="w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" />
                      <div className="absolute bottom-2 left-2 text-[8px] uppercase tracking-widest bg-black/60 px-1.5 py-0.5 rounded">Original</div>
                    </div>
                    <div className="relative overflow-hidden bg-black/40 flex items-center justify-center">
                      {task.edited ? (
                        <img src={task.edited} alt="Edited" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 opacity-20">
                          {task.status === 'processing' ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImageIcon className="w-6 h-6" />}
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 text-[8px] uppercase tracking-widest bg-emerald-500/60 px-1.5 py-0.5 rounded">Result</div>
                    </div>
                  </div>

                  {/* Overlay for processing/error */}
                  {task.status === 'processing' && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                        <span className="text-xs font-mono uppercase tracking-widest animate-pulse">Processing...</span>
                      </div>
                    </div>
                  )}

                  {task.status === 'error' && (
                    <div className="absolute inset-0 bg-red-500/10 backdrop-blur-[2px] flex items-center justify-center p-6 text-center">
                      <div className="flex flex-col items-center gap-2 text-red-400">
                        <AlertCircle className="w-8 h-8" />
                        <span className="text-xs font-medium">{task.error}</span>
                        <button
                          onClick={() => processTask(task.id)}
                          className="mt-2 px-4 py-1.5 bg-red-500 text-white rounded-lg text-[10px] uppercase font-bold"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Task Actions */}
                <div className="p-3 bg-white/5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {task.status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    <span className="text-[10px] font-mono opacity-40">ID: {task.id}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {task.status !== 'processing' && (
                      <button
                        onClick={() => processTask(task.id)}
                        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors"
                        title="Regenerate with current color"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> {task.status === 'idle' ? 'Start' : 'Regenerate'}
                      </button>
                    )}
                    {task.status === 'done' && task.edited && (
                      <a
                        href={task.edited} download={`result-${task.id}.png`}
                        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Add More Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="aspect-[4/5] rounded-2xl border-2 border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center gap-3 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group"
          >
            <Upload className="w-8 h-8 opacity-20 group-hover:opacity-100 group-hover:text-emerald-400 transition-all" />
            <span className="text-xs font-medium opacity-40 group-hover:opacity-100">Add More</span>
          </button>
        </div>
      )}

      {/* Batch Instructions */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-emerald-400" />
          Continuous Iteration
        </h3>
        <p className="text-xs opacity-50 leading-relaxed mb-4">
          You can continuously change the color of your batch. Adjust the RGB values and click "Apply Color to All" to re-process the images with the new settings.
        </p>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] opacity-60 leading-relaxed">
          <li className="flex gap-2">
            <span className="text-emerald-400 font-bold">01</span>
            Adjust colors anytime - results update in place.
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400 font-bold">02</span>
            Use "Apply Color to All" to refresh the entire gallery.
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400 font-bold">03</span>
            Use "Download All" to get a ZIP of all successful edits.
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400 font-bold">04</span>
            The AI always uses the original photo to maintain quality.
          </li>
        </ul>
      </div>
    </div>

  </div>
</main>

{/* Footer */ }
<><footer className="border-t border-white/10 py-8 mt-12">
  <div className="max-w-7xl mx-auto px-6 text-center">
    <p className="text-xs opacity-40 uppercase tracking-[0.2em]">
      Continuous AI Iteration &bull; Batch ZIP Export
    </p>
  </div>
<div className="text-center">
            <p className="text-lg font-medium">Upload Multiple Images</p>
            <p className="text-sm opacity-40 mt-1">Drag and drop or click to select files</p>
          </div>
          <input
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload}
            accept="image/*"
            multiple
            className="hidden"
          />
        </div> 
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">