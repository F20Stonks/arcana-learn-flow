import { useState } from "react";
import { LearningSidebar } from "@/components/LearningSidebar";
import { GoalsBar } from "@/components/GoalsBar";
import { ChatArea } from "@/components/ChatArea";

const Index = () => {
  const [activeSubtopic, setActiveSubtopic] = useState("ml-2-2");
  const [activeTitle, setActiveTitle] = useState("Backpropagation");

  const handleSelect = (id: string, title: string) => {
    setActiveSubtopic(id);
    setActiveTitle(title);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <LearningSidebar activeSubtopic={activeSubtopic} onSelectSubtopic={handleSelect} />
      <div className="flex-1 flex flex-col min-h-0">
        <GoalsBar />
        <ChatArea activeSubtopicTitle={activeTitle} />
      </div>
    </div>
  );
};

export default Index;
