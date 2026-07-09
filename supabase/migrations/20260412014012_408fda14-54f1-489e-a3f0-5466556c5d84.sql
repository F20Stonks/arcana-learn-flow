
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  weekly_streak INTEGER NOT NULL DEFAULT 0,
  total_xp INTEGER NOT NULL DEFAULT 0,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'paid')),
  stripe_customer_id TEXT,
  voice_id TEXT DEFAULT 'JBFqnCBsd6RMkjVDRZzb',
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.learning_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  emoji TEXT DEFAULT '📚',
  exam_board TEXT,
  level TEXT,
  exam_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.learning_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tracks" ON public.learning_tracks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tracks" ON public.learning_tracks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tracks" ON public.learning_tracks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tracks" ON public.learning_tracks FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES public.learning_tracks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'unlocked', 'in_progress', 'complete'))
);
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own topics" ON public.topics FOR SELECT USING (EXISTS (SELECT 1 FROM public.learning_tracks lt WHERE lt.id = topics.track_id AND lt.user_id = auth.uid()));
CREATE POLICY "Users can insert own topics" ON public.topics FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.learning_tracks lt WHERE lt.id = topics.track_id AND lt.user_id = auth.uid()));
CREATE POLICY "Users can update own topics" ON public.topics FOR UPDATE USING (EXISTS (SELECT 1 FROM public.learning_tracks lt WHERE lt.id = topics.track_id AND lt.user_id = auth.uid()));

CREATE TABLE public.subtopics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'unlocked', 'in_progress', 'complete', 'review_due')),
  prerequisite_subtopic_ids UUID[] DEFAULT '{}',
  estimated_minutes INTEGER DEFAULT 30,
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.subtopics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subtopics" ON public.subtopics FOR SELECT USING (EXISTS (SELECT 1 FROM public.topics t JOIN public.learning_tracks lt ON lt.id = t.track_id WHERE t.id = subtopics.topic_id AND lt.user_id = auth.uid()));
CREATE POLICY "Users can insert own subtopics" ON public.subtopics FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.topics t JOIN public.learning_tracks lt ON lt.id = t.track_id WHERE t.id = subtopics.topic_id AND lt.user_id = auth.uid()));
CREATE POLICY "Users can update own subtopics" ON public.subtopics FOR UPDATE USING (EXISTS (SELECT 1 FROM public.topics t JOIN public.learning_tracks lt ON lt.id = t.track_id WHERE t.id = subtopics.topic_id AND lt.user_id = auth.uid()));

CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subtopic_id UUID NOT NULL REFERENCES public.subtopics(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL DEFAULT 'learn' CHECK (session_type IN ('learn', 'consolidate', 'question', 'exam_sim', 'review')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  xp_earned INTEGER DEFAULT 0
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sessions" ON public.sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.sessions FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = messages.session_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can insert own messages" ON public.messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = messages.session_id AND s.user_id = auth.uid()));

CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subtopic_id UUID REFERENCES public.subtopics(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  linked_concept_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notes" ON public.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notes" ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON public.notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON public.notes FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.daily_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
  question TEXT NOT NULL,
  subject TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard'))
);
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view challenges" ON public.daily_challenges FOR SELECT USING (true);

CREATE INDEX idx_learning_tracks_user ON public.learning_tracks(user_id);
CREATE INDEX idx_topics_track ON public.topics(track_id);
CREATE INDEX idx_subtopics_topic ON public.subtopics(topic_id);
CREATE INDEX idx_sessions_user ON public.sessions(user_id);
CREATE INDEX idx_sessions_subtopic ON public.sessions(subtopic_id);
CREATE INDEX idx_messages_session ON public.messages(session_id);
CREATE INDEX idx_notes_user ON public.notes(user_id);
