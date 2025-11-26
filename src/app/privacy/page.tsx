import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>

          <div className="prose prose-red max-w-none">
            <p className="lead">
              This Privacy Policy describes how RVOIS (Rescue Volunteers Operations Information System) collects, uses,
              and shares your personal information when you use our application.
            </p>

            <h2>1. Information We Collect</h2>
            <p>We collect several types of information from and about users of our application, including:</p>
            <ul>
              <li>Personal identifiers (name, email address, phone number)</li>
              <li>Address information (street address, barangay, city, province)</li>
              <li>Account credentials (password, security questions)</li>
              <li>Location data (when reporting or responding to incidents)</li>
              <li>Incident information (descriptions, photos, status updates)</li>
              <li>Device information (IP address, browser type, operating system)</li>
            </ul>

            <h2>2. How We Collect Information</h2>
            <p>We collect information directly from you when you:</p>
            <ul>
              <li>Register for an account</li>
              <li>Report an incident</li>
              <li>Respond to an incident</li>
              <li>Update your profile</li>
              <li>Use the application's features</li>
            </ul>
            <p>
              We also collect information automatically as you navigate through the application, including usage
              details, IP addresses, and information collected through cookies and other tracking technologies.
            </p>

            <h2>3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, maintain, and improve the application</li>
              <li>Process and respond to incident reports</li>
              <li>Coordinate emergency response efforts</li>
              <li>Communicate with you about the application</li>
              <li>Protect the safety and security of users and the public</li>
              <li>Comply with legal obligations</li>
              <li>Analyze usage patterns to improve the application</li>
            </ul>

            <h2>4. Sharing Your Information</h2>
            <p>We may share your information with:</p>
            <ul>
              <li>Emergency responders and volunteers to facilitate incident response</li>
              <li>Government agencies when required by law</li>
              <li>Service providers who perform services on our behalf</li>
              <li>Law enforcement agencies when required by law</li>
            </ul>

            <h2>5. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal information from
              unauthorized access, disclosure, alteration, and destruction.
            </p>

            <h2>6. Your Rights</h2>
            <p>
              Depending on your location, you may have certain rights regarding your personal information, including:
            </p>
            <ul>
              <li>Access to your personal information</li>
              <li>Correction of inaccurate or incomplete information</li>
              <li>Deletion of your personal information</li>
              <li>Restriction of processing of your personal information</li>
              <li>Data portability</li>
            </ul>

            <h2>7. Children's Privacy</h2>
            <p>
              The application is not intended for children under 13 years of age, and we do not knowingly collect
              personal information from children under 13.
            </p>

            <h2>8. Changes to Our Privacy Policy</h2>
            <p>
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new
              Privacy Policy on this page and updating the "Last Updated" date.
            </p>

            <h2>9. Contact Information</h2>
            <p>If you have any questions about this Privacy Policy, please contact us at privacy@rvois.gov.ph.</p>

            <p className="text-sm text-gray-500 mt-8">Last Updated: November 15, 2023</p>
          </div>
        </div>
      </div>
    </div>
  )
}
