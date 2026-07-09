import { PortalHeading } from "@/components/portal/ui";
import { AiAssistant } from "@/components/portal/ai-assistant";

export const metadata = { title: "AI Assistant" };

export default function AdminAssistantPage() {
  return (
    <>
      <PortalHeading
        title="AI Assistant,"
        accent="ask anything"
        description="Your operations copilot — analyzes campuses, students, trainers, courses, and placements on demand."
      />
      <AiAssistant role="admin" />
    </>
  );
}
