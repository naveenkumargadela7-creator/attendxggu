import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Profile2User, Calendar, Logout, ScanBarcode, People, TickCircle, Warning2, ProfileCircle } from "iconsax-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [studentData, setStudentData] = useState<any>(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    setUser(user);

    // Get user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    setUserRole(roleData?.role || "");

    // If student, get student data
    if (roleData?.role === "student") {
      const { data: studentInfo } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setStudentData(studentInfo);
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const isAdmin = userRole === "admin";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card className="shadow-elegant border-primary/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="bg-gradient-hero p-2 rounded-lg">
                    <span className="text-white font-bold text-xl">AX</span>
                  </div>
                  <h1 className="text-2xl font-bold bg-gradient-hero bg-clip-text text-transparent">
                    AttendX
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <Button variant="outline" onClick={handleLogout} className="gap-2">
                  <Logout size={18} />
                  Logout
                </Button>
              </div>
            </div>
            <div className="mt-4">
              <CardTitle className="text-2xl flex items-center gap-3">
                <ProfileCircle size={32} variant="Bold" className="text-primary" />
                {isAdmin ? "Admin Dashboard" : "Student Dashboard"}
              </CardTitle>
              <CardDescription className="mt-2">
                Welcome back, {isAdmin ? user?.email : studentData?.name || user?.email}
                {!isAdmin && studentData && (
                  <span className="block text-sm mt-1">
                    Roll: {studentData.roll_number} | Class: {studentData.class}
                  </span>
                )}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        {/* Action Cards */}
        {isAdmin ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card
              className="cursor-pointer hover:shadow-glow transition-all duration-300 border-primary/20 hover:border-primary/40 group"
              onClick={() => navigate("/take-attendance")}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-gradient-primary group-hover:scale-110 transition-transform">
                    <Camera size={24} variant="Bold" className="text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Take Attendance</CardTitle>
                    <CardDescription className="text-xs">Capture class photo</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-glow transition-all duration-300 border-primary/20 hover:border-primary/40 group"
              onClick={() => navigate("/manage-students")}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-gradient-primary group-hover:scale-110 transition-transform">
                    <People size={24} variant="Bold" className="text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Manage Students</CardTitle>
                    <CardDescription className="text-xs">View all students</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-glow transition-all duration-300 border-primary/20 hover:border-primary/40 group"
              onClick={() => navigate("/attendance-history")}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-gradient-primary group-hover:scale-110 transition-transform">
                    <Calendar size={24} variant="Bold" className="text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Attendance History</CardTitle>
                    <CardDescription className="text-xs">View all records</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card
              className="cursor-pointer hover:shadow-glow transition-all duration-300 border-primary/20 hover:border-primary/40 group"
              onClick={() => navigate("/register-face")}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-gradient-primary group-hover:scale-110 transition-transform">
                    <ScanBarcode size={24} variant="Bold" className="text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {studentData?.face_registered ? "Update Face Data" : "Register Face"}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {studentData?.face_registered
                        ? "Update your facial recognition data"
                        : "Register your face for attendance"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-glow transition-all duration-300 border-primary/20 hover:border-primary/40 group"
              onClick={() => navigate("/attendance-history")}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-gradient-primary group-hover:scale-110 transition-transform">
                    <Calendar size={24} variant="Bold" className="text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">My Attendance</CardTitle>
                    <CardDescription className="text-xs">View your attendance records</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Info Card for Students */}
        {!isAdmin && studentData && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-gradient-primary">
                  {studentData.face_registered ? (
                    <TickCircle size={32} variant="Bold" className="text-white" />
                  ) : (
                    <Warning2 size={32} variant="Bold" className="text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">
                    {studentData.face_registered
                      ? "Face Registration Complete"
                      : "Action Required: Register Your Face"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {studentData.face_registered
                      ? "Your face data is registered. Your attendance can now be marked automatically."
                      : "Please register your face to enable automatic attendance tracking. Click 'Register Face' above to get started."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
