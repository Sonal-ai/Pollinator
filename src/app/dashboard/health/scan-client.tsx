'use client';
import { useEffect, useState } from 'react';
import type { VarroaDetectionResult } from '@/lib/vision-result';
export function ScanClient({ hives=[] }: { hives?: {id:string;deviceId:string}[] }) {
  const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[hiveId,setHiveId]=useState('');
  const [result,setResult]=useState<VarroaDetectionResult|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
  async function submit(event:React.FormEvent) {
    event.preventDefault();if(!file)return;setBusy(true);setError('');setResult(null);
    try {
      if(file.size>4*1024*1024)throw new Error('Choose an image of at most 4 MB.');
      const form=new FormData();form.append('image',file);if(hiveId)form.append('hiveId',hiveId);
      const response=await fetch('/api/detect/varroa',{method:'POST',body:form});const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Image screening unavailable');setResult(data);
    } catch(error){setError(error instanceof Error?error.message:'Image screening unavailable');}finally{setBusy(false);}
  }
  return <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-solid)] p-6 space-y-5">
    <h2 className="text-lg font-bold">Image screening</h2>
    <p className="text-sm text-[var(--text-muted)]">A configured model can mark possible bees and mites. A photograph cannot establish colony health or measure infestation. Results and an image hash are saved; the image is sent to the configured inference service.</p>
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm">Hive (optional)<select value={hiveId} onChange={event=>setHiveId(event.target.value)} className="ml-2 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-solid)] p-2"><option value="">Unassigned image</option>{hives.map(hive=><option key={hive.id} value={hive.id}>{hive.deviceId}</option>)}</select></label>
      <label className="block text-sm">JPG, PNG or WebP · up to 4 MB<input type="file" accept="image/jpeg,image/png,image/webp" required onChange={event=>{const selected=event.target.files?.[0]||null;setFile(selected);setPreview(selected?URL.createObjectURL(selected):'');setResult(null);setError('');}} className="mt-2 block w-full text-sm"/></label>
      {preview && <img src={preview} alt="Selected hive image" className="max-h-56 rounded-lg object-contain"/>}
      <button disabled={!file||busy} className="rounded-xl bg-amber-400 px-4 py-2 font-semibold text-black disabled:opacity-50">{busy?'Requesting analysis…':'Screen this image'}</button>
    </form>
    {error&&<p role="alert" className="text-sm text-red-500">{error}</p>}
    {result&&<div role="status" className="space-y-3 rounded-xl border border-[var(--surface-border)] p-4">
      <h3 className="font-bold">{result.prediction==='uncertain'?'Uncertain image':result.prediction==='varroa_parasite_suspected'?'Possible mites · inspection needed':'No visible mites above display threshold'}</h3>
      <p className="text-sm">{result.alert.message}</p>
      <p className="text-sm">Visible candidates: {result.summary.bee_count} bees · {result.summary.mite_count} mites. {result.summary.low_confidence_count} low-score candidates were omitted from display.</p>
      <p className="text-xs text-[var(--text-muted)]">Model: {result.modelVersion} · {result.latency_ms} ms. Detection scores are not calibrated disease probabilities. No colony infestation percentage or treatment is inferred.</p>
      {result.detections.length>0&&<ul className="max-h-48 overflow-auto space-y-1 text-xs">{result.detections.map((d,index)=><li key={index}>{d.class}: detection score {(d.confidence*100).toFixed(1)}% · box [{d.bbox.x1.toFixed(0)}, {d.bbox.y1.toFixed(0)}, {d.bbox.x2.toFixed(0)}, {d.bbox.y2.toFixed(0)}]</li>)}</ul>}
    </div>}
  </section>;
}
