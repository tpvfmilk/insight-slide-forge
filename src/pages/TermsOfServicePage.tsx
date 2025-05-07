
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const TermsOfServicePage = () => {
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
          <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
          <div className="text-muted-foreground text-sm">
            <p>Effective Date: {currentDate}</p>
            <p>Last Updated: {currentDate}</p>
          </div>
        </div>

        <div className="space-y-8 prose prose-gray dark:prose-invert max-w-none">
          <section>
            <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Distill web application located at distill.archlabs.app (the "Service"), you agree to be legally bound by these Terms of Service ("Terms"). These Terms govern your use of the Service and form a legally binding agreement between you and Distill. If you do not agree to these Terms, you must not use or access the Service.
            </p>
            <p>
              By using the Service, you confirm that you are legally competent to enter into these Terms and that you understand and accept all obligations, responsibilities, and limitations described herein.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Description of the Service</h2>
            <p>
              Distill provides a web-based platform that allows users to convert videos, audio content, transcripts, and related educational materials into AI-assisted study resources, including slide decks, summaries, and infographics. The platform utilizes proprietary algorithms, natural language processing, image and audio extraction technologies, and external APIs, such as those provided by OpenAI.
            </p>
            <p>
              We reserve the right to modify or discontinue any part of the Service at any time with or without notice. We are not liable to you or any third party if we exercise our right to modify, suspend, or discontinue the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Eligibility</h2>
            <p>
              To use the Service, you must be at least 13 years of age. If you are under the age of 18, you may only use the Service under the supervision of a parent or legal guardian who agrees to be bound by these Terms. If you do not meet the eligibility requirements, you may not use the Service.
            </p>
            <p>
              By using the Service, you represent and warrant that you meet all eligibility requirements outlined in this section.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. User Accounts</h2>
            <p>
              To access certain features, you must register for a user account. You agree to provide accurate, complete, and current information and to update your account details as necessary. You are solely responsible for maintaining the confidentiality of your login credentials and for any activity that occurs under your account.
            </p>
            <p>
              You must not share your account credentials with any third party. You are fully responsible for any and all activities that occur under your account. Distill disclaims any and all liability for activities conducted through your account, whether or not authorized by you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. User Content</h2>
            <p>
              You retain ownership of any materials, files, images, transcripts, or other content you upload to the Service ("User Content"). By uploading or submitting User Content, you grant Distill a non-exclusive, royalty-free, worldwide license to store, process, display, and use such content solely for the purpose of providing the Service.
            </p>
            <p>
              You represent and warrant that:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You have all necessary rights, licenses, and permissions to upload and use the User Content;</li>
              <li>Your User Content does not violate any applicable law or regulation;</li>
              <li>Your User Content does not infringe upon any third party's intellectual property or proprietary rights;</li>
              <li>Your User Content does not contain personal, confidential, or sensitive information about any third party without proper authorization.</li>
            </ul>
            <p>
              We reserve the right to delete or remove any content at our sole discretion, without prior notice, for any reason, including content that violates these Terms or applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. API Keys and External Services</h2>
            <p>
              Users may optionally provide their own third-party API keys, such as OpenAI API credentials, to enable specific features. By providing such keys, you acknowledge and agree:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Distill will use the API keys solely to perform tasks you initiate through the Service;</li>
              <li>Distill stores API keys securely and does not share them externally;</li>
              <li>You are responsible for monitoring, managing, and securing your own API usage;</li>
              <li>You assume full liability for any charges, data loss, or misuse related to your API usage;</li>
              <li>You must comply with any terms, policies, and usage restrictions of the API provider.</li>
            </ul>
            <p>
              Distill disclaims all liability arising from your use of external services and third-party APIs.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. License and Restrictions</h2>
            <p>
              Distill grants you a limited, revocable, non-exclusive, non-transferable license to use the Service solely for lawful and educational purposes in accordance with these Terms. You shall not:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Reproduce, distribute, or publicly display any portion of the Service without prior written authorization;</li>
              <li>Reverse engineer, decompile, or otherwise attempt to extract the source code of the Service;</li>
              <li>Interfere with, disrupt, or attempt to gain unauthorized access to the Service or its related systems;</li>
              <li>Upload viruses, malicious code, or perform actions that could compromise the security of the Service;</li>
              <li>Use the Service to compete with or replicate Distill or its core functionalities.</li>
            </ul>
            <p>
              We reserve the right to suspend or terminate your account if you violate any of these restrictions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Data Retention and Expiration</h2>
            <p>
              User-uploaded files, content, and generated output will be retained for a period not to exceed 48 hours. After this window, all such content is subject to automated deletion, without any obligation on the part of Distill to notify you or provide a backup.
            </p>
            <p>
              You acknowledge that you are solely responsible for downloading or saving any files or content you wish to retain. Distill assumes no liability for data that is lost, corrupted, deleted, or otherwise rendered unavailable following the expiration period.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Intellectual Property</h2>
            <p>
              All content, software, code, design, workflows, and branding elements of the Service (excluding User Content) are the sole property of Distill or its licensors and are protected by copyright, trademark, and other intellectual property laws.
            </p>
            <p>
              You agree not to remove, alter, or obscure any copyright, trademark, or other proprietary notices. Nothing in these Terms grants you ownership of any intellectual property rights held by Distill.
            </p>
            <p>
              Unauthorized use of any protected materials may subject you to civil and criminal penalties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Termination</h2>
            <p>
              We may terminate or suspend your access to the Service at any time, for any reason, including violation of these Terms. Upon termination, your license to use the Service will be automatically revoked, and your account and data may be permanently deleted.
            </p>
            <p>
              Termination does not limit any of our other rights or remedies, including the right to seek legal or equitable relief. We are not liable for any harm or loss resulting from the termination or suspension of your access to the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">11. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY LAW, DISTILL DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, RELIABILITY, OR NON-INFRINGEMENT.
            </p>
            <p>
              DISTILL MAKES NO WARRANTY THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, ERROR-FREE, OR THAT ANY DEFECTS WILL BE CORRECTED. WE DO NOT GUARANTEE THE RESULTS OF USING THE SERVICE.
            </p>
            <p>
              YOU USE THE SERVICE AT YOUR OWN RISK.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">12. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL DISTILL, ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, CONTRACTORS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES (INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR BUSINESS INTERRUPTION), WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), OR OTHERWISE, ARISING OUT OF OR IN CONNECTION WITH THE USE OR INABILITY TO USE THE SERVICE.
            </p>
            <p>
              IN NO EVENT SHALL DISTILL'S TOTAL LIABILITY TO YOU EXCEED THE AMOUNT YOU PAID, IF ANY, TO ACCESS OR USE THE SERVICE IN THE SIX (6) MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">13. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Distill, its affiliates, employees, officers, directors, agents, and licensors from and against any and all claims, damages, obligations, losses, liabilities, costs or debt, and expenses (including attorney's fees) arising from:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your use or misuse of the Service;</li>
              <li>Your violation of these Terms;</li>
              <li>Your violation of any applicable law, regulation, or third-party right, including intellectual property rights;</li>
              <li>Any content you upload or transmit via the Service.</li>
            </ul>
            <p>
              This indemnification obligation will survive termination or expiration of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">14. Modifications to the Terms</h2>
            <p>
              We reserve the right to amend or update these Terms at any time, in our sole discretion. If a revision is material, we will provide notice by email or through the Service. Your continued use of the Service after such modifications shall constitute your acknowledgment and acceptance of the updated Terms.
            </p>
            <p>
              If you do not agree to the updated Terms, you must stop using the Service immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">15. Governing Law and Jurisdiction</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to conflict of law provisions. You agree to submit to the exclusive jurisdiction of the courts located in that jurisdiction to resolve any dispute arising out of these Terms or your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">16. Contact Us</h2>
            <p>
              For questions, feedback, complaints, or notices under these Terms, you may contact us using the following:
            </p>
            <p>
              <a href="https://github.com/tpvfmilk/insight-slide-forge/issues" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                Reach out via GitHub issues
              </a>
            </p>
            <p>
              We will endeavor to respond to legitimate inquiries in a timely and professional manner.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
