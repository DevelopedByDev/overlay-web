import { AudiencePageTemplate } from "@/components/marketing/AudiencePageTemplate";
import { AUDIENCE_PAGE_CONTENT } from "@/lib/audience-pages";

const page = AUDIENCE_PAGE_CONTENT.developers;

export const metadata = page.metadata;

export default function ForDevelopersPage() {
  return <AudiencePageTemplate {...page} />;
}
