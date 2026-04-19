import { AudiencePageTemplate } from "@/components/marketing/AudiencePageTemplate";
import { AUDIENCE_PAGE_CONTENT } from "@/lib/audience-pages";

const page = AUDIENCE_PAGE_CONTENT.business;

export const metadata = page.metadata;

export default function ForBusinessPage() {
  return <AudiencePageTemplate {...page} />;
}
