'use client';

import React, { useState, useRef } from 'react';
import { Upload, Sparkles, CheckCircle2, AlertTriangle, AlertOctagon, Loader2, Camera } from 'lucide-react';

interface Detection {
  class: 'bee' | 'varroa';
  class_id: number;
  confidence: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
}

interface ScanResult {
  success: boolean;
  latency_ms: number;
  summary: {
    bee_count: number;
    mite_count: number;
    total: number;
  };
  alert: {
    level: 'GREEN' | 'YELLOW' | 'RED';
    infestation_rate_pct: number;
    message: string;
  };
  detections: Detection[];
}

export function ScanClient() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setResult(null);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('/api/detect/varroa', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze hive photo');
      }

      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-[#0d111a]/80 backdrop-blur-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-amber-400" />
            Live AI Vision Diagnostic Tester
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Upload or snap a frame photo to run real-time YOLO11l Varroa detection on AWS Lambda.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>AWS Lambda: ONNX Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Box */}
        <div className="space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[260px] ${
              previewUrl
                ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-400'
                : 'border-white/15 bg-black/30 hover:border-white/30 hover:bg-white/[0.02]'
            }`}
          >
            {previewUrl ? (
              <div className="space-y-3 w-full flex flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Frame preview"
                  className="max-h-52 rounded-xl object-contain shadow-lg border border-white/10"
                />
                <p className="text-xs text-slate-400 font-mono">
                  {file?.name} ({(file!.size / (1024 * 1024)).toFixed(2)} MB) • Click to replace
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-200">
                  Click or drag photo of brood comb / bees
                </p>
                <p className="text-xs text-slate-500 max-w-xs">
                  Supports JPG, PNG, WebP up to 10MB. Clear macro shots deliver highest mite detection accuracy.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className={`w-full py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg ${
              !file || loading
                ? 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-amber-500/20 active:scale-[0.99]'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running YOLO11l on AWS Lambda...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Scan Image for Varroa Mites</span>
              </>
            )}
          </button>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Diagnostic Results Box */}
        <div className="space-y-4">
          {result ? (
            <div className="space-y-4 animate-fadeIn">
              {/* Alert Status Banner */}
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                  result.alert.level === 'RED'
                    ? 'bg-red-500/15 border-red-500/30 text-red-300'
                    : result.alert.level === 'YELLOW'
                    ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-300'
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                }`}
              >
                {result.alert.level === 'RED' ? (
                  <AlertOctagon className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                ) : result.alert.level === 'YELLOW' ? (
                  <AlertTriangle className="w-6 h-6 text-yellow-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm tracking-tight">
                      {result.alert.level === 'RED'
                        ? 'CRITICAL INFESTATION'
                        : result.alert.level === 'YELLOW'
                        ? 'MODERATE INFESTATION'
                        : 'HEALTHY COLONY'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/30">
                      {result.alert.infestation_rate_pct}% Mite Ratio
                    </span>
                  </div>
                  <p className="text-xs opacity-90 leading-relaxed">
                    {result.alert.message}
                  </p>
                </div>
              </div>

              {/* Stats Counters */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-slate-500 font-bold">
                    Bees Counted
                  </span>
                  <p className="text-xl font-mono font-extrabold text-white">
                    {result.summary.bee_count}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-slate-500 font-bold">
                    Varroa Mites
                  </span>
                  <p
                    className={`text-xl font-mono font-extrabold ${
                      result.summary.mite_count > 0 ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    {result.summary.mite_count}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-slate-500 font-bold">
                    Lambda Latency
                  </span>
                  <p className="text-xl font-mono font-extrabold text-cyan-400">
                    {result.latency_ms} ms
                  </p>
                </div>
              </div>

              {/* Detections List */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2.5 max-h-56 overflow-y-auto">
                <p className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Detections ({result.detections.length})
                </p>
                {result.detections.length === 0 ? (
                  <p className="text-xs text-slate-500">No bees or mites detected in frame.</p>
                ) : (
                  <div className="space-y-1.5">
                    {result.detections.map((det, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white/[0.02] border border-white/5 font-mono"
                      >
                        <span
                          className={`font-semibold ${
                            det.class === 'varroa' ? 'text-red-400' : 'text-amber-400'
                          }`}
                        >
                          {det.class === 'varroa' ? '🔬 Varroa Mite' : '🐝 Honey Bee'}
                        </span>
                        <div className="flex items-center gap-3 text-slate-400">
                          <span>Conf: {(det.confidence * 100).toFixed(1)}%</span>
                          <span className="text-[10px] text-slate-600">
                            [{det.bbox.x1.toFixed(0)}, {det.bbox.y1.toFixed(0)}]
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/5 bg-black/20 p-12 text-center text-slate-500 space-y-3 min-h-[260px] flex flex-col items-center justify-center">
              <Sparkles className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="text-sm font-bold text-slate-400">Awaiting Image Scan</h4>
              <p className="text-xs text-slate-600 max-w-xs">
                Upload a hive frame photograph on the left to trigger the YOLO11 model and display instant Varroa detection telemetry.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
