import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowLeft2, Export } from "iconsax-react";
import { toast } from "sonner";

type AttendanceRecord = {
  id: string;
  date: string;
  class_id: string;
  present_students: string[];
  absent_students: string[];
  unknown_faces: any;
  verified_at: string | null;
  notes: string | null;
};

export default function AttendanceHistory() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      setUserId(user.id);

      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const adminRole = roleData?.role === "admin";
      setIsAdmin(adminRole);

      await loadAttendanceRecords(user.id, adminRole);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceRecords = async (uid: string, admin: boolean) => {
    try {
      let query = supabase
        .from("attendance_records")
        .select("*")
        .order("date", { ascending: false });

      // Students can only see records where they are present or absent
      if (!admin) {
        query = query.or(`present_students.cs.{${uid}},absent_students.cs.{${uid}}`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error("Error loading attendance:", error);
      toast.error("Failed to load attendance records");
    }
  };

  const getStatusForStudent = (record: AttendanceRecord) => {
    if (record.present_students?.includes(userId)) {
      return <Badge className="bg-success">Present</Badge>;
    }
    if (record.absent_students?.includes(userId)) {
      return <Badge variant="destructive">Absent</Badge>;
    }
    return <Badge variant="secondary">N/A</Badge>;
  };

  const exportToCSV = () => {
    if (records.length === 0) {
      toast.error("No records to export");
      return;
    }

    const headers = isAdmin
      ? ["Date", "Class", "Present Count", "Absent Count", "Verified", "Notes"]
      : ["Date", "Class", "Status", "Notes"];

    const rows = records.map(record => {
      if (isAdmin) {
        return [
          record.date,
          record.class_id,
          record.present_students?.length || 0,
          record.absent_students?.length || 0,
          record.verified_at ? "Yes" : "No",
          record.notes || ""
        ];
      } else {
        const status = record.present_students?.includes(userId) ? "Present" : "Absent";
        return [record.date, record.class_id, status, record.notes || ""];
      }
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_history_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Exported successfully");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading attendance history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft2 className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <Card className="shadow-elegant border-primary/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Calendar size={20} className="text-primary" />
                  Attendance History
                </CardTitle>
                <CardDescription>
                  {isAdmin ? "View all attendance records" : "Your attendance records"}
                </CardDescription>
              </div>
              <Button onClick={exportToCSV} variant="outline">
                <Export className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="text-center py-12">
                <Calendar size={48} className="text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground text-lg">No attendance records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Class</TableHead>
                      {isAdmin ? (
                        <>
                          <TableHead className="text-center">Present</TableHead>
                          <TableHead className="text-center">Absent</TableHead>
                          <TableHead className="text-center">Unknown</TableHead>
                          <TableHead>Verified</TableHead>
                        </>
                      ) : (
                        <TableHead>Status</TableHead>
                      )}
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {new Date(record.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{record.class_id}</TableCell>
                        {isAdmin ? (
                          <>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="bg-success/10 text-success">
                                {record.present_students?.length || 0}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                                {record.absent_students?.length || 0}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">
                                {(record.unknown_faces as any[])?.length || 0}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {record.verified_at ? (
                                <Badge className="bg-success">Verified</Badge>
                              ) : (
                                <Badge variant="secondary">Pending</Badge>
                              )}
                            </TableCell>
                          </>
                        ) : (
                          <TableCell>{getStatusForStudent(record)}</TableCell>
                        )}
                        <TableCell className="max-w-xs truncate">
                          {record.notes || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
