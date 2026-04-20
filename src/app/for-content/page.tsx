import { AudiencePageTemplate } from "@/components/marketing/AudiencePageTemplate";
import { AUDIENCE_PAGE_CONTENT } from "@/lib/audience-pages";

const page = AUDIENCE_PAGE_CONTENT.content;

export const metadata = page.metadata;

export default function ForContentPage() {
  return <AudiencePageTemplate {...page} />;
}
