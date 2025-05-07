
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const PrivacyPolicyPage = () => {
  // Get the current date in a formatted string
  const currentDate = "May 7, 2025";

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 max-w-4xl">
        <div className="mb-8">
          <Button asChild variant="ghost" size="sm" className="mb-4">
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </Button>
          <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
          <div className="text-muted-foreground text-sm">
            <p>Effective Date: {currentDate}</p>
            <p>Last Updated: {currentDate}</p>
          </div>
        </div>

        <div className="space-y-8 prose prose-gray dark:prose-invert max-w-none">
          <section>
            <h2 className="text-xl font-semibold">1. Introduction</h2>
            <p>
              Welcome to Distill ("we," "us," or "our"). This Privacy Policy presents a detailed framework that reflects our foundational commitment to the ethical and secure treatment of all personal and system-derived data that is gathered through our platform, accessible at distill.archlabs.app (the "Service"). It articulates our principles, data protection mechanisms, and operational practices that together ensure privacy and regulatory compliance.
            </p>
            <p>
              By using our Service, either as a registered user or as a visitor, you affirmatively consent to the policies outlined herein. If you do not agree to the terms, your recourse is to refrain from using the Service. The following provisions represent our transparent approach to data privacy and demonstrate our commitment to user autonomy, trust, and legal alignment.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Information We Collect</h2>
            <p>
              To provide an intelligent, responsive, and user-centric experience, we gather various types of information which may include user-submitted inputs and system-derived analytics. These are categorized as follows:
            </p>
            
            <h3 className="text-lg font-medium mt-4">a. Personally Identifiable Information (PII)</h3>
            <p>
              This category includes information that can be used to directly or indirectly identify you:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Email address:</strong> Required for creating and managing user accounts, conducting account recovery, and communicating key updates.</li>
              <li><strong>OpenAI API key:</strong> If voluntarily submitted, this is encrypted and stored securely. It is only used to facilitate customized AI-driven features within the platform.</li>
              <li><strong>Uploaded content:</strong> Videos, audio files, screenshots, transcripts, presentation slides, and related files submitted for processing, analysis, or generation.</li>
              <li><strong>User behavior metadata:</strong> Includes interaction logs, timestamps, project creation data, editing activity, and feature engagement history.</li>
            </ul>
            
            <h3 className="text-lg font-medium mt-4">b. System-Derived Metadata</h3>
            <p>
              This includes information automatically generated through your use of the platform:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Device specifications:</strong> Information such as browser type, operating system, screen resolution, and device type used to access the Service.</li>
              <li><strong>IP address and inferred geolocation:</strong> Employed for session integrity, usage monitoring, and enhanced account security.</li>
              <li><strong>Referral and session pathway data:</strong> Analyzes user flow through the application and helps us refine our interface, identify bottlenecks, and increase performance.</li>
              <li><strong>Application error logs:</strong> Captures crash reports and warnings that aid in technical troubleshooting and performance stabilization.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. How We Use Your Data</h2>
            <p>
              Your data enables a broad range of functionality. We employ the information we collect solely for purposes that are aligned with your expectations and our service obligations. Specifically, we use your data to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Authenticate and manage secure user access</li>
              <li>Process and store user-generated content for AI-powered slide creation</li>
              <li>Track usage metrics for feature optimization</li>
              <li>Deliver targeted, context-sensitive support and troubleshooting</li>
              <li>Prevent fraud, abuse, and unauthorized system access</li>
              <li>Notify users of important changes, policy updates, or new features</li>
              <li>Generate anonymized analytics for product research and system scaling</li>
              <li>Refine content generation algorithms based on aggregated behavior patterns</li>
            </ul>
            <p>
              We explicitly do not monetize, sell, lease, or disclose your information to third-party advertisers or marketers under any circumstances.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Data Security and Storage</h2>
            <p>
              We have implemented multilayered security strategies to safeguard your data at rest and in transit:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Supabase functions as our primary backend service provider, offering enterprise-grade encryption, role-based access control, and GDPR-compliant infrastructure.</li>
              <li>Files are uploaded to Supabase Storage buckets that are strictly governed by per-user access policies and time-based expiration rules.</li>
              <li>Sensitive keys and tokens are stored exclusively in backend server environments and are never exposed in client-side code or UI.</li>
              <li>All data transmitted between clients and our servers is encrypted using HTTPS/TLS protocols, ensuring confidentiality and integrity.</li>
            </ul>
            <p>
              We strongly recommend users adopt best practices for digital hygiene, including the use of strong passwords, enabling multi-factor authentication (when available), and safeguarding access to email accounts linked to the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Data Retention</h2>
            <p>
              We enforce rigorous policies regarding the lifecycle of the data we collect:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Uploaded files and associated project data are retained for a maximum of 48 hours to allow user review and revision.</li>
              <li>After expiration, data is irreversibly purged using automated deletion scripts that remove the content from both our file storage and relational databases.</li>
              <li>Users have the option to delete their content prior to the 48-hour window through the user dashboard.</li>
              <li>We may retain anonymized data indefinitely for aggregate research, usage trend monitoring, and long-term platform improvements.</li>
              <li>All retained information is subject to review against our internal privacy metrics and security audit cycles.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Data Disclosure</h2>
            <p>
              We adhere to a strict policy of minimal disclosure. Your data is shared only under well-defined and narrowly scoped circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Operational necessity:</strong> We may transmit data to service partners (e.g., Supabase, OpenAI) strictly for processing your projects or hosting your data.</li>
              <li><strong>Legal obligation:</strong> Where required by a subpoena, court order, or other legal process, we will disclose the minimum necessary data to comply.</li>
              <li><strong>Security-related concerns:</strong> If we detect abuse, account compromise, or suspected criminal activity, we reserve the right to share limited data with law enforcement or cybersecurity professionals.</li>
            </ul>
            <p>
              We do not share user information with advertisers, social networks, or third-party analytics providers for monetization purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Your Rights</h2>
            <p>
              We respect your right to data control and comply with major international privacy frameworks such as the General Data Protection Regulation (GDPR), the California Consumer Privacy Act (CCPA), and related legislation. These rights may include:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Right of access:</strong> You may request a summary or copy of your personal data stored by us.</li>
              <li><strong>Right of rectification:</strong> You may request that we correct any inaccuracies in your stored information.</li>
              <li><strong>Right to erasure:</strong> You may request the deletion of your personal data in certain circumstances.</li>
              <li><strong>Right to restriction:</strong> You may ask us to restrict processing of your data.</li>
              <li><strong>Right to portability:</strong> You may request a machine-readable copy of your data for transmission to another provider.</li>
            </ul>
            <p>
              To initiate any of these rights, contact our support team via our <a href="https://github.com/tpvfmilk/insight-slide-forge/issues" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">GitHub issues page</a>. Requests will be processed within the legally required timeframe.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Children's Privacy</h2>
            <p>
              Our Service is not intended for users under the age of 13. We do not knowingly collect personal information from minors. If we become aware that a child under 13 has submitted data to our Service, we will promptly delete such information.
            </p>
            <p>
              We encourage parents and guardians to supervise minors' digital activities and to report any suspected unauthorized data submissions immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. International Users</h2>
            <p>
              As an internationally accessible application hosted in the United States, your data may be stored or processed in jurisdictions that may not provide the same level of data protection as your home country. By using our Service, you acknowledge and consent to these cross-border data transfers.
            </p>
            <p>
              We utilize Standard Contractual Clauses and other legally valid mechanisms to ensure that international data transfers comply with applicable data protection laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Changes to This Policy</h2>
            <p>
              This Privacy Policy may be revised periodically to reflect legal updates, technological enhancements, or platform modifications. If material changes are made, we will update the "Effective Date" and may notify users through email or an in-app notification.
            </p>
            <p>
              We recommend reviewing this page regularly to stay informed about how we protect your data. Continued use of the Service after changes are posted constitutes your acknowledgment and acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">11. Contact Us</h2>
            <p>
              For questions, complaints, or requests related to your personal data or this Privacy Policy, please contact us at:
            </p>
            <p>
              <a href="https://github.com/tpvfmilk/insight-slide-forge/issues" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                GitHub Issues
              </a>
            </p>
            <p>
              We value transparency and user trust and strive to respond to all legitimate inquiries in accordance with industry best practices and regulatory expectations.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
