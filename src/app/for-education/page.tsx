import { AudiencePageTemplate } from "@/components/marketing/AudiencePageTemplate";
import { AUDIENCE_PAGE_CONTENT } from "@/lib/audience-pages";

const page = AUDIENCE_PAGE_CONTENT.education;

export const metadata = page.metadata;

export default function ForEducationPage() {
  return <AudiencePageTemplate {...page} />;
}
