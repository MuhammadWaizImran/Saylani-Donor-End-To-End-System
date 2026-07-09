import { PortalHeading } from "@/components/portal/ui";
import { AiAssistant } from "@/components/portal/ai-assistant";

export const metadata = { title: "AI Assistant" };

export default function TrainerAssistantPage() {
  return (
    <>
      <PortalHeading
        title="AI Assistant,"
        accent="your teaching copilot"
        description="Ask about your students, batches, attendance risks, and placement record."
      />
      <AiAssistant role="trainer" />
    </>
  );
}
