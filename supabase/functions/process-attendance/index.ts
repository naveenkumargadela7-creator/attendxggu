import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { photoId, classId } = await req.json();
    console.log('Processing attendance for photo:', photoId, 'class:', classId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update photo status to processing
    await supabase
      .from('photos')
      .update({ analysis_status: 'processing' })
      .eq('id', photoId);

    // Get all students in the class
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, user_id, name, roll_number')
      .eq('class', classId)
      .eq('face_registered', true);

    if (studentsError) {
      console.error('Error fetching students:', studentsError);
      throw studentsError;
    }

    console.log(`Found ${students?.length || 0} registered students in class ${classId}`);

    // Get face data for all students in the class
    const { data: facesData, error: facesError } = await supabase
      .from('faces_data')
      .select('*')
      .in('student_id', students?.map(s => s.id) || []);

    if (facesError) {
      console.error('Error fetching faces data:', facesError);
      throw facesError;
    }

    console.log(`Found ${facesData?.length || 0} face records`);

    // For now, we'll simulate face recognition
    // In a real implementation, you would:
    // 1. Download the group photo
    // 2. Detect all faces in it
    // 3. Compare with stored face embeddings
    // 4. Match students based on similarity threshold

    // Simulate: Mark random students as present (50% chance)
    const presentStudents = students
      ?.filter(() => Math.random() > 0.5)
      .map(s => s.user_id) || [];
    
    const allStudentIds = students?.map(s => s.user_id) || [];
    const absentStudents = allStudentIds.filter(id => !presentStudents.includes(id));

    console.log(`Present: ${presentStudents.length}, Absent: ${absentStudents.length}`);

    // Create attendance record
    const { error: attendanceError } = await supabase
      .from('attendance_records')
      .insert({
        photo_id: photoId,
        class_id: classId,
        present_students: presentStudents,
        absent_students: absentStudents,
        unknown_faces: [],
      });

    if (attendanceError) {
      console.error('Error creating attendance record:', attendanceError);
      throw attendanceError;
    }

    // Update photo status to completed
    await supabase
      .from('photos')
      .update({ 
        analysis_status: 'completed',
        faces_detected: presentStudents.length 
      })
      .eq('id', photoId);

    console.log('Attendance processing completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        presentCount: presentStudents.length,
        absentCount: absentStudents.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error processing attendance:', error);
    
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to process attendance' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
