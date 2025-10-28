import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera } from "@/components/ui/camera";
import { ArrowLeft, Camera as CameraIcon, Upload } from "lucide-react";
import { toast } from "sonner";

export default function TakeAttendance() {
  const navigate = useNavigate();
  const [showCamera, setShowCamera] = useState(false);
  const [classId, setClassId] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const handleCapture = (blob: Blob) => {
    setCapturedPhoto(blob);
    setPhotoPreview(URL.createObjectURL(blob));
    setShowCamera(false);
    toast.success("Photo captured successfully");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      setCapturedPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
      toast.success("Photo selected successfully");
    }
  };

  const handleSubmit = async () => {
    if (!capturedPhoto) {
      toast.error("Please capture or upload a photo");
      return;
    }

    if (!classId.trim()) {
      toast.error("Please enter a class ID");
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (roleData?.role !== "admin") {
        toast.error("Only admins can take attendance");
        navigate("/dashboard");
        return;
      }

      // Upload photo to Supabase Storage
      const fileName = `${classId}_${Date.now()}.jpg`;
      const filePath = `${user.id}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("group_photos")
        .upload(filePath, capturedPhoto, {
          contentType: "image/jpeg",
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("group_photos")
        .getPublicUrl(filePath);

      // Save photo metadata to database
      const { data: photoData, error: photoError } = await supabase
        .from("photos")
        .insert({
          taken_by: user.id,
          class_id: classId,
          storage_path: filePath,
          storage_url: urlData.publicUrl,
          analysis_status: "pending"
        })
        .select()
        .single();

      if (photoError) throw photoError;

      toast.success("Photo uploaded successfully! Processing attendance...");

      // TODO: Here you would call your Python FastAPI backend to process the image
      // For now, we'll create a placeholder attendance record
      // Example API call:
      // const response = await fetch(`${AI_API_URL}/api/detect_group`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${session.access_token}`
      //   },
      //   body: JSON.stringify({
      //     imageUrl: urlData.publicUrl,
      //     classId: classId,
      //     photoId: photoData.id
      //   })
      // });

      // Create placeholder attendance record
      const { error: attendanceError } = await supabase
        .from("attendance_records")
        .insert({
          photo_id: photoData.id,
          class_id: classId,
          present_students: [],
          absent_students: [],
          unknown_faces: []
        });

      if (attendanceError) throw attendanceError;

      // Update photo status
      await supabase
        .from("photos")
        .update({ analysis_status: "completed" })
        .eq("id", photoData.id);

      toast.success("Attendance recorded successfully!");
      navigate("/attendance-history");
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to process attendance");
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setCapturedPhoto(null);
    setPhotoPreview("");
    setClassId("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <Card className="shadow-elegant border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <CameraIcon className="h-6 w-6 text-primary" />
              Take Attendance
            </CardTitle>
            <CardDescription>
              Capture a group photo of the class to mark attendance automatically
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="classId">Class ID *</Label>
              <Input
                id="classId"
                placeholder="e.g., CSE-A, ME-B, etc."
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                disabled={uploading}
              />
            </div>

            {photoPreview ? (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden border-2 border-primary/20">
                  <img
                    src={photoPreview}
                    alt="Captured group"
                    className="w-full h-auto"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={uploading}
                    className="flex-1"
                  >
                    Retake Photo
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={uploading}
                    className="flex-1 bg-gradient-primary"
                  >
                    {uploading ? "Processing..." : "Submit Attendance"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowCamera(true)}
                    className="h-32 flex flex-col gap-2 border-2 border-dashed hover:border-primary hover:bg-primary/5"
                  >
                    <CameraIcon className="h-8 w-8 text-primary" />
                    <span className="font-semibold">Capture Photo</span>
                  </Button>

                  <label htmlFor="file-upload">
                    <div className="h-32 flex flex-col gap-2 items-center justify-center border-2 border-dashed rounded-md cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                      <Upload className="h-8 w-8 text-primary" />
                      <span className="font-semibold">Upload Photo</span>
                    </div>
                    <input
                      id="file-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                  <p className="text-sm text-muted-foreground">
                    <strong>Tips for best results:</strong>
                  </p>
                  <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                    <li>Ensure all students are visible and facing the camera</li>
                    <li>Take photo in good lighting conditions</li>
                    <li>Keep camera steady and avoid blur</li>
                    <li>If some faces are unclear, you can retake multiple photos</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {showCamera && (
          <Camera
            onCapture={handleCapture}
            onClose={() => setShowCamera(false)}
          />
        )}
      </div>
    </div>
  );
}
