import { useRef, useState, useCallback } from "react";
import { Button } from "./button";
import { Camera as CameraIcon } from "iconsax-react";
import { RotateLeft, CloseCircle } from "iconsax-react";
import { cn } from "@/lib/utils";

interface CameraProps {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
  className?: string;
}

export function Camera({ onCapture, onClose, className }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 1280, height: 720 },
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      alert("Failed to access camera. Please grant camera permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setIsCameraActive(false);
    }
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            onCapture(blob);
            stopCamera();
          }
        }, "image/jpeg", 0.95);
      }
    }
  }, [onCapture, stopCamera]);

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className={cn("fixed inset-0 z-50 bg-black/95 flex flex-col", className)}>
      <div className="flex items-center justify-between p-4 bg-card/10 backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-white">Capture Photo</h2>
        <Button variant="ghost" size="icon" onClick={handleClose}>
          <CloseCircle size={18} className="text-white" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="relative w-full max-w-2xl aspect-video bg-muted rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {!isCameraActive && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Button onClick={startCamera} size="lg" className="gap-2">
                <CameraIcon className="h-5 w-5" />
                Start Camera
              </Button>
            </div>
          )}
        </div>

        {isCameraActive && (
          <div className="mt-6 flex gap-4">
            <Button
              onClick={capturePhoto}
              size="lg"
              className="gap-2"
            >
              <CameraIcon className="h-5 w-5" />
              Capture Photo
            </Button>
            <Button
              onClick={stopCamera}
              variant="outline"
              size="lg"
              className="gap-2 bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <RotateLeft size={18} />
              Reset
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
