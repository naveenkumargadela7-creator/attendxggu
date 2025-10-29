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
    const { photoId, classId, descriptors } = await req.json();
    console.log('Processing attendance for photo:', photoId, 'class:', classId, 'descriptors:', Array.isArray(descriptors) ? descriptors.length : 0);

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

    // Match provided face descriptors from client against known embeddings in DB
    const inputDescriptors: number[][] = Array.isArray(descriptors) ? descriptors : [];

    // Build lookup of embeddings by user
    const byUser: Record<string, number[][]> = {};
    for (const f of (facesData || [])) {
      const uid = (f as any).user_id as string;
      const emb = (f as any).embedding as number[];
      if (!byUser[uid]) byUser[uid] = [];
      if (Array.isArray(emb) && emb.length) byUser[uid].push(emb);
    }

    const dist = (a: number[], b: number[]) => {
      let s = 0;
      const len = Math.min(a.length, b.length);
      for (let i = 0; i < len; i++) {
        const d = a[i] - b[i];
        s += d * d;
      }
      return Math.sqrt(s);
    };

    const THRESHOLD = 0.6;
    const presentSet = new Set<string>();
    const unknownFaces: any[] = [];

    if (inputDescriptors.length === 0) {
      console.log('No descriptors provided by client; marking all as unknown if any students exist');
    }

    for (let i = 0; i < inputDescriptors.length; i++) {
      const desc = inputDescriptors[i];
      let bestUid: string | null = null;
      let best = Number.POSITIVE_INFINITY;
      for (const [uid, embs] of Object.entries(byUser)) {
        for (const e of embs) {
          const d = dist(desc, e);
          if (d < best) { best = d; bestUid = uid; }
        }
      }
      if (bestUid && best < THRESHOLD) {
        presentSet.add(bestUid);
      } else {
        unknownFaces.push({ index: i, bestDistance: isFinite(best) ? best : null });
      }
    }

    const presentStudents = Array.from(presentSet);
    const allStudentIds = students?.map(s => s.user_id) || [];
    const absentStudents = allStudentIds.filter(id => !presentSet.has(id));

    console.log(`Present: ${presentStudents.length}, Absent: ${absentStudents.length}, Unknown: ${unknownFaces.length}`);

    // Create attendance record
    const { error: attendanceError } = await supabase
      .from('attendance_records')
      .insert({
        photo_id: photoId,
        class_id: classId,
        present_students: presentStudents,
        absent_students: absentStudents,
        unknown_faces: unknownFaces,
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
        faces_detected: inputDescriptors.length 
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
