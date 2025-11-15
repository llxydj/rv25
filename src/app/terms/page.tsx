import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-md">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-red-600 hover:text-red-500">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Home
          </Link>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms and Conditions</h1>

          <div className="prose prose-red max-w-none">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using the RVOIS (Rescue Volunteers Operations Information System) application, you agree
              to be bound by these Terms and Conditions. If you do not agree to all the terms and conditions, you may
              not access or use the application.
            </p>

            <h2>2. Description of Service</h2>
            <p>
              RVOIS is an emergency response coordination system for Talisay City, Negros Occidental. The application
              allows residents to report incidents, volunteers to respond to incidents, and administrators to manage the
              system.
            </p>

            <h2>3. User Accounts</h2>
            <p>
              To use certain features of the application, you must register for an account. You agree to provide
              accurate, current, and complete information during the registration process and to update such information
              to keep it accurate, current, and complete.
            </p>

            <h2>4. User Responsibilities</h2>
            <p>
              Users are responsible for maintaining the confidentiality of their account credentials and for all
              activities that occur under their account. Users agree to notify RVOIS immediately of any unauthorized use
              of their account or any other breach of security.
            </p>

            <h2>5. Acceptable Use</h2>
            <p>
              Users agree to use the application only for lawful purposes and in accordance with these Terms. Users
              agree not to use the application:
            </p>
            <ul>
              <li>In any way that violates any applicable federal, state, local, or international law or regulation</li>
              <li>
                To transmit, or procure the sending of, any advertising or promotional material, including any "junk
                mail," "chain letter," "spam," or any other similar solicitation
              </li>
              <li>
                To impersonate or attempt to impersonate RVOIS, a RVOIS employee, another user, or any other person or
                entity
              </li>
              <li>
                To engage in any other conduct that restricts or inhibits anyone's use or enjoyment of the application,
                or which, as determined by RVOIS, may harm RVOIS or users of the application or expose them to liability
              </li>
            </ul>

            <h2>6. Emergency Response</h2>
            <p>
              RVOIS is designed to facilitate emergency response coordination but is not a substitute for emergency
              services. In case of a life-threatening emergency, users should contact emergency services directly by
              calling the appropriate emergency number.
            </p>

            <h2>7. Privacy</h2>
            <p>
              RVOIS collects and processes personal data as described in our Privacy Policy. By using the application,
              you consent to such processing and you warrant that all data provided by you is accurate.
            </p>

            <h2>8. Limitation of Liability</h2>
            <p>
              RVOIS and its suppliers shall not be liable for any indirect, incidental, special, consequential, or
              punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible
              losses, resulting from your access to or use of or inability to access or use the application.
            </p>

            <h2>9. Changes to Terms</h2>
            <p>
              RVOIS reserves the right, at its sole discretion, to modify or replace these Terms at any time. If a
              revision is material, RVOIS will provide at least 30 days' notice prior to any new terms taking effect.
            </p>

            <h2>10. Contact Information</h2>
            <p>If you have any questions about these Terms, please contact us at support@rvois.gov.ph.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
