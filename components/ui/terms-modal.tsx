"use client"

import type React from "react"
import { X } from "lucide-react"

interface TermsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Terms and Conditions</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          <p className="text-sm text-gray-500 mb-4">Last revised: May 1, 2025</p>

          <h3 className="font-bold text-lg mb-2">1. Introduction</h3>
          <p className="mb-4">
            Welcome to RVOIS: Rescue Volunteers Operations Information System. By using this system, you agree to the
            following terms and conditions, which include the collection, use, and processing of your personal data as
            outlined below.
          </p>

          <h3 className="font-bold text-lg mb-2">2. Information We Collect</h3>
          <p className="mb-2">
            We collect personal data necessary for the operation of RVOIS and RADIANT Rescue Volunteers INC. This
            includes:
          </p>
          <ul className="list-disc pl-5 mb-4">
            <li>
              Personal Identification Information: Name, email address, phone number, address, and other details
              relevant to your registration.
            </li>
            <li>Geolocation Data: Your location (for emergency reporting and mapping).</li>
            <li>Other Relevant Data: Incident reports, status updates, and interaction with the system.</li>
          </ul>

          <h3 className="font-bold text-lg mb-2">3. Purpose of Data Collection</h3>
          <p className="mb-2">The personal data you provide will be used for the following purposes:</p>
          <ul className="list-disc pl-5 mb-4">
            <li>To create and manage your account (resident, admin, volunteer).</li>
            <li>To process and store emergency reports and incident-related information.</li>
            <li>To communicate with you about your report, activities, and system updates.</li>
            <li>To comply with legal obligations such as reporting to relevant government agencies.</li>
            <li>To send notifications regarding incidents, emergency services, and related updates.</li>
          </ul>

          <h3 className="font-bold text-lg mb-2">4. How We Use Your Data</h3>
          <p className="mb-2">
            RVOIS uses your data to ensure that the platform functions efficiently, including but not limited to:
          </p>
          <ul className="list-disc pl-5 mb-4">
            <li>Providing real-time incident updates.</li>
            <li>Connecting volunteers to emergencies.</li>
            <li>Ensuring security by preventing fraudulent activities.</li>
            <li>Enhancing user experience through analytics and system improvements.</li>
          </ul>

          <h3 className="font-bold text-lg mb-2">5. Data Security</h3>
          <p className="mb-4">
            We are committed to ensuring that your personal data is protected. We have implemented reasonable security
            measures to safeguard your personal data against unauthorized access, disclosure, alteration, and
            destruction. However, please be aware that no method of data transmission over the internet or electronic
            storage is 100% secure.
          </p>

          <h3 className="font-bold text-lg mb-2">6. Data Sharing</h3>
          <p className="mb-2">
            RVOIS will not sell, trade, or lease your personal data to third parties. However, your data may be shared
            with:
          </p>
          <ul className="list-disc pl-5 mb-4">
            <li>
              Authorized personnel within RVOIS for the purpose of managing and responding to emergency incidents.
            </li>
            <li>Government agencies if required by law (such as local authorities or law enforcement).</li>
          </ul>

          <h3 className="font-bold text-lg mb-2">7. Your Data Privacy Rights</h3>
          <p className="mb-2">Under the Philippine Data Privacy Act of 2012 (RA 10173), you have the following rights:</p>
          <ul className="list-disc pl-5 mb-4">
            <li>Right to Access: You may request access to your personal data stored in RVOIS.</li>
            <li>Right to Correction: You may request to correct any inaccurate or incomplete data.</li>
            <li>Right to Deletion: You may request the deletion of your personal data under certain conditions.</li>
            <li>Right to Object: You may object to the processing of your personal data for certain purposes.</li>
            <li>
              Right to Data Portability: You may request a copy of your personal data in a commonly used and readable
              format.
            </li>
          </ul>

          <h3 className="font-bold text-lg mb-2">8. Data Retention</h3>
          <p className="mb-4">
            We will retain your personal data only for as long as necessary to fulfill the purposes outlined in this
            agreement, unless a longer retention period is required by law or for other legitimate business purposes.
          </p>

          <h3 className="font-bold text-lg mb-2">9. Changes to These Terms</h3>
          <p className="mb-4">
            RADIANT Rescue Volunteers INC reserves the right to update these Terms and Conditions from time to time.
            When we make changes, we will update the "Last Revised" date at the top of this document. We encourage you
            to review this document periodically for any updates.
          </p>

          <h3 className="font-bold text-lg mb-2">10. Contact Information</h3>
          <p className="mb-2">
            For any inquiries or concerns regarding your data privacy or these Terms and Conditions, please contact us
            at:
          </p>
          <p className="mb-1">Email: radiantrescuevolunteers@gmail.com</p>
          <p className="mb-1">HOTLINE 0999 806-4555</p>
          <p className="mb-1">Land Line 712-3118</p>
          <p className="mb-4">Address: Talisay City, Neg. Occ. Philippines</p>
        </div>
        <div className="p-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
