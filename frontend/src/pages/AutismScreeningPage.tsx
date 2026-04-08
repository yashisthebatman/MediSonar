import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  ImagePlus,
  Loader2,
  RefreshCw,
  ScanFace,
  ShieldAlert,
} from 'lucide-react';

import { predictAutismFromImage, type AutismPredictionResponse } from '../api';

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  facingMode: 'user',
};

export default function AutismScreeningPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [result, setResult] = useState<AutismPredictionResponse | null>(null);
  const [capturedImage, setCapturedImage] = useState('');
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const activeCameraName = useMemo(
    () => devices.find((device) => device.deviceId === selectedDeviceId)?.label || '',
    [devices, selectedDeviceId],
  );

  const stopStream = (targetStream?: MediaStream | null) => {
    targetStream?.getTracks().forEach((track) => track.stop());
  };

  const loadDevices = async () => {
    const mediaDevices = await navigator.mediaDevices.enumerateDevices();
    const cameras = mediaDevices.filter((device) => device.kind === 'videoinput');
    setDevices(cameras);
    if (!selectedDeviceId && cameras[0]?.deviceId) {
      setSelectedDeviceId(cameras[0].deviceId);
    }
  };

  const startCamera = async (deviceId?: string) => {
    try {
      setCameraError('');
      stopStream(stream);
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { ...VIDEO_CONSTRAINTS, deviceId: { exact: deviceId } } : VIDEO_CONSTRAINTS,
        audio: false,
      });
      streamRef.current = nextStream;
      setStream(nextStream);
      if (videoRef.current) {
        videoRef.current.srcObject = nextStream;
      }
      await loadDevices();
    } catch (error) {
      console.error(error);
      setCameraError('Camera access failed. Check browser permissions or choose a different external camera.');
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopStream(streamRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const analyzeImage = async (imageBase64: string, source: 'webcam' | 'upload') => {
    setLoading(true);
    try {
      const response = await predictAutismFromImage(imageBase64, source, activeCameraName);
      setResult(response);
      setCapturedImage(imageBase64);
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'Autism model inference failed.';
      setCameraError(message);
    } finally {
      setLoading(false);
    }
  };

  const captureFrame = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.92);
    await analyzeImage(imageBase64, 'webcam');
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      await analyzeImage(reader.result as string, 'upload');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="custom-scrollbar h-screen overflow-y-auto bg-background text-textMain">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-surface px-6 py-5">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="rounded-xl border border-border p-2 transition-colors hover:bg-surfaceLight">
              <ArrowLeft className="h-5 w-5 text-textMuted" />
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-textMuted">Experimental Vision Module</p>
              <h1 className="mt-1 text-2xl font-semibold">Autism Screening Camera</h1>
            </div>
          </div>
          <div className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs text-amber-300">
            Research demo only, not a diagnosis
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <section className="space-y-5 rounded-3xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-textMuted">Camera Input</p>
                <h2 className="mt-1 text-lg font-medium">Use your laptop webcam or any browser-detected external camera</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => startCamera(selectedDeviceId || undefined)}
                  className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm transition-colors hover:bg-surfaceLight"
                >
                  <RefreshCw className="h-4 w-4" />
                  Restart camera
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm transition-colors hover:bg-surfaceLight"
                >
                  <ImagePlus className="h-4 w-4" />
                  Upload image
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-border bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full object-cover" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedDeviceId}
                onChange={async (event) => {
                  const nextId = event.target.value;
                  setSelectedDeviceId(nextId);
                  await startCamera(nextId);
                }}
                className="min-w-[220px] rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
              >
                {devices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${index + 1}`}
                  </option>
                ))}
              </select>

              <button
                onClick={captureFrame}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                Capture and classify
              </button>

              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            </div>

            <div className="rounded-2xl border border-border bg-background/60 p-4 text-sm text-textMuted">
              <p className="font-medium text-textMain">Photon / external camera note</p>
              <p className="mt-1">
                If your Photon setup appears to the browser as a webcam stream, select it from the camera list above and run the same capture flow.
              </p>
            </div>

            {cameraError && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{cameraError}</span>
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />
          </section>

          <section className="space-y-5">
            <div className="rounded-3xl border border-border bg-surface p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-surfaceLight p-3">
                  <ScanFace className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-textMuted">Inference Output</p>
                  <h2 className="mt-1 text-lg font-medium">Latest classification</h2>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {result ? (
                  <motion.div
                    key={result.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="mt-5 space-y-4"
                  >
                    {capturedImage && (
                      <img src={capturedImage} alt="Captured frame" className="h-48 w-full rounded-2xl object-cover" />
                    )}

                    <div className="rounded-2xl border border-border bg-background p-4">
                      <p className="text-sm text-textMuted">Predicted label</p>
                      <p className="mt-1 text-2xl font-semibold">{result.label}</p>
                      <p className="mt-2 text-sm text-textMuted">Confidence: {result.confidence.toFixed(2)}%</p>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span>Autistic probability</span>
                          <span>{result.autistic_probability.toFixed(2)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-surfaceLight">
                          <div className="h-2 rounded-full bg-rose-400" style={{ width: `${result.autistic_probability}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span>Non-autistic probability</span>
                          <span>{result.non_autistic_probability.toFixed(2)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-surfaceLight">
                          <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${result.non_autistic_probability}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
                      <div className="flex items-start gap-3">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{result.disclaimer}</span>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-5 rounded-2xl border border-dashed border-border p-6 text-sm text-textMuted">
                    Capture a webcam frame or upload a face image to run the model.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="rounded-3xl border border-border bg-surface p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-textMuted">Clinical Safety</p>
              <ul className="mt-3 space-y-3 text-sm text-textMuted">
                <li>This interface runs the provided Kaggle-derived ResNet50 checkpoint as a software demonstration.</li>
                <li>Autism cannot be clinically diagnosed from a single webcam image, so this result must never be treated as medical advice.</li>
                <li>Use this only for model experimentation and consult qualified professionals for any real assessment.</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
