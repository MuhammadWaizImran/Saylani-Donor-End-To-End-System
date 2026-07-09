import { PortalHeading } from "@/components/portal/ui";
import { DataEntry } from "@/components/portal/data-entry";

export const metadata = { title: "Data Entry" };

export default function DataEntryPage() {
  return (
    <>
      <PortalHeading
        title="Data entry,"
        accent="no SQL required"
        description="Add students, campaigns, campuses, trainers, courses, classes, and donations straight into the live database — or just ask the AI Assistant to do it for you."
      />
      <DataEntry />
    </>
  );
}
