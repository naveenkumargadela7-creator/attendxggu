import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadFaceDetectionModels } from "@/utils/faceDetection";
import { Camera, TickCircle, CloseCircle, ArrowLeft2 } from "iconsax-react";

export type CaptureAngle = "front" | "left" | "right" | "tilt";

export function GuidedFaceCapture({
  onComplete,
  onClose,
}: {
  onComplete: (captures: Record<CaptureAngle, Blob>) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [loadingModels, setLoadingModels] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [autoCapturing, setAutoCapturing] = useState(false);
  const [captures, setCaptures] = useState<Partial<Record<CaptureAngle, Blob>>>({});

  const steps: { angle: CaptureAngle; title: string; hint: string }[] = [
    { angle: "front", title: "Look straight", hint: "Center your face in the frame" },
    { angle: "left", title: "Turn left", hint: "Gently turn your head to the left" },
    { angle: "right", title: "Turn right", hint: "Gently turn your head to the right" },
    { angle: "tilt", title: "Slight tilt", hint: "Tilt your head slightly" },
  ];

  useEffect(() => {
    (async () => {
      try {
        await loadFaceDetectionModels();
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingModels(false);
      }
    })();
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 1280, height: 720 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e) {
      console.error("Failed to start camera", e);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!loadingModels) startCamera();
    return () => stopCamera();
  }, [loadingModels, startCamera, stopCamera]);

  const captureFrame = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.95));
  }, []);

  const autoCapture = useCallback(async () => {
    if (autoCapturing) return;
    setAutoCapturing(true);
    // Simple stability check: capture after a short delay while video is playing
    // (In a full implementation, check face detection confidence here)
    await new Promise(res => setTimeout(res, 800));
    const blob = await captureFrame();
    if (blob) {
      const angle = steps[stepIndex].angle;
      setCaptures(prev => ({ ...prev, [angle]: blob }));
      if (stepIndex < steps.length - 1) {
        setStepIndex(stepIndex + 1);
      }
    }
    setAutoCapturing(false);
  }, [autoCapturing, captureFrame, stepIndex]);

  useEffect(() => {
    // Start auto-capture on each step when video is ready
    if (videoRef.current && videoRef.current.readyState >= 2) {
      autoCapture();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  const handleManualCapture = async () => {
    const blob = await captureFrame();
    if (!blob) return;
    const angle = steps[stepIndex].angle;
    setCaptures(prev => ({ ...prev, [angle]: blob }));
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
    }
  };

  const handleFinish = () => {
    const all = captures as Record<CaptureAngle, Blob>;
    if (!all.front || !all.left || !all.right || !all.tilt) return;
    stopCamera();
    onComplete(all);
  };

  const progress = ((Object.keys(captures).length) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <ArrowLeft2 size={18} />
            </Button>
            <h2 className="text-lg font-semibold">Guided Face Capture</h2>
          </div>
          <div className="text-sm text-muted-foreground">{Math.round(progress)}% done</div>
        </div>
        <div className="p-4">
          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Step {stepIndex + 1} of {steps.length}</div>
              <div className="text-lg font-medium">{steps[stepIndex].title}</div>
              <div className="text-sm text-muted-foreground">{steps[stepIndex].hint}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleManualCapture} disabled={autoCapturing}>
                <Camera size={18} className="mr-2" /> Capture Now
              </Button>
              {Object.keys(captures).length === steps.length ? (
                <Button onClick={handleFinish}>
                  <TickCircle size={18} className="mr-2" /> Use Captures
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {steps.map((s) => (
              <div key={s.angle} className={`h-16 rounded border ${captures[s.angle as CaptureAngle] ? 'border-success bg-success/10' : 'border-border'}`} />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
