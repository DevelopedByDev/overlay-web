# Overlay Privacy Policy

**Last updated:** January 23, 2025

This Privacy Policy explains how Overlay ("Overlay," "we," "us," or "our") collects, uses, discloses, and protects information when you use the Overlay desktop application (the "App") and related services (the "Services").

**BY USING THE SERVICES, YOU ACKNOWLEDGE THAT YOU HAVE READ AND UNDERSTOOD THIS PRIVACY POLICY AND AGREE TO THE COLLECTION, USE, AND DISCLOSURE OF YOUR INFORMATION AS DESCRIBED HEREIN.**

---

## 1. Summary (Plain Language Overview)

**We believe in transparency.** Here's the key information in plain language:

| What | Details |
|------|---------|
| **Local-first content** | We do **NOT** collect or store the content of your notes, chats, transcriptions, or browser usage. That content stays on your device. |
| **What we collect** | Authentication data (email), and in the future, anonymous usage counts (not content). |
| **BYO API keys** | When you use your own API keys, your data goes directly to the third-party provider (e.g., Groq, OpenAI)—we never see it. |
| **We don't sell data** | We do not sell your personal information. Period. |

---

## 2. Information We Collect

### 2.1 Account and Authentication Information

During onboarding and authentication, we collect:
- **Email address** and/or authentication identifiers (depending on login method)
- **Account metadata** (e.g., account creation date, last login timestamp)
- **Authentication tokens** (securely stored for session management)

### 2.2 Usage Analytics (Current and Future)

**Currently collected:**
- Basic authentication events (sign-in, sign-out)

**May be collected in the future** (non-content metrics only):
- **Feature usage counts:**
  - Number of transcriptions and smart transcriptions performed
  - Number of notes created (count only, not content)
  - Number of chat sessions or messages sent (count only, not content)
  - Overlay invocation counts (notes/chat/browser panels)
- **Feature engagement:**
  - Features enabled (hotkeys, auto-start, etc.)
  - Model/provider selection (e.g., "OpenAI" vs "Groq"—without prompts or outputs)
- **Funnel and activation metrics:**
  - Install → onboarding completion → first feature usage
  - Time-to-first-value measurements
- **Engagement metrics:**
  - Session counts and duration (coarse time buckets, not precise timestamps)
  - Daily/weekly active usage indicators
- **Performance telemetry:**
  - Transcription latency (bucketed ranges: p50/p95)
  - UI responsiveness metrics (frame drops, CPU usage buckets)
  - Crash-free session rates

**IMPORTANT:** We collect **event counts and timestamps only**—never the actual text, audio, or content of your transcriptions, notes, chats, or browsing activity.

### 2.3 Device and Technical Information

To operate and improve the Services, we may collect:
- **App version** and build number
- **Operating system** type and version
- **Device type** and hardware identifiers (anonymized where possible)
- **Language and locale** settings
- **Network type** (Wi-Fi, cellular—not specific network names)

### 2.4 Diagnostic and Crash Data

To maintain service reliability, we may collect:
- **Crash reports** and stack traces (automatically redacted to remove personal data)
- **Error codes** and error messages (technical codes only)
- **Performance logs** (response times, failure rates)

**Automatic redaction:** Our crash reporting is configured to redact:
- API keys and authentication tokens
- User-entered text and content
- File paths that might reveal usernames or personal directories

### 2.5 Security-Related Information

For account security and fraud prevention, we may collect:
- **IP address** (retained briefly, used only for security purposes)
- **Login timestamps** and patterns (for anomaly detection)
- **Device fingerprint** information (for suspicious login detection)

This information is used **solely for security purposes** (preventing unauthorized access, detecting fraudulent activity) and is retained only as long as necessary for these purposes.

### 2.6 Information You Provide Voluntarily

If you contact us for support or provide feedback, we collect:
- Your email address and name (if provided)
- The content of your communications
- Any attachments or screenshots you choose to share

### 2.7 Payment Information (Future)

If we introduce paid subscriptions:
- We will use a third-party payment processor (e.g., Stripe)
- We will **never** store raw credit card numbers or full payment details
- We may receive limited information from the processor (last 4 digits, expiration date, billing address) for records and support purposes

---

## 3. Information We Do NOT Collect

**We are committed to a local-first, privacy-respecting architecture.** We do **NOT** collect, store, or have access to:

-  **Content of your notes** (text, formatting, attachments)
-  **Content of your chats** (messages, prompts, AI responses)
-  **Content of your transcriptions** (audio, transcribed text)
-  **Content of your browser activity** (URLs visited, page content, browsing history)
-  **Keystrokes or keyboard input**
-  **Screen contents or screenshots** (unless you explicitly share them with support)
-  **Microphone audio** (beyond real-time processing for transcription, which occurs locally or is sent directly to your chosen third-party provider)
-  **Your API keys** (these are stored locally on your device only)

**Note:** If we ever introduce features that require collecting content data, we will:
1. Update this Privacy Policy with clear disclosure
2. Provide prominent notice to users
3. Obtain affirmative consent where required by law

---

## 4. How Information Flows When You Use Features

### 4.1 Transcription (BYO API Key)

```
Your Device → [Audio] → Third-Party Provider (e.g., Groq) → [Text] → Your Device
                              ↑
                        Uses YOUR API key
                        
Overlay servers: NOT INVOLVED in this data flow
```

When you use transcription:
1. Audio is captured on your device
2. Audio is sent **directly** from your device to the third-party provider using **your** API key
3. The transcribed text is returned **directly** to your device
4. **Overlay does not receive, store, or have access to your audio or transcriptions**

### 4.2 AI Chat (BYO API Key)

```
Your Device → [Prompt] → Third-Party Provider → [Response] → Your Device
                              ↑
                        Uses YOUR API key
                        
Overlay servers: NOT INVOLVED in this data flow
```

### 4.3 Local Notes and Data

```
Your Device ←→ Local Storage (on your device only)

Overlay servers: NOT INVOLVED
```

All notes, chat history, and local data remain on your device unless you explicitly export or share them.

---

## 5. How We Use Information

We use collected information for the following purposes:

| Purpose | Legal Basis (GDPR) |
|---------|-------------------|
| **Provide the Services** – authenticate you, maintain your account | Contract necessity |
| **Improve the Services** – fix bugs, optimize performance, develop features | Legitimate interests |
| **Security** – prevent fraud, detect abuse, protect against unauthorized access | Legitimate interests / Legal obligation |
| **Analytics** – understand feature usage patterns (aggregate, non-identifying) | Legitimate interests (with opt-out) |
| **Communications** – respond to support requests, send service notices | Contract necessity / Legitimate interests |
| **Legal compliance** – comply with laws, respond to legal requests | Legal obligation |

---

## 6. How We Share Information

**We do not sell your personal information.** We share information only in the following limited circumstances:

### 6.1 Service Providers

We may share limited information with trusted vendors who help us operate the Services:
- **Authentication providers** (e.g., identity verification)
- **Analytics services** (e.g., anonymized usage data)
- **Crash reporting services** (e.g., error logs)
- **Cloud hosting providers** (e.g., for account data storage)

These providers are bound by contractual obligations to:
- Process data only on our instructions
- Maintain confidentiality and security
- Not use data for their own purposes

### 6.2 Third-Party AI/API Providers (BYO Keys)

When you use features requiring third-party APIs with your own API keys:
- Your device communicates **directly** with the third-party provider
- We do **not** intermediate, access, or store this data
- The third-party provider's terms and privacy policy govern their handling of your data

**Examples of third-party providers you may use:**
- Groq (transcription, AI chat)
- OpenAI (AI chat)
- Google (AI chat)
- Other providers you configure

**You are responsible for reviewing and agreeing to each provider's terms.**

### 6.3 Legal Requirements and Safety

We may disclose information if we reasonably believe disclosure is necessary to:
- Comply with applicable law, regulation, or legal process
- Respond to lawful requests from public authorities (e.g., law enforcement, national security)
- Enforce our Terms of Service or other agreements
- Protect the rights, property, or safety of Overlay, our users, or the public
- Detect, prevent, or address fraud, security, or technical issues

### 6.4 Business Transfers

If Overlay is involved in a merger, acquisition, financing, reorganization, bankruptcy, or sale of assets:
- Information may be transferred as part of that transaction
- We will notify you of any change in ownership or control
- This Privacy Policy will continue to apply to your information

### 6.5 With Your Consent

We may share information with third parties when you explicitly consent to such sharing.

### 6.6 Aggregated or De-Identified Data

We may share aggregated or de-identified information that cannot reasonably be used to identify you. For example, we may share statistics about overall feature usage patterns.

---

## 7. Data Retention

We retain information only as long as necessary for the purposes described:

| Data Type | Retention Period |
|-----------|------------------|
| **Account data** | While your account is active + 30 days after deletion request |
| **Authentication logs** | 90 days (for security purposes) |
| **Crash/diagnostic data** | 30–90 days (unless needed for ongoing investigation) |
| **Support communications** | 2 years (for reference and quality purposes) |
| **Security logs (IP, device)** | 30 days (security purposes only) |
| **Aggregated analytics** | Indefinitely (non-identifying) |

**Local data on your device** (notes, chats, transcriptions) is under your control. We do not have access to delete it—you manage it through the App or your device's storage.

---

## 8. Data Security

We implement reasonable administrative, technical, and organizational measures to protect your information:

- **Encryption in transit** (TLS/HTTPS for all communications)
- **Encryption at rest** (for stored account data)
- **Access controls** (limited personnel access on need-to-know basis)
- **Regular security assessments** and updates
- **Secure development practices**

**Important:** No method of transmission or storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security. You are responsible for:
- Maintaining the security of your device
- Protecting your login credentials
- Safeguarding your API keys

---

## 9. Your Choices and Controls

### 9.1 Account Information
- **Access:** You can access your account information through the App settings
- **Update:** You can update your email and preferences in settings
- **Delete:** You can request account deletion by contacting divyansh@layernorm.co

### 9.2 Analytics Opt-Out
If/when we implement usage analytics:
- You will be able to opt out through App settings
- Opting out will disable non-essential analytics collection
- Essential security and crash reporting may continue

### 9.3 Communications
- **Service notices:** Required for account operation (cannot opt out)
- **Marketing:** We will obtain consent before sending marketing communications; you can unsubscribe anytime

### 9.4 Local Data
- Your local notes, chats, and transcriptions are under your full control
- You can delete them through the App at any time
- You can export your data for backup or portability

### 9.5 Device Permissions
- You can control microphone access through your operating system settings
- Denying microphone access will disable transcription features

---

## 10. Your Privacy Rights

Depending on your location, you may have the following rights:

### 10.1 For All Users
- **Access:** Request a copy of your personal information
- **Correction:** Request correction of inaccurate information
- **Deletion:** Request deletion of your personal information
- **Portability:** Request your data in a portable format

### 10.2 European Economic Area (EEA), UK, and Switzerland (GDPR)

If you are in the EEA, UK, or Switzerland, you have additional rights:
- **Restriction:** Request restriction of processing in certain circumstances
- **Objection:** Object to processing based on legitimate interests
- **Withdraw consent:** Where processing is based on consent
- **Lodge complaint:** With your local data protection authority

**Data controller:** Overlay  
**Contact:** divyansh@layernorm.co

### 10.3 California Residents (CCPA/CPRA)

If you are a California resident, you have the right to:
- **Know** what personal information we collect, use, and disclose
- **Delete** your personal information (subject to exceptions)
- **Opt out of sale:** We do not sell personal information
- **Non-discrimination:** We will not discriminate against you for exercising your rights

**Categories of personal information collected:** Identifiers (email), internet/electronic activity (usage analytics), geolocation (IP-derived, approximate)

**We do not sell personal information. We do not share personal information for cross-context behavioral advertising.**

### 10.4 Other Jurisdictions

We respect privacy rights under applicable laws worldwide. Contact us to exercise any rights available to you under your local law.

### 10.5 How to Exercise Rights

To exercise any privacy rights, contact us at:
- **Email:** divyansh@layernorm.co
- **Response time:** Within 30 days (may be extended by 60 days for complex requests)
- **Verification:** We may need to verify your identity before processing requests

---

## 11. Children's Privacy

The Services are **not directed to children under 13** (or under 16 in jurisdictions where a higher age applies).

- We do not knowingly collect personal information from children under 13
- If we learn we have collected information from a child under 13, we will delete it promptly
- If you believe a child has provided us with personal information, please contact us at divyansh@layernorm.co

---

## 12. International Data Transfers

If you access the Services from outside the United States:
- Your information may be transferred to, stored, and processed in the United States or other countries
- These countries may have different data protection laws than your country
- By using the Services, you consent to such transfers

**For EEA/UK users:** Where we transfer data outside the EEA/UK, we use appropriate safeguards such as:
- Standard Contractual Clauses approved by the European Commission
- Transfers to countries with adequate data protection (as determined by the European Commission)

---

## 13. Third-Party Links and Services

The Services may contain links to third-party websites or integrate with third-party services. This Privacy Policy does not apply to:
- Third-party websites you visit
- Third-party AI providers you connect via BYO API keys
- Any other third-party services

Please review the privacy policies of any third-party services you use.

---

## 14. Do Not Track

Some browsers have a "Do Not Track" (DNT) feature. We currently do not respond to DNT signals because there is no industry standard for DNT. We may update this policy if a standard emerges.

---

## 15. Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect changes in our practices, the Services, or applicable law.

**How we notify you:**
- We will update the "Last updated" date at the top
- For **material changes**, we will provide prominent notice (e.g., in-app notification, email) at least **15 days** before the changes take effect
- Your continued use after changes constitutes acceptance

**We encourage you to review this Privacy Policy periodically.**

---

## 16. Contact Us

If you have questions, concerns, or requests regarding this Privacy Policy or our data practices:

**Privacy inquiries:**  
Email: divyansh@layernorm.co

**General support:**  
Email: divyansh@layernorm.co

**Response time:** We aim to respond within 5 business days.

---

## 17. Additional Disclosures

### 17.1 Cookies and Similar Technologies

The desktop App does not use traditional web cookies. However:
- We may use local storage for session management and preferences
- Our website (if applicable) may use cookies—see our Cookie Policy for details

### 17.2 Analytics Partners

If/when we implement analytics, we may use:
- Privacy-focused analytics tools that do not track individuals across sites
- Self-hosted analytics solutions where feasible
- Tools configured to anonymize IP addresses

### 17.3 Crash Reporting

Our crash reporting is configured to:
- Automatically redact sensitive information (API keys, user content, file paths)
- Collect only technical information necessary for debugging
- Retain crash data for a limited period (30–90 days)

---

**Thank you for trusting Overlay with your privacy. We are committed to protecting your information and being transparent about our practices.**
