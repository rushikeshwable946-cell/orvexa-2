import { useState, useEffect } from 'react';
import {
  Video, Sparkles, Download, RefreshCw, AlertCircle, Upload, Check,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useCreation } from '@/context/CreationContext';
import { supabase } from '@/lib/supabase';
import type { Generation } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/Feedback';

const videoDurations = [
  { value: '3', label: '3 seconds' },
  { value: '5', label: '5 seconds' },
  { value: '10', label: '10 seconds' },
];

const videoAspectRatios = [
  { value: '16:9', label: '16:9 Widescreen' },
  { value: '9:16', label: '9:16 Vertical' },
  { value: '1:1', label: '1:1 Square' },
  { value: '4:3', label: '4:3 Classic' },
];

const videoResolutions = [
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p HD' },
  { value: '4k', label: '4K' },
];

const cameraMovements = [
  { value: '', label: 'No movement' },
  { value: 'zoom-in', label: 'Zoom In' },
  { value: 'zoom-out', label: 'Zoom Out' },
  { value: 'pan-left', label: 'Pan Left' },
  { value: 'pan-right', label: 'Pan Right' },
  { value: 'tilt-up', label: 'Tilt Up' },
  { value: 'tilt-down', label: 'Tilt Down' },
  { value: 'orbit', label: 'Orbit' },
];

const CREDITS_PER_VIDEO = 10;

export function VideoGenerator() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { pending, clearPending } = useCreation();
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [duration, setDuration] = useState('5');
  const [resolution, setResolution] = useState('1080p');
  const [cameraMovement, setCameraMovement] = useState('');
  const [mode, setMode] = useState<'text-to-video' | 'image-to-video'>('text-to-video');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [jobs, setJobs] = useState<Generation[]>([]);

  useEffect(() => {
    if (pending) {
      setPrompt(pending.prompt || '');
      if (pending.aspectRatio) setAspectRatio(pending.aspectRatio);
      clearPending();
    }
  }, [pending, clearPending]);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Please select an image file.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSourceImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function generate() {
    if (!prompt.trim()) {
      toast('Please enter a prompt.', 'warning');
      return;
    }
    if (mode === 'image-to-video' && !sourceImage) {
      toast('Please upload a source image.', 'warning');
      return;
    }
    if (!user) return;
    if ((profile?.credits_balance ?? 0) < CREDITS_PER_VIDEO) {
      toast(`You need ${CREDITS_PER_VIDEO} credits. You have ${profile?.credits_balance ?? 0}.`, 'error');
      return;
    }

    setGenerating(true);

    const newJob: Generation = {
      id: crypto.randomUUID(),
      user_id: user.id,
      type: 'video',
      prompt: prompt.trim(),
      negative_prompt: null,
      model: 'video-default',
      aspect_ratio: aspectRatio,
      resolution,
      style_preset: null,
      num_images: 1,
      status: 'processing',
      result_url: null,
      result_urls: null,
      thumbnail_url: null,
      error_message: null,
      provider_job_id: null,
      metadata: { duration, cameraMovement, mode },
      credits_used: CREDITS_PER_VIDEO,
      is_favorite: false,
      created_at: new Date().toISOString(),
      completed_at: null,
    };

    const { data: insertedRow, error: insertError } = await supabase.from('generations').insert({
      user_id: user.id,
      type: 'video',
      prompt: prompt.trim(),
      aspect_ratio: aspectRatio,
      resolution,
      status: 'processing',
      credits_used: CREDITS_PER_VIDEO,
      metadata: { duration, cameraMovement, mode },
    }).select().single();

    if (insertError || !insertedRow) {
      toast('Failed to save video job.', 'error');
      setGenerating(false);
      return;
    }

    const dbRowId = (insertedRow as { id: string }).id;
    setJobs((prev) => [{ ...newJob, id: dbRowId }, ...prev]);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          aspectRatio,
          duration,
          resolution,
          cameraMovement: cameraMovement || undefined,
          mode,
          sourceImage: sourceImage || undefined,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Request failed (${response.status})`);
      }

      const data = await response.json();
      const videoUrl = data.videoUrl ?? data.url;

      if (!videoUrl) {
        throw new Error('No video URL returned by provider.');
      }

      setJobs((prev) => prev.map((j) => (j.id === dbRowId ? {
        ...j,
        status: 'completed',
        result_url: videoUrl,
        thumbnail_url: data.thumbnailUrl,
        completed_at: new Date().toISOString(),
      } : j)));

      await supabase
        .from('generations')
        .update({ status: 'completed', result_url: videoUrl, completed_at: new Date().toISOString() })
        .eq('id', dbRowId);

      toast('Video generated successfully!', 'success');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Generation failed.';
      setJobs((prev) => prev.map((j) => (j.id === dbRowId ? { ...j, status: 'failed', error_message: errorMsg } : j)));

      await supabase
        .from('generations')
        .update({ status: 'failed', error_message: errorMsg })
        .eq('id', dbRowId);

      toast(`Video generation failed: ${errorMsg}. Make sure an AI provider is configured.`, 'error');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Video className="h-6 w-6 text-[var(--accent)]" />
          Video Generator
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Create videos from text descriptions or animate static images.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
        <div className="card p-5 space-y-4 lg:sticky lg:top-0 lg:self-start">
          <div>
            <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('text-to-video')}
                className={`flex-1 rounded-lg border py-2 text-sm transition-all ${mode === 'text-to-video' ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-secondary)]'}`}
              >
                Text to Video
              </button>
              <button
                onClick={() => setMode('image-to-video')}
                className={`flex-1 rounded-lg border py-2 text-sm transition-all ${mode === 'image-to-video' ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-secondary)]'}`}
              >
                Image to Video
              </button>
            </div>
          </div>

          {mode === 'image-to-video' && (
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Source Image</label>
              <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border-strong)] py-6 cursor-pointer hover:border-[var(--accent)] transition-all">
                {sourceImage ? (
                  <img src={sourceImage} alt="Source" className="max-h-32 rounded-lg" />
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-[var(--text-tertiary)]" />
                    <span className="text-xs text-[var(--text-secondary)]">Upload image</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the video you want to create..."
              rows={4}
              className="input resize-none"
            />
          </div>

          <Select label="Aspect Ratio" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} options={videoAspectRatios} />
          <Select label="Duration" value={duration} onChange={(e) => setDuration(e.target.value)} options={videoDurations} />
          <Select label="Resolution" value={resolution} onChange={(e) => setResolution(e.target.value)} options={videoResolutions} />
          <Select label="Camera Movement" value={cameraMovement} onChange={(e) => setCameraMovement(e.target.value)} options={cameraMovements} />

          <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)] pt-2 border-t border-[var(--border)]">
            <span>Cost: {CREDITS_PER_VIDEO} credits</span>
            <span>Balance: {profile?.credits_balance ?? 0}</span>
          </div>

          <Button className="w-full" size="lg" onClick={generate} loading={generating} disabled={!prompt.trim()}>
            <Sparkles className="h-5 w-5" />
            {generating ? 'Generating...' : 'Generate Video'}
          </Button>
        </div>

        <div className="space-y-6">
          {jobs.length === 0 ? (
            <EmptyState
              icon={<Video className="h-12 w-12" />}
              title="No videos yet"
              description="Enter a prompt and click Generate to create your first video."
            />
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="card p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{job.prompt}</p>
                </div>

                {job.status === 'processing' ? (
                  <div className="flex flex-col items-center gap-4 py-12">
                    <div className="shimmer rounded-xl w-full max-w-md" style={{ aspectRatio: '16/9' }} />
                    <p className="text-sm text-[var(--text-tertiary)] flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin-slow" />
                      Generating video... This may take a few minutes.
                    </p>
                  </div>
                ) : job.status === 'failed' ? (
                  <div className="rounded-lg border border-[var(--error)]/30 bg-[var(--error)]/10 p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-[var(--error)] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-[var(--error)] font-medium">Generation failed</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">{job.error_message}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl overflow-hidden bg-black">
                      <video src={job.result_url ?? ''} controls className="w-full" />
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
                        <span className="flex items-center gap-1"><Check className="h-3 w-3 text-[var(--success)]" /> Completed</span>
                        <span>{job.aspect_ratio}</span>
                        <span>{job.resolution}</span>
                        <span>{job.credits_used} credits</span>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => window.open(job.result_url!, '_blank')}>
                        <Download className="h-4 w-4" /> Download
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
