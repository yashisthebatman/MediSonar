import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ChevronLeft,
  ImagePlus,
  Loader2,
  RefreshCw,
  ScanFace,
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
      setCameraError('Camera access denied. Please check permissions.');
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
      const message = error?.response?.data?.detail || 'Analysis could not be completed.';
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
    <div className="flex h-screen w-screen bg-background font-sans text-textMain selection:bg-primary/20 overflow-hidden">
      
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="glass-header flex items-center justify-between px-4 sm:px-8 py-3">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-primary hover:opacity-80 transition-opacity font-medium">
             <ChevronLeft className="w-5 h-5 -ml-1.5" strokeWidth={2.5} />
             <span className="hidden sm:inline">Back</span>
          </button>
          
          <h2 className="font-semibold absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
             Vision Checkpoint
          </h2>

          <div className="w-[60px]" /> {/* Spacer for centering */}
        </header>

        {/* Content */}
        <main className="custom-scrollbar flex-1 overflow-y-auto px-4 sm:px-8 pb-12 pt-6">
          <div className="max-w-5xl mx-auto grid gap-8 lg:grid-cols-[1.5fr_1fr]">
            
            {/* Left Column: Camera View */}
            <section className="space-y-6">
              
              <div className="relative rounded-[24px] overflow-hidden bg-black shadow-apple border border-black/[0.04] aspect-[4/3] sm:aspect-video flex items-center justify-center group">
                 {/* Top floating controls */}
                 <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black/40 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-2 text-white text-[13px] font-medium">
                       <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                       Sensor Live
                    </div>

                    <button
                      onClick={() => startCamera(selectedDeviceId || undefined)}
                      className="bg-black/40 backdrop-blur-md text-white rounded-full p-2 hover:bg-black/60 transition-colors"
                      title="Reset Camera"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                 </div>

                 {/* Video Stream */}
                 <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

                 {/* Bottom Floating Controls (Camera shutter style) */}
                 <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-6 z-10">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-black/30 backdrop-blur-md border border-white/20 text-white rounded-full p-4 hover:bg-black/50 transition-colors active:scale-95"
                    >
                      <ImagePlus className="h-5 w-5" />
                    </button>

                    <button
                      onClick={captureFrame}
                      disabled={loading}
                      className="w-[72px] h-[72px] rounded-full border-[4px] border-white/40 flex items-center justify-center group/shutter hover:border-white/60 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                       <div className={`w-[56px] h-[56px] rounded-full bg-white transition-all ${loading ? 'scale-75 opacity-80 flex items-center justify-center' : 'group-active/shutter:scale-90 group-hover/shutter:opacity-90'}`}>
                          {loading && <Loader2 className="h-6 w-6 text-black animate-spin" />}
                       </div>
                    </button>

                    <div className="w-[52px] h-[52px]" /> {/* Spacer to balance */}
                 </div>
              </div>

              {/* Camera Picker Below */}
              <div className="flex items-center gap-4 px-2">
                 <select
                  value={selectedDeviceId}
                  onChange={async (event) => {
                    const nextId = event.target.value;
                    setSelectedDeviceId(nextId);
                    await startCamera(nextId);
                  }}
                  className="bg-surface border border-black/[0.04] rounded-[14px] px-4 py-2.5 text-[15px] font-medium outline-none text-textMain cursor-pointer flex-1 shadow-sm focus:border-primary/50"
                 >
                  {devices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${index + 1}`}
                    </option>
                  ))}
                 </select>
              </div>

              {cameraError && (
                <div className="flex items-center gap-3 bg-red-50 text-destructive p-4 rounded-[16px] text-[14px] font-medium">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}

              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              <canvas ref={canvasRef} className="hidden" />
            </section>

            {/* Right Column: Analysis Panel */}
            <section className="space-y-6">
              
              <div className="cupertino-card h-full flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-primary/10 text-primary p-2 rounded-xl">
                    <ScanFace className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <div>
                     <h2 className="text-xl font-semibold">Diagnosis Result</h2>
                     <p className="text-[14px] text-textMuted font-medium tracking-tight">AI Confidence Mapping</p>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {result ? (
                    <motion.div
                      key={result.label}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="flex-1 flex flex-col"
                    >
                      {capturedImage && (
                        <div className="rounded-[16px] overflow-hidden mb-6 shadow-sm border border-black/[0.04]">
                           <img src={capturedImage} alt="Captured frame" className="h-32 w-full object-cover" />
                        </div>
                      )}

                      <div className="bg-surfaceLight rounded-[16px] p-5 mb-6 text-center border border-black/[0.02]">
                         <p className="text-[13px] font-medium text-textMuted mb-1">Primary Indicator</p>
                         <p className={`text-4xl font-semibold tracking-tight ${result.label === 'Autistic' ? 'text-primary' : 'text-textMain'}`}>
                           {result.label}
                         </p>
                         <div className="mt-4 inline-flex items-center gap-1.5 bg-white px-3 py-1 rounded-full shadow-sm text-[13px] font-semibold text-textMain border border-black/[0.04]">
                            Confidence Score <span className="text-primary ml-1">{result.confidence.toFixed(2)}%</span>
                         </div>
                      </div>

                      <div className="space-y-4 mb-6">
                         <div className="bg-surfaceLight p-4 rounded-[16px] border border-black/[0.02]">
                           <div className="flex justify-between items-center mb-2">
                             <span className="text-[14px] font-medium text-textMain">Autistic Pattern Matching</span>
                             <span className="text-[14px] font-semibold text-primary">{result.autistic_probability.toFixed(1)}%</span>
                           </div>
                           <div className="h-2 bg-black/[0.06] rounded-full overflow-hidden">
                             <motion.div 
                               initial={{ width: 0 }} 
                               animate={{ width: `${result.autistic_probability}%` }} 
                               transition={{ duration: 1, ease: "easeOut" }}
                               className="h-full bg-primary rounded-full shadow-[0_0_8px_rgba(0,102,204,0.4)]"
                             />
                           </div>
                         </div>
                         
                         <div className="bg-surfaceLight p-4 rounded-[16px] border border-black/[0.02]">
                           <div className="flex justify-between items-center mb-2">
                             <span className="text-[14px] font-medium text-textMain">Neurotypical Baseline</span>
                             <span className="text-[14px] font-medium text-textMuted">{result.non_autistic_probability.toFixed(1)}%</span>
                           </div>
                           <div className="h-2 bg-black/[0.06] rounded-full overflow-hidden">
                             <motion.div 
                               initial={{ width: 0 }} 
                               animate={{ width: `${result.non_autistic_probability}%` }} 
                               transition={{ duration: 1, ease: "easeOut" }}
                               className="h-full bg-textMuted/40 rounded-full" 
                             />
                           </div>
                         </div>
                      </div>

                      <div className="mt-auto bg-amber-50 text-amber-600 p-4 rounded-[16px] text-[13px] font-medium leading-relaxed">
                          <span className="font-semibold block mb-1">Disclaimer</span>
                          {result.disclaimer}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-black/[0.06] rounded-[20px] p-8 text-center bg-surfaceLight/50">
                      <ScanFace className="w-12 h-12 text-textMuted/30 mb-4" />
                      <p className="text-[15px] font-medium text-textMuted max-w-[200px]">
                          Capture a frame using the camera to begin analysis.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </section>

          </div>
        </main>

      </div>
    </div>
  );
}
