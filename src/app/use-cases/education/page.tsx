import { AudiencePageTemplate } from "@/features/marketing/components/AudiencePageTemplate";
import { AUDIENCE_PAGE_CONTENT } from "@/features/landing/lib/audience-pages";

const page = AUDIENCE_PAGE_CONTENT.education;

export const metadata = page.metadata;

export default function ForEducationPage() {
  return <AudiencePageTemplate {...page} />;
}
