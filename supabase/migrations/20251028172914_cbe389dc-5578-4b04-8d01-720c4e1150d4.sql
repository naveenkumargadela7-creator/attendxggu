-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'student');

-- Create storage buckets for images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('student_faces', 'student_faces', false, 5242880, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']),
  ('group_photos', 'group_photos', false, 10485760, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create students table (profile data for students only)
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  roll_number TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  class TEXT NOT NULL,
  face_registered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Create faces_data table (stores face embeddings and photo references)
CREATE TABLE public.faces_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  embedding FLOAT8[] NOT NULL,
  photo_url TEXT NOT NULL,
  photo_path TEXT NOT NULL,
  angle TEXT NOT NULL CHECK (angle IN ('front', 'left', 'right', 'tilt')),
  confidence FLOAT DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.faces_data ENABLE ROW LEVEL SECURITY;

-- Create photos table (stores group/class photos taken by admin)
CREATE TABLE public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taken_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  analysis_status TEXT DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed')),
  faces_detected INTEGER DEFAULT 0,
  low_confidence BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- Create attendance_records table (final attendance results)
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  present_students UUID[] DEFAULT ARRAY[]::UUID[],
  absent_students UUID[] DEFAULT ARRAY[]::UUID[],
  unknown_faces JSONB DEFAULT '[]'::JSONB,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
CREATE INDEX idx_students_user_id ON public.students(user_id);
CREATE INDEX idx_students_roll_number ON public.students(roll_number);
CREATE INDEX idx_students_class ON public.students(class);
CREATE INDEX idx_faces_data_user_id ON public.faces_data(user_id);
CREATE INDEX idx_faces_data_student_id ON public.faces_data(student_id);
CREATE INDEX idx_photos_taken_by ON public.photos(taken_by);
CREATE INDEX idx_photos_class_id ON public.photos(class_id);
CREATE INDEX idx_photos_analysis_status ON public.photos(analysis_status);
CREATE INDEX idx_attendance_photo_id ON public.attendance_records(photo_id);
CREATE INDEX idx_attendance_class_date ON public.attendance_records(class_id, date);

-- Create security definer function to check user roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger for students table
CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for attendance_records table
CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role public.app_role;
BEGIN
  -- Get role from metadata (set during signup)
  user_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student');
  
  -- Insert role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role);
  
  -- If student, create student profile
  IF user_role = 'student' THEN
    INSERT INTO public.students (
      user_id,
      name,
      roll_number,
      email,
      class
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
      COALESCE(NEW.raw_user_meta_data->>'roll_number', 'PENDING'),
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'class', 'Not Assigned')
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for students
CREATE POLICY "Students can view their own profile"
  ON public.students FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Students can update their own profile"
  ON public.students FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all students"
  ON public.students FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all students"
  ON public.students FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for faces_data
CREATE POLICY "Students can view their own face data"
  ON public.faces_data FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Students can insert their own face data"
  ON public.faces_data FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all face data"
  ON public.faces_data FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all face data"
  ON public.faces_data FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for photos
CREATE POLICY "Admins can insert photos"
  ON public.photos FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all photos"
  ON public.photos FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update photos"
  ON public.photos FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for attendance_records
CREATE POLICY "Students can view their own attendance"
  ON public.attendance_records FOR SELECT
  TO authenticated
  USING (
    auth.uid() = ANY(present_students) OR 
    auth.uid() = ANY(absent_students)
  );

CREATE POLICY "Admins can view all attendance"
  ON public.attendance_records FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert attendance"
  ON public.attendance_records FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update attendance"
  ON public.attendance_records FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Storage policies for student_faces bucket
CREATE POLICY "Students can upload their own face photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'student_faces' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Students can view their own face photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'student_faces' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Students can delete their own face photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'student_faces' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins can view all student face photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'student_faces' AND
    public.has_role(auth.uid(), 'admin')
  );

-- Storage policies for group_photos bucket
CREATE POLICY "Admins can upload group photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'group_photos' AND
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can view group photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'group_photos' AND
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can delete group photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'group_photos' AND
    public.has_role(auth.uid(), 'admin')
  );