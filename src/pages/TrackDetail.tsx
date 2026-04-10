import { useState, useMemo } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { LearningSidebar } from "@/components/LearningSidebar";
import { ChatArea } from "@/components/ChatArea";
import { learningTracks } from "@/data/learningTracks";

const TrackDetail = () => {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();

  const track = useMemo(() => learningTracks.find((t) => t.id === trackId), [trackId]);

  const firstSubtopic = track?.topics[0]?.subtopics[0];
  const [activeSubtopic, setActiveSubtopic] = useState(firstSubtopic?.id ?? "");
  const [activeTitle, setActiveTitle] = useState(firstSubtopic?.title ?? "");

  if (!track) return <Navigate to="/" replace />;

  const handleSelect = (id: string, title: string) => {
    setActiveSubtopic(id);
    setActiveTitle(title);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <LearningSidebar
        track={track}
        activeSubtopic={activeSubtopic}
        onSelectSubtopic={handleSelect}
        onBack={() => navigate("/")}
      />
      <div className="flex-1 flex flex-col min-h-0">
        <ChatArea activeSubtopicTitle={activeTitle} />
      </div>
    </div>
  );
};

export default TrackDetail;
