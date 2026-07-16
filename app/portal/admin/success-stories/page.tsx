import { getSuccessStories } from "@/lib/success-stories";
import { PortalHeading } from "@/components/portal/ui";
import { SuccessStoriesSection } from "@/components/portal/success-stories";

export const metadata = { title: "Success Stories" };
export const dynamic = "force-dynamic";

export default async function SuccessStoriesPage() {
  const stories = await getSuccessStories();

  return (
    <>
      <PortalHeading
        title="Success stories,"
        accent="in their own words"
        description="Graduates who walked in as students and walked out with careers."
      />
      <SuccessStoriesSection stories={stories} />
    </>
  );
}
