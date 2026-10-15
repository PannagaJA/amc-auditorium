
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE public.app_role AS ENUM ('admin', 'approver', 'staff');
CREATE TYPE public.venue_status AS ENUM ('active', 'maintenance', 'inactive');
CREATE TYPE public.booking_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- Fixed 30-minute buffer range; adding a fixed minute interval is timezone-independent.
CREATE OR REPLACE FUNCTION public.buffered_range(_start timestamptz, _end timestamptz)
RETURNS tstzrange LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT tstzrange(_start, _end + interval '30 minutes', '[)')
$$;

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  capacity integer NOT NULL CHECK (capacity > 0),
  facilities text[] NOT NULL DEFAULT '{}',
  equipment text[] NOT NULL DEFAULT '{}',
  photos text[] NOT NULL DEFAULT '{}',
  open_time time NOT NULL DEFAULT '08:00',
  close_time time NOT NULL DEFAULT '20:00',
  status public.venue_status NOT NULL DEFAULT 'active',
  maintenance_note text,
  approver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (close_time > open_time)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venues TO authenticated;
GRANT ALL ON public.venues TO service_role;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  purpose text NOT NULL DEFAULT '',
  attendees integer NOT NULL CHECK (attendees > 0),
  facilities text[] NOT NULL DEFAULT '{}',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'pending',
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at timestamptz,
  rejection_reason text,
  cancelled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at),
  CONSTRAINT bookings_no_overlap_with_buffer EXCLUDE USING gist (
    venue_id WITH =,
    public.buffered_range(start_at, end_at) WITH &&
  ) WHERE (status = 'approved')
);
CREATE INDEX bookings_venue_time_idx ON public.bookings (venue_id, start_at);
CREATE INDEX bookings_user_idx ON public.bookings (user_id);
GRANT SELECT, INSERT ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.approvals TO authenticated;
GRANT ALL ON public.approvals TO service_role;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON public.audit_logs (created_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

CREATE OR REPLACE FUNCTION public.log_audit(_action text, _entity text, _entity_id uuid, _details jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, details)
  VALUES (auth.uid(), _action, _entity, _entity_id, coalesce(_details, '{}'::jsonb));
$$;
REVOKE EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

CREATE POLICY "auth read departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write departments" ON public.departments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "auth read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "auth read roles" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth read venues" ON public.venues FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert venues" ON public.venues FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin update venues" ON public.venues FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "auth read bookings" ON public.bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "own insert bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "read approvals" ON public.approvals FOR SELECT TO authenticated USING (true);

CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own notifications delete" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "admin read audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    NEW.is_active := OLD.is_active;
    NEW.department_id := OLD.department_id;
    NEW.email := OLD.email;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_guard BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, department_id)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', ''),
    coalesce(NEW.email, ''),
    NEW.raw_user_meta_data->>'phone',
    NULLIF(NEW.raw_user_meta_data->>'department_id', '')::uuid
  );
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.booking_conflicts(_venue uuid, _start timestamptz, _end timestamptz, _exclude uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.venue_id = _venue AND b.status = 'approved'
      AND (_exclude IS NULL OR b.id <> _exclude)
      AND public.buffered_range(b.start_at, b.end_at) && public.buffered_range(_start, _end)
  )
$$;

CREATE OR REPLACE FUNCTION public.validate_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.venues;
  local_start timestamp := NEW.start_at AT TIME ZONE 'Asia/Kolkata';
  local_end timestamp := NEW.end_at AT TIME ZONE 'Asia/Kolkata';
BEGIN
  NEW.status := 'pending';
  NEW.decided_by := NULL; NEW.decided_at := NULL; NEW.rejection_reason := NULL;
  NEW.cancelled_by := NULL; NEW.cancelled_at := NULL;
  NEW.title := btrim(NEW.title);
  IF length(NEW.title) < 3 THEN RAISE EXCEPTION 'Event title must be at least 3 characters'; END IF;
  IF length(btrim(NEW.purpose)) < 5 THEN RAISE EXCEPTION 'Please describe the purpose (at least 5 characters)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.user_id AND is_active) THEN
    RAISE EXCEPTION 'Your account is not active';
  END IF;
  SELECT * INTO v FROM public.venues WHERE id = NEW.venue_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auditorium not found'; END IF;
  IF v.status <> 'active' THEN RAISE EXCEPTION 'This auditorium is not available for booking (%)', v.status; END IF;
  IF NEW.attendees > v.capacity THEN RAISE EXCEPTION 'Expected attendees (%) exceed capacity (%)', NEW.attendees, v.capacity; END IF;
  IF NEW.end_at <= NEW.start_at THEN RAISE EXCEPTION 'End time must be after start time'; END IF;
  IF NEW.start_at < now() THEN RAISE EXCEPTION 'Booking must start in the future'; END IF;
  IF NEW.start_at > now() + interval '180 days' THEN RAISE EXCEPTION 'Bookings can be made at most 180 days in advance'; END IF;
  IF local_start::date <> local_end::date THEN RAISE EXCEPTION 'Booking must start and end on the same day'; END IF;
  IF local_start::time < v.open_time OR local_end::time > v.close_time THEN
    RAISE EXCEPTION 'Booking must be within operating hours (% to %)', to_char(v.open_time, 'HH24:MI'), to_char(v.close_time, 'HH24:MI');
  END IF;
  IF public.booking_conflicts(NEW.venue_id, NEW.start_at, NEW.end_at, NULL) THEN
    RAISE EXCEPTION 'This slot conflicts with an approved booking (a 30-minute gap is required between bookings)';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bookings_validate BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.validate_booking();

CREATE OR REPLACE FUNCTION public.after_booking_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE vname text; appr uuid; reqname text;
BEGIN
  SELECT name, approver_id INTO vname, appr FROM public.venues WHERE id = NEW.venue_id;
  SELECT full_name INTO reqname FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, title, body, booking_id)
  SELECT DISTINCT u, 'New booking request', coalesce(nullif(reqname,''),'A user') || ' requested ' || vname || ' for "' || NEW.title || '"', NEW.id
  FROM (
    SELECT user_id AS u FROM public.user_roles WHERE role = 'admin'
    UNION SELECT appr WHERE appr IS NOT NULL
  ) t WHERE u <> NEW.user_id;
  INSERT INTO public.approvals (booking_id, actor_id, action) VALUES (NEW.id, NEW.user_id, 'requested');
  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, details)
  VALUES (NEW.user_id, 'booking.requested', 'booking', NEW.id, jsonb_build_object('title', NEW.title, 'venue', vname));
  RETURN NEW;
END $$;
CREATE TRIGGER bookings_after_insert AFTER INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.after_booking_insert();

CREATE OR REPLACE FUNCTION public.can_decide(_booking uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.bookings b JOIN public.venues v ON v.id = b.venue_id
    WHERE b.id = _booking AND v.approver_id = auth.uid() AND public.has_role(auth.uid(), 'approver')
  )
$$;

CREATE OR REPLACE FUNCTION public.approve_booking(_booking uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bookings;
BEGIN
  IF NOT public.can_decide(_booking) THEN RAISE EXCEPTION 'You are not authorised to approve this booking'; END IF;
  SELECT * INTO b FROM public.bookings WHERE id = _booking FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF b.status <> 'pending' THEN RAISE EXCEPTION 'Only pending bookings can be approved (current: %)', b.status; END IF;
  IF b.start_at < now() THEN RAISE EXCEPTION 'This booking start time has already passed'; END IF;
  IF EXISTS (SELECT 1 FROM public.venues WHERE id = b.venue_id AND status <> 'active') THEN
    RAISE EXCEPTION 'The auditorium is currently not active';
  END IF;
  IF public.booking_conflicts(b.venue_id, b.start_at, b.end_at, b.id) THEN
    RAISE EXCEPTION 'Cannot approve: slot conflicts with an approved booking (30-minute buffer required)';
  END IF;
  BEGIN
    UPDATE public.bookings SET status = 'approved', decided_by = auth.uid(), decided_at = now() WHERE id = _booking;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'Cannot approve: slot conflicts with an approved booking (30-minute buffer required)';
  END;
  INSERT INTO public.approvals (booking_id, actor_id, action) VALUES (_booking, auth.uid(), 'approved');
  INSERT INTO public.notifications (user_id, title, body, booking_id)
  VALUES (b.user_id, 'Booking approved', 'Your booking "' || b.title || '" has been approved.', _booking);
  PERFORM public.log_audit('booking.approved', 'booking', _booking, jsonb_build_object('title', b.title));
END $$;

CREATE OR REPLACE FUNCTION public.reject_booking(_booking uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bookings;
BEGIN
  IF NOT public.can_decide(_booking) THEN RAISE EXCEPTION 'You are not authorised to reject this booking'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN RAISE EXCEPTION 'A rejection reason is required'; END IF;
  SELECT * INTO b FROM public.bookings WHERE id = _booking FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF b.status <> 'pending' THEN RAISE EXCEPTION 'Only pending bookings can be rejected (current: %)', b.status; END IF;
  UPDATE public.bookings SET status = 'rejected', decided_by = auth.uid(), decided_at = now(), rejection_reason = btrim(_reason) WHERE id = _booking;
  INSERT INTO public.approvals (booking_id, actor_id, action, reason) VALUES (_booking, auth.uid(), 'rejected', btrim(_reason));
  INSERT INTO public.notifications (user_id, title, body, booking_id)
  VALUES (b.user_id, 'Booking rejected', 'Your booking "' || b.title || '" was rejected. Reason: ' || btrim(_reason), _booking);
  PERFORM public.log_audit('booking.rejected', 'booking', _booking, jsonb_build_object('title', b.title, 'reason', btrim(_reason)));
END $$;

CREATE OR REPLACE FUNCTION public.cancel_booking(_booking uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bookings;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = _booking FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF NOT (b.user_id = auth.uid() OR public.is_admin()) THEN RAISE EXCEPTION 'You are not authorised to cancel this booking'; END IF;
  IF b.status NOT IN ('pending', 'approved') THEN RAISE EXCEPTION 'This booking cannot be cancelled (current: %)', b.status; END IF;
  IF b.end_at < now() THEN RAISE EXCEPTION 'Past bookings cannot be cancelled'; END IF;
  UPDATE public.bookings SET status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now() WHERE id = _booking;
  INSERT INTO public.approvals (booking_id, actor_id, action) VALUES (_booking, auth.uid(), 'cancelled');
  IF b.user_id <> auth.uid() THEN
    INSERT INTO public.notifications (user_id, title, body, booking_id)
    VALUES (b.user_id, 'Booking cancelled', 'Your booking "' || b.title || '" was cancelled by an administrator.', _booking);
  END IF;
  PERFORM public.log_audit('booking.cancelled', 'booking', _booking, jsonb_build_object('title', b.title));
END $$;

CREATE OR REPLACE FUNCTION public.audit_venue()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, details)
  VALUES (auth.uid(), CASE WHEN TG_OP = 'INSERT' THEN 'venue.created' ELSE 'venue.updated' END, 'venue', NEW.id,
          jsonb_build_object('name', NEW.name, 'status', NEW.status));
  RETURN NEW;
END $$;
CREATE TRIGGER venues_audit AFTER INSERT OR UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION public.audit_venue();

REVOKE EXECUTE ON FUNCTION public.approve_booking(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_booking(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_booking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_booking(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

INSERT INTO public.departments (name) VALUES
 ('Administration'), ('Computer Science'), ('Electronics'), ('Mechanical'), ('Civil'), ('MBA'), ('MCA');

CREATE POLICY "venue photos public read" ON storage.objects FOR SELECT USING (bucket_id = 'venue-photos');
CREATE POLICY "venue photos admin write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'venue-photos' AND public.is_admin());
CREATE POLICY "venue photos admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'venue-photos' AND public.is_admin());
