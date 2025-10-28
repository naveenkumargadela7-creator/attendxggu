import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Camera, LogOut, Users, ClipboardList, User } from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("student");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      setUser(user);
      setUserRole(user.user_metadata?.role || "student");
    } catch (error) {
      console.error("Error fetching user:", error);
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
      navigate("/auth");
    } catch (error: any) {
      toast.error(error.message || "Failed to sign out");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold">{user?.user_metadata?.name || "User"}</h2>
              <p className="text-sm text-muted-foreground capitalize">{userRole}</p>
            </div>
          </div>
          <Button onClick={handleSignOut} variant="outline" size="sm" className="gap-2">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {user?.user_metadata?.name?.split(" ")[0]}!
          </h1>
          <p className="text-muted-foreground">
            {userRole === "admin" 
              ? "Manage attendance and student records" 
              : "View your attendance and profile"}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userRole === "admin" && (
            <>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/take-attendance")}>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center mb-3">
                    <Camera className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle>Take Attendance</CardTitle>
                  <CardDescription>
                    Capture group photo to mark attendance
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/manage-students")}>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent to-success flex items-center justify-center mb-3">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle>Manage Students</CardTitle>
                  <CardDescription>
                    View and manage student records
                  </CardDescription>
                </CardHeader>
              </Card>
            </>
          )}

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/attendance-history")}>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-warning to-destructive flex items-center justify-center mb-3">
                <ClipboardList className="h-6 w-6 text-white" />
              </div>
              <CardTitle>Attendance History</CardTitle>
              <CardDescription>
                {userRole === "admin" ? "View all attendance records" : "View your attendance"}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/register-face")}>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-secondary to-muted-foreground flex items-center justify-center mb-3">
                <User className="h-6 w-6 text-white" />
              </div>
              <CardTitle>Update Face Data</CardTitle>
              <CardDescription>
                Re-register your face for better accuracy
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Quick Stats</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">-</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {userRole === "admin" ? "Total Students" : "Attendance Rate"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-success">-</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {userRole === "admin" ? "Present Today" : "Days Present"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-warning">-</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {userRole === "admin" ? "Absent Today" : "Days Absent"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
