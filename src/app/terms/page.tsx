"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-[#0a0a0a]">
      {/* Header */}
      <header className="py-6 px-6 border-b border-[#e4e4e7]">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Image
            src="/assets/dawn-logo.png"
            alt="Dawn"
            width={32}
            height={32}
          />
          <Link href="/" className="font-serif text-xl hover:text-[#71717a] transition-colors">
            dawn
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="font-serif text-4xl md:text-5xl mb-4">terms of service</h1>
            <p className="text-[#71717a] mb-12">last updated: january 23, 2025</p>

            <div className="prose prose-zinc max-w-none">
              <p className="text-[#71717a] mb-8">
                These Terms of Service (&quot;Terms&quot;) constitute a legally binding agreement between you (&quot;you,&quot; &quot;your,&quot; or &quot;User&quot;) and Dawn (&quot;Dawn,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) governing your access to and use of the Dawn desktop application (the &quot;App&quot;), our websites, and all related services (collectively, the &quot;Services&quot;).
              </p>

              <p className="text-[#0a0a0a] font-medium mb-8">
                BY DOWNLOADING, INSTALLING, ACCESSING, OR USING THE SERVICES, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS. IF YOU DO NOT AGREE TO THESE TERMS, DO NOT USE THE SERVICES.
              </p>

              <Section title="1. Who We Are">
                <p>The Services are provided by Dawn.</p>
                <p>Contact: <strong>work.dslalwani@gmail.com</strong></p>
              </Section>

              <Section title="2. Eligibility">
                <p>You must be at least <strong>13 years old</strong> to use the Services. If you are under the age of majority in your jurisdiction, you may use the Services only with the consent of a parent or legal guardian who agrees to be bound by these Terms on your behalf.</p>
                <p>By using the Services, you represent and warrant that you meet these eligibility requirements.</p>
              </Section>

              <Section title="3. Description of the Services">
                <p>Dawn provides an OS-level overlay application that may include:</p>
                <ul>
                  <li><strong>Speech-to-text transcription</strong> (basic and &quot;smart&quot; transcription with AI-powered formatting)</li>
                  <li><strong>AI-powered chat</strong> functionality</li>
                  <li><strong>Local notes</strong> creation and management</li>
                  <li><strong>Local browsing panels</strong></li>
                  <li><strong>Overlay interfaces</strong> for quick access to features</li>
                </ul>

                <h4 className="text-[#0a0a0a] font-medium mt-6 mb-3">3.1 Local-First Architecture</h4>
                <p><strong>By design, the Services operate on a local-first principle.</strong> This means:</p>
                <ul>
                  <li>The <strong>content</strong> of your notes, chats, and browser usage (including page content, URLs visited, and any text you enter) <strong>remains stored locally on your device</strong>.</li>
                  <li>We do <strong>not</strong> collect, transmit, or store this content on our servers.</li>
                  <li>Your local data is your responsibility to back up and secure.</li>
                </ul>

                <h4 className="text-[#0a0a0a] font-medium mt-6 mb-3">3.2 Third-Party AI Services</h4>
                <p>Certain features (transcription, smart transcription, AI chat) rely on third-party AI providers. When you use these features:</p>
                <ul>
                  <li>Your <strong>input data</strong> (audio for transcription, text prompts for chat) <strong>is transmitted directly to the third-party provider</strong> to process your request.</li>
                  <li>This transmission occurs <strong>between your device and the third-party provider</strong>—Dawn does not store or have access to this data in transit or after processing.</li>
                  <li>The third-party provider&apos;s terms and privacy policies govern their handling of your data.</li>
                </ul>
              </Section>

              <Section title="4. Accounts and Authentication">
                <h4 className="text-[#0a0a0a] font-medium mb-3">4.1 Account Creation</h4>
                <p>You may be required to authenticate during onboarding. You agree to:</p>
                <ul>
                  <li>Provide accurate, current, and complete information during registration</li>
                  <li>Maintain and promptly update your account information</li>
                  <li>Maintain the security and confidentiality of your login credentials</li>
                  <li>Notify us immediately of any unauthorized use of your account</li>
                </ul>

                <h4 className="text-[#0a0a0a] font-medium mt-6 mb-3">4.2 Account Responsibility</h4>
                <p>You are solely responsible for all activity that occurs under your account, whether or not you authorized such activity. We are not liable for any loss or damage arising from your failure to comply with this section.</p>
              </Section>

              <Section title="5. Bring Your Own API Key (BYO Key) Model">
                <h4 className="text-[#0a0a0a] font-medium mb-3">5.1 Current Model</h4>
                <p>Currently, certain features of the Services require you to provide your own API keys from third-party service providers (such as Groq, OpenAI, Google, or other AI/transcription providers).</p>

                <h4 className="text-[#0a0a0a] font-medium mt-6 mb-3">5.2 Your Responsibilities</h4>
                <p>When using the BYO Key model:</p>
                <ul>
                  <li><strong>You are solely responsible</strong> for obtaining, maintaining, and securing your API keys.</li>
                  <li><strong>You are solely responsible</strong> for any charges, fees, or costs incurred through your use of third-party APIs.</li>
                  <li><strong>You must comply</strong> with the third-party provider&apos;s terms of service, acceptable use policies, and usage limits.</li>
                  <li><strong>You acknowledge</strong> that your API keys may be stored locally on your device for functionality purposes.</li>
                </ul>

                <h4 className="text-[#0a0a0a] font-medium mt-6 mb-3">5.3 Third-Party Terms</h4>
                <p>Your use of any third-party services through the App is governed by that third party&apos;s terms of service and privacy policy, <strong>not</strong> by these Terms.</p>

                <h4 className="text-[#0a0a0a] font-medium mt-6 mb-3">5.4 Future Subscription Model</h4>
                <p>We may introduce subscription plans in the future that provide managed API access, removing the need for BYO keys. If introduced, such subscriptions will be subject to additional terms.</p>
              </Section>

              <Section title="6. AI-Generated Content Disclaimer">
                <h4 className="text-[#0a0a0a] font-medium mb-3">6.1 No Guarantee of Accuracy</h4>
                <p>The Services may utilize artificial intelligence and machine learning models provided by third parties. <strong>AI-generated outputs (including but not limited to transcriptions, smart transcriptions, and chat responses) may be inaccurate, incomplete, misleading, biased, or inappropriate.</strong></p>

                <h4 className="text-[#0a0a0a] font-medium mt-6 mb-3">6.2 Your Responsibility</h4>
                <p>You acknowledge and agree that:</p>
                <ul>
                  <li><strong>You are solely responsible</strong> for reviewing, verifying, and evaluating all AI-generated content before relying on or using it.</li>
                  <li><strong>You must not</strong> rely on AI-generated content for critical decisions without independent verification.</li>
                  <li><strong>AI outputs do not constitute</strong> professional advice of any kind (medical, legal, financial, psychological, or otherwise).</li>
                  <li><strong>Dawn is not responsible</strong> for the quality, accuracy, or appropriateness of any AI-generated content.</li>
                </ul>
              </Section>

              <Section title="7. Acceptable Use Policy">
                <p>You agree not to (and not to attempt to):</p>
                <ul>
                  <li>Use the Services for any <strong>illegal purpose</strong> or in violation of any law or regulation</li>
                  <li>Use the Services to <strong>infringe</strong> the intellectual property, privacy, publicity, or other rights of any third party</li>
                  <li>Use the Services to <strong>harass, abuse, defame, threaten, or intimidate</strong> any person</li>
                  <li>Use the Services to generate, distribute, or facilitate <strong>spam, malware, or malicious content</strong></li>
                  <li><strong>Reverse engineer, decompile, disassemble, or derive source code</strong> from the Services, except where such restriction is prohibited by applicable law</li>
                  <li><strong>Resell, sublicense, or commercially exploit</strong> the Services without our prior written consent</li>
                </ul>
              </Section>

              <Section title="8. Your Content and Data">
                <h4 className="text-[#0a0a0a] font-medium mb-3">8.1 Ownership</h4>
                <p>You retain all ownership rights to the content you create locally using the Services (notes, chat conversations, etc.). We do not claim ownership of your local content.</p>

                <h4 className="text-[#0a0a0a] font-medium mt-6 mb-3">8.2 Your Responsibilities</h4>
                <p>You are solely responsible for:</p>
                <ul>
                  <li><strong>Backing up</strong> your device and all local data—we are not responsible for any loss of data</li>
                  <li><strong>Securing</strong> your device against unauthorized access</li>
                  <li><strong>Reviewing and verifying</strong> any outputs before relying on or sharing them</li>
                </ul>
              </Section>

              <Section title="9. Intellectual Property">
                <p>We and our licensors own all right, title, and interest in and to the Services, including all software, code, technology, designs, graphics, and trademarks.</p>
                <p>Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, non-sublicensable, revocable license to download, install, and use the Services for your personal, non-commercial purposes.</p>
              </Section>

              <Section title="10. Disclaimer of Warranties">
                <p className="text-[#0a0a0a] font-medium">
                THE SERVICES ARE PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.
              </p>  <p className="mt-4">TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, WE EXPRESSLY DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.</p>
              </Section>

              <Section title="11. Limitation of Liability">
                <p className="text-[#0a0a0a] font-medium">
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL DAWN BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS OPPORTUNITIES.
              </p>  <p className="mt-4">OUR TOTAL CUMULATIVE LIABILITY SHALL NOT EXCEED THE GREATER OF THE AMOUNTS YOU HAVE PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR FIFTY UNITED STATES DOLLARS (US $50).</p>
              </Section>

              <Section title="12. Dispute Resolution">
                <p>Before filing any formal legal action, you agree to first contact us at <strong>work.dslalwani@gmail.com</strong> and attempt to resolve any dispute informally for at least <strong>thirty (30) days</strong>.</p>
                <p className="mt-4">If we cannot resolve a dispute informally, any dispute shall be resolved by binding individual arbitration, rather than in court. You and Dawn each waive the right to a jury trial.</p>
              </Section>

              <Section title="13. Governing Law">
                <p>These Terms shall be governed by and construed in accordance with the laws of the <strong>State of Delaware, United States</strong>, without regard to its conflict of law principles.</p>
              </Section>

              <Section title="14. Termination">
                <p>You may stop using the Services at any time. You may delete your account by contacting us at <strong>work.dslalwani@gmail.com</strong>.</p>
                <p className="mt-4">We may suspend or terminate your access to the Services at any time, with or without cause, with or without notice.</p>
              </Section>

              <Section title="15. Changes to These Terms">
                <p>We may modify these Terms at any time by posting the revised Terms on our website or within the App.</p>
                <p className="mt-4"><strong>Your continued use of the Services after any changes constitutes your acceptance of the new Terms.</strong></p>
              </Section>

              <Section title="16. Contact Us">
                <p>If you have any questions, concerns, or feedback about these Terms or the Services, please contact us at:</p>
                <p className="mt-2"><strong>Email:</strong> work.dslalwani@gmail.com</p>
              </Section>

              <p className="text-[#0a0a0a] font-medium mt-12 pt-8 border-t border-[#e4e4e7]">
                BY USING THE SERVICES, YOU ACKNOWLEDGE THAT YOU HAVE READ THESE TERMS OF SERVICE, UNDERSTAND THEM, AND AGREE TO BE BOUND BY THEM.
              </p>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[#e4e4e7]">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-sm text-[#71717a]">
            © 2026 dawn 
          </p>
          <div className="flex gap-8">
            <Link href="/terms" className="text-sm text-[#71717a] hover:text-[#0a0a0a] transition-colors">
              terms
            </Link>
            <Link href="/privacy" className="text-sm text-[#71717a] hover:text-[#0a0a0a] transition-colors">
              privacy
            </Link>
            <a href="mailto:work.dslalwani@gmail.com" className="text-sm text-[#71717a] hover:text-[#0a0a0a] transition-colors">
              contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h3 className="text-xl font-medium text-[#0a0a0a] mb-4">{title}</h3>
      <div className="text-[#71717a] space-y-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_li]:text-[#71717a]">
        {children}
      </div>
    </div>
  );
}
