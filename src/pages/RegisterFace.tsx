import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera } from "@/components/ui/camera";
import { toast } from "sonner";
import { Camera as CameraIcon, Check, User } from "lucide-react";

type CaptureAngle = "front" | "left" | "right" | "tilt";

interface CaptureStatus {
  angle: CaptureAngle;
  label: string;
  captured: boolean;
  blob?: Blob;
}

export default function RegisterFace() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [currentAngle, setCurrentAngle] = useState<CaptureAngle>("front");
  const [uploading, setUploading] = useState(false);
  const [captures, setCaptures] = useState<CaptureStatus[]>([
    { angle: "front", label: "Front View", captured: false },
    { angle: "left", label: "Left Profile", captured: false },
    { angle: "right", label: "Right Profile", captured: false },
    { angle: "tilt", label: "Slight Tilt", captured: false },
  ]);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
    } else {
      setUser(user);
    }
  };

  const handleCapture = (blob: Blob) => {
    setCaptures((prev) =>
      prev.map((c) =>
        c.angle === currentAngle ? { ...c, captured: true, blob } : c
      )
    );
    setShowCamera(false);
    toast.success(`${captures.find(c => c.angle === currentAngle)?.label} captured!`);
  };

  const openCamera = (angle: CaptureAngle) => {
    setCurrentAngle(angle);
    setShowCamera(true);
  };

  const handleSubmit = async () => {
    const allCaptured = captures.every((c) => c.captured);
    if (!allCaptured) {
      toast.error("Please capture all angles before submitting");
      return;
    }

    setUploading(true);
    
    try {
      // Upload each image to Supabase Storage
      const uploadPromises = captures.map(async (capture) => {
        if (!capture.blob) return null;

        const fileName = `${user.id}/${capture.angle}-${Date.now()}.jpg`;
        const { data, error } = await supabase.storage
          .from("student_faces")
          .upload(fileName, capture.blob, {
            contentType: "image/jpeg",
            upsert: false,
          });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from("student_faces")
          .getPublicUrl(data.path);

        return {
          angle: capture.angle,
          url: publicUrl,
          path: data.path,
        };
      });

      const uploadedImages = await Promise.all(uploadPromises);

      // TODO: Call AI backend to process faces and generate embeddings
      // For now, we'll just store the image references
      const { error: dbError } = await (supabase as any)
        .from("faces_data")
        .insert(
          uploadedImages.map((img) => ({
            user_id: user.id,
            photo_url: img?.url,
            angle: img?.angle,
          }))
        );

      if (dbError) throw dbError;

      toast.success("Face registration completed!");
      navigate("/");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload images");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent mb-4">
            <User className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Register Your Face</h1>
          <p className="text-muted-foreground">
            Capture 4 angles for accurate recognition
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Face Capture Instructions</CardTitle>
            <CardDescription>
              Take clear photos from different angles for best results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Ensure good lighting conditions</li>
              <li>• Remove glasses if possible</li>
              <li>• Look directly at the camera for each angle</li>
              <li>• Keep a neutral expression</li>
            </ul>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {captures.map((capture) => (
            <Card key={capture.angle} className={capture.captured ? "border-success" : ""}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">{capture.label}</h3>
                  {capture.captured && (
                    <div className="flex items-center gap-1 text-success">
                      <Check className="h-4 w-4" />
                      <span className="text-sm">Captured</span>
                    </div>
                  )}
                </div>
                
                {capture.blob ? (
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted mb-4">
                    <img
                      src={URL.createObjectURL(capture.blob)}
                      alt={capture.label}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-video rounded-lg bg-muted flex items-center justify-center mb-4">
                    <CameraIcon className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}

                <Button
                  onClick={() => openCamera(capture.angle)}
                  variant={capture.captured ? "outline" : "default"}
                  className="w-full"
                >
                  {capture.captured ? "Retake" : "Capture"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-4">
          <Button
            onClick={handleSubmit}
            disabled={!captures.every((c) => c.captured) || uploading}
            className="flex-1"
            size="lg"
          >
            {uploading ? "Processing..." : "Complete Registration"}
          </Button>
          <Button
            onClick={() => navigate("/")}
            variant="outline"
            size="lg"
          >
            Skip for Now
          </Button>
        </div>
      </div>

      {showCamera && (
        <Camera
          onCapture={handleCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
