"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";

export default function PrivacyPolicy() {
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
            <h1 className="font-serif text-4xl md:text-5xl mb-4">privacy policy</h1>
            <p className="text-[#71717a] mb-12">last updated: january 23, 2025</p>

            <div className="prose prose-zinc max-w-none">
              <p className="text-[#71717a] mb-8">
                This Privacy Policy explains how Dawn (&quot;Dawn,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collects, uses, discloses, and protects information when you use the Dawn desktop application (the &quot;App&quot;) and related services (the &quot;Services&quot;).
              </p>

              <p className="text-[#0a0a0a] font-medium mb-8">
                BY USING THE SERVICES, YOU ACKNOWLEDGE THAT YOU HAVE READ AND UNDERSTOOD THIS PRIVACY POLICY AND AGREE TO THE COLLECTION, USE, AND DISCLOSURE OF YOUR INFORMATION AS DESCRIBED HEREIN.
              </p>

              {/* Summary Box */}
              <div className="bg-[#f4f4f5] border border-[#e4e4e7] rounded-2xl p-6 mb-10">
                <h3 className="text-lg font-medium text-[#0a0a0a] mb-4">Summary (Plain Language Overview)</h3>
                <p className="text-[#71717a] mb-4"><strong className="text-[#0a0a0a]">We believe in transparency.</strong> Here&apos;s the key information:</p>
                <div className="space-y-3 text-[#71717a]">
                  <div className="flex gap-3">
                    <span className="text-[#0a0a0a] font-medium min-w-[140px]">Local-first content</span>
                    <span>We do <strong className="text-[#0a0a0a]">NOT</strong> collect or store the content of your notes, chats, transcriptions, or browser usage. That content stays on your device.</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-[#0a0a0a] font-medium min-w-[140px]">What we collect</span>
                    <span>Authentication data (email), and in the future, anonymous usage counts (not content).</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-[#0a0a0a] font-medium min-w-[140px]">BYO API keys</span>
                    <span>When you use your own API keys, your data goes directly to the third-party provider (e.g., Groq, OpenAI)—we never see it.</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-[#0a0a0a] font-medium min-w-[140px]">We don&apos;t sell data</span>
                    <span>We do not sell your personal information. Period.</span>
                  </div>
                </div>
              </div>

              <Section title="1. Information We Collect">
                <h4 className="text-[#0a0a0a] font-medium mb-3">1.1 Account and Authentication Information</h4>
                <p>During onboarding and authentication, we collect:</p>
                <ul>
                  <li><strong>Email address</strong> and/or authentication identifiers (depending on login method)</li>
                  <li><strong>Account metadata</strong> (e.g., account creation date, last login timestamp)</li>
                  <li><strong>Authentication tokens</strong> (securely stored for session management)</li>
                </ul>

                <h4 className="text-[#0a0a0a] font-medium mt-6 mb-3">1.2 Usage Analytics (Current and Future)</h4>
                <p><strong>Currently collected:</strong> Basic authentication events (sign-in, sign-out)</p>
                <p className="mt-3"><strong>May be collected in the future</strong> (non-content metrics only):</p>
                <ul>
                  <li>Feature usage counts (number of transcriptions, notes created, etc.)</li>
                  <li>Feature engagement (features enabled, model/provider selection)</li>
                  <li>Performance telemetry (latency metrics, crash-free session rates)</li>
                </ul>
                <p className="mt-3 text-[#0a0a0a]"><strong>IMPORTANT:</strong> We collect event counts and timestamps only—never the actual text, audio, or content of your transcriptions, notes, chats, or browsing activity.</p>

                <h4 className="text-[#0a0a0a] font-medium mt-6 mb-3">1.3 Device and Technical Information</h4>
                <p>To operate and improve the Services, we may collect:</p>
                <ul>
                  <li>App version and build number</li>
                  <li>Operating system type and version</li>
                  <li>Device type and hardware identifiers (anonymized where possible)</li>
                  <li>Language and locale settings</li>
                </ul>

                <h4 className="text-[#0a0a0a] font-medium mt-6 mb-3">1.4 Diagnostic and Crash Data</h4>
                <p>To maintain service reliability, we may collect crash reports, error codes, and performance logs. Our crash reporting is configured to automatically redact API keys, user-entered text, and file paths.</p>
              </Section>

              <Section title="2. Information We Do NOT Collect">
                <p><strong className="text-[#0a0a0a]">We are committed to a local-first, privacy-respecting architecture.</strong> We do NOT collect, store, or have access to:</p>
                <ul>
                  <li> Content of your notes (text, formatting, attachments)</li>
                  <li> Content of your chats (messages, prompts, AI responses)</li>
                  <li> Content of your transcriptions (audio, transcribed text)</li>
                  <li> Content of your browser activity (URLs visited, page content, browsing history)</li>
                  <li> Keystrokes or keyboard input</li>
                  <li> Screen contents or screenshots (unless you explicitly share them with support)</li>
                  <li> Your API keys (these are stored locally on your device only)</li>
                </ul>
              </Section>

              <Section title="3. How Information Flows When You Use Features">
                <h4 className="text-[#0a0a0a] font-medium mb-3">3.1 Transcription (BYO API Key)</h4>
                <p>When you use transcription:</p>
                <ol className="list-decimal pl-6 space-y-2">
                  <li>Audio is captured on your device</li>
                  <li>Audio is sent <strong>directly</strong> from your device to the third-party provider using <strong>your</strong> API key</li>
                  <li>The transcribed text is returned <strong>directly</strong> to your device</li>
                  <li><strong>Dawn does not receive, store, or have access to your audio or transcriptions</strong></li>
                </ol>

                <h4 className="text-[#0a0a0a] font-medium mt-6 mb-3">3.2 AI Chat (BYO API Key)</h4>
                <p>Same flow as transcription—your device communicates directly with the third-party provider. Dawn servers are not involved.</p>

                <h4 className="text-[#0a0a0a] font-medium mt-6 mb-3">3.3 Local Notes and Data</h4>
                <p>All notes, chat history, and local data remain on your device unless you explicitly export or share them. Dawn servers are not involved.</p>
              </Section>

              <Section title="4. How We Use Information">
                <ul>
                  <li><strong>Provide the Services</strong> – authenticate you, maintain your account</li>
                  <li><strong>Improve the Services</strong> – fix bugs, optimize performance, develop features</li>
                  <li><strong>Security</strong> – prevent fraud, detect abuse, protect against unauthorized access</li>
                  <li><strong>Analytics</strong> – understand feature usage patterns (aggregate, non-identifying)</li>
                  <li><strong>Communications</strong> – respond to support requests, send service notices</li>
                  <li><strong>Legal compliance</strong> – comply with laws, respond to legal requests</li>
                </ul>
              </Section>

              <Section title="5. How We Share Information">
                <p><strong className="text-[#0a0a0a]">We do not sell your personal information.</strong> We share information only in limited circumstances:</p>

                <h4 className="text-[#0a0a0a] font-medium mt-6 mb-3">5.1 Service Providers</h4>
                <p>We may share limited information with trusted vendors who help us operate the Services (authentication, analytics, crash reporting, cloud hosting). These providers are bound by contractual obligations.</p>

                <h4 className="text-[#0a0a0a] font-medium mt-6 mb-3">5.2 Third-Party AI/API Providers (BYO Keys)</h4>
                <p>When you use features requiring third-party APIs with your own API keys, your device communicates directly with the provider. We do not intermediate, access, or store this data.</p>

                <h4 className="text-[#0a0a0a] font-medium mt-6 mb-3">5.3 Legal Requirements</h4>
                <p>We may disclose information if required by law or to protect rights, property, or safety.</p>
              </Section>

              <Section title="6. Data Retention">
                <ul>
                  <li><strong>Account data</strong> – While your account is active + 30 days after deletion request</li>
                  <li><strong>Authentication logs</strong> – 90 days (for security purposes)</li>
                  <li><strong>Crash/diagnostic data</strong> – 30–90 days</li>
                  <li><strong>Support communications</strong> – 2 years</li>
                  <li><strong>Security logs</strong> – 30 days</li>
                </ul>
                <p className="mt-4"><strong>Local data on your device</strong> (notes, chats, transcriptions) is under your control. We do not have access to delete it.</p>
              </Section>

              <Section title="7. Data Security">
                <p>We implement reasonable security measures including:</p>
                <ul>
                  <li>Encryption in transit (TLS/HTTPS)</li>
                  <li>Encryption at rest (for stored account data)</li>
                  <li>Access controls (limited personnel access)</li>
                  <li>Regular security assessments</li>
                </ul>
                <p className="mt-4">No method of transmission or storage is 100% secure. You are responsible for maintaining the security of your device, login credentials, and API keys.</p>
              </Section>

              <Section title="8. Your Choices and Controls">
                <ul>
                  <li><strong>Access:</strong> You can access your account information through the App settings</li>
                  <li><strong>Update:</strong> You can update your email and preferences in settings</li>
                  <li><strong>Delete:</strong> You can request account deletion by contacting work.dslalwani@gmail.com</li>
                  <li><strong>Local Data:</strong> Your local notes, chats, and transcriptions are under your full control</li>
                  <li><strong>Device Permissions:</strong> You can control microphone access through your operating system settings</li>
                </ul>
              </Section>

              <Section title="9. Your Privacy Rights">
                <p>Depending on your location, you may have the following rights:</p>
                <ul>
                  <li><strong>Access:</strong> Request a copy of your personal information</li>
                  <li><strong>Correction:</strong> Request correction of inaccurate information</li>
                  <li><strong>Deletion:</strong> Request deletion of your personal information</li>
                  <li><strong>Portability:</strong> Request your data in a portable format</li>
                </ul>
                <p className="mt-4">To exercise any privacy rights, contact us at <strong>work.dslalwani@gmail.com</strong>. We aim to respond within 30 days.</p>
              </Section>

              <Section title="10. Children&apos;s Privacy">
                <p>The Services are <strong>not directed to children under 13</strong>. We do not knowingly collect personal information from children under 13. If we learn we have collected information from a child under 13, we will delete it promptly.</p>
              </Section>

              <Section title="11. International Data Transfers">
                <p>If you access the Services from outside the United States, your information may be transferred to, stored, and processed in the United States. By using the Services, you consent to such transfers.</p>
                <p className="mt-4">For EEA/UK users, we use appropriate safeguards such as Standard Contractual Clauses approved by the European Commission.</p>
              </Section>

              <Section title="12. Changes to This Privacy Policy">
                <p>We may update this Privacy Policy from time to time. For material changes, we will provide prominent notice at least 15 days before the changes take effect.</p>
                <p className="mt-4"><strong>Your continued use after changes constitutes acceptance.</strong></p>
              </Section>

              <Section title="13. Contact Us">
                <p>If you have questions about this Privacy Policy:</p>
                <p className="mt-2"><strong>Privacy inquiries:</strong> work.dslalwani@gmail.com</p>
                <p><strong>General support:</strong> work.dslalwani@gmail.com</p>
                <p className="mt-2">We aim to respond within 5 business days.</p>
              </Section>

              <p className="text-[#71717a] mt-12 pt-8 border-t border-[#e4e4e7]">
                Thank you for trusting Dawn with your privacy. We are committed to protecting your information and being transparent about our practices.
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
      <div className="text-[#71717a] space-y-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_li]:text-[#71717a] [&_ol]:space-y-2">
        {children}
      </div>
    </div>
  );
}
