import { AudiencePageTemplate } from "@/features/marketing/components/AudiencePageTemplate";
import { AUDIENCE_PAGE_CONTENT } from "@/features/landing/lib/audience-pages";

const page = AUDIENCE_PAGE_CONTENT.content;

export const metadata = page.metadata;

export default function ForContentPage() {
  return <AudiencePageTemplate {...page} />;
}
