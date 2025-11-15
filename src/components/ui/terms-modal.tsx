"use client"

import type React from "react"
import { useState } from "react"
import { X, FileText, Shield, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TermsModalProps {
  isOpen: boolean
  onClose: () => void
  onAccept?: () => void
  requireAcceptance?: boolean
}

type TabType = 'terms' | 'privacy'

export const TermsModal: React.FC<TermsModalProps> = ({ 
  isOpen, 
  onClose, 
  onAccept,
  requireAcceptance = false 
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('terms')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [hasScrolledTerms, setHasScrolledTerms] = useState(false)
  const [hasScrolledPrivacy, setHasScrolledPrivacy] = useState(false)

  if (!isOpen) return null

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    const scrolledToBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50
    
    if (scrolledToBottom) {
      if (activeTab === 'terms') {
        setHasScrolledTerms(true)
      } else {
        setHasScrolledPrivacy(true)
      }
    }
  }

  const handleAccept = () => {
    if (requireAcceptance && (!termsAccepted || !privacyAccepted)) {
      return
    }
    onAccept?.()
    onClose()
  }

  const canAccept = !requireAcceptance || (termsAccepted && privacyAccepted && hasScrolledTerms && hasScrolledPrivacy)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-red-50 to-red-100">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Legal Information</h2>
            <p className="text-sm text-gray-600 mt-1">Please review our terms and privacy policy</p>
          </div>
          {!requireAcceptance && (
            <button 
              onClick={onClose} 
              className="text-gray-500 hover:text-gray-700 transition-colors p-2 hover:bg-white rounded-lg"
            >
              <X className="h-6 w-6" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
          <button
            onClick={() => setActiveTab('terms')}
            className={`flex-1 px-6 py-4 font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'terms'
                ? 'bg-white text-red-600 border-b-2 border-red-600'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <FileText className="h-5 w-5" />
            Terms & Conditions
            {termsAccepted && requireAcceptance && (
              <Check className="h-4 w-4 text-green-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex-1 px-6 py-4 font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'privacy'
                ? 'bg-white text-red-600 border-b-2 border-red-600'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Shield className="h-5 w-5" />
            Privacy Policy
            {privacyAccepted && requireAcceptance && (
              <Check className="h-4 w-4 text-green-600" />
            )}
          </button>
        </div>

        {/* Content */}
        <div 
          className="p-6 overflow-y-auto flex-1 bg-gray-50" 
          onScroll={handleScroll}
          style={{ scrollBehavior: 'smooth' }}
        >
          {activeTab === 'terms' ? (
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <p className="text-sm text-gray-500 mb-6 italic">Last revised: May 1, 2025</p>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">1. Introduction</h3>
              <p className="mb-6 text-gray-700 leading-relaxed">
                Welcome to RVOIS: Rescue Volunteers Operations Information System. By using this system, you agree to the
                following terms and conditions, which include the collection, use, and processing of your personal data as
                outlined below.
              </p>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">2. Information We Collect</h3>
              <p className="mb-3 text-gray-700 leading-relaxed">
                We collect personal data necessary for the operation of RVOIS and RADIANT Rescue Volunteers INC. This
                includes:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700">
                <li>
                  <strong>Personal Identification Information:</strong> Name, email address, phone number, address, and other details
                  relevant to your registration.
                </li>
                <li><strong>Geolocation Data:</strong> Your location (for emergency reporting and mapping).</li>
                <li><strong>Other Relevant Data:</strong> Incident reports, status updates, and interaction with the system.</li>
              </ul>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">3. Purpose of Data Collection</h3>
              <p className="mb-3 text-gray-700 leading-relaxed">The personal data you provide will be used for the following purposes:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700">
                <li>To create and manage your account (resident, admin, volunteer).</li>
                <li>To process and store emergency reports and incident-related information.</li>
                <li>To communicate with you about your report, activities, and system updates.</li>
                <li>To comply with legal obligations such as reporting to relevant government agencies.</li>
                <li>To send notifications regarding incidents, emergency services, and related updates.</li>
              </ul>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">4. How We Use Your Data</h3>
              <p className="mb-3 text-gray-700 leading-relaxed">
                RVOIS uses your data to ensure that the platform functions efficiently, including but not limited to:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700">
                <li>Providing real-time incident updates.</li>
                <li>Connecting volunteers to emergencies.</li>
                <li>Ensuring security by preventing fraudulent activities.</li>
                <li>Enhancing user experience through analytics and system improvements.</li>
              </ul>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">5. Data Security</h3>
              <p className="mb-6 text-gray-700 leading-relaxed">
                We are committed to ensuring that your personal data is protected. We have implemented reasonable security
                measures to safeguard your personal data against unauthorized access, disclosure, alteration, and
                destruction. However, please be aware that no method of data transmission over the internet or electronic
                storage is 100% secure.
              </p>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">6. Data Sharing</h3>
              <p className="mb-3 text-gray-700 leading-relaxed">
                RVOIS will not sell, trade, or lease your personal data to third parties. However, your data may be shared
                with:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700">
                <li>
                  Authorized personnel within RVOIS for the purpose of managing and responding to emergency incidents.
                </li>
                <li>Government agencies if required by law (such as local authorities or law enforcement).</li>
              </ul>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">7. Your Data Privacy Rights</h3>
              <p className="mb-3 text-gray-700 leading-relaxed">Under the Philippine Data Privacy Act of 2012 (RA 10173), you have the following rights:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700">
                <li><strong>Right to Access:</strong> You may request access to your personal data stored in RVOIS.</li>
                <li><strong>Right to Correction:</strong> You may request to correct any inaccurate or incomplete data.</li>
                <li><strong>Right to Deletion:</strong> You may request the deletion of your personal data under certain conditions.</li>
                <li><strong>Right to Object:</strong> You may object to the processing of your personal data for certain purposes.</li>
                <li>
                  <strong>Right to Data Portability:</strong> You may request a copy of your personal data in a commonly used and readable
                  format.
                </li>
              </ul>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">8. Data Retention</h3>
              <p className="mb-6 text-gray-700 leading-relaxed">
                We will retain your personal data only for as long as necessary to fulfill the purposes outlined in this
                agreement, unless a longer retention period is required by law or for other legitimate business purposes.
              </p>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">9. Changes to These Terms</h3>
              <p className="mb-6 text-gray-700 leading-relaxed">
                RADIANT Rescue Volunteers INC reserves the right to update these Terms and Conditions from time to time.
                When we make changes, we will update the "Last Revised" date at the top of this document. We encourage you
                to review this document periodically for any updates.
              </p>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">10. Contact Information</h3>
              <p className="mb-3 text-gray-700 leading-relaxed">
                For any inquiries or concerns regarding your data privacy or these Terms and Conditions, please contact us
                at:
              </p>
              <div className="bg-gray-50 border-l-4 border-red-600 p-4 rounded">
                <p className="mb-2 text-gray-800"><strong>📧 Email:</strong> radiantrescuevolunteers@gmail.com</p>
                <p className="mb-2 text-gray-800"><strong>📱 Hotline:</strong> 0999 806-4555</p>
                <p className="mb-2 text-gray-800"><strong>☎️ Landline:</strong> 712-3118</p>
                <p className="text-gray-800"><strong>🏢 Address:</strong> Talisay City, Negros Occidental, Philippines</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <p className="text-sm text-gray-500 mb-2 italic">Last Updated: May 1, 2025</p>
              <p className="text-sm text-gray-500 mb-6 italic">Effective Date: May 5, 2025</p>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">1. Introduction</h3>
              <p className="mb-6 text-gray-700 leading-relaxed">
                RVOIS (Rescue Volunteers Operations Information System), operated by RADIANT Rescue Volunteers Inc., respects your privacy and is committed to protecting your personal data in compliance with the Philippine Data Privacy Act of 2012 (RA 10173) and relevant regulations from the National Privacy Commission (NPC), Bangko Sentral ng Pilipinas (BSP), and Securities and Exchange Commission (SEC).
              </p>
              <p className="mb-6 text-gray-700 leading-relaxed">
                This Privacy Policy explains how we collect, use, process, share, and protect your personal information when you use our system, website, and services.
              </p>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">2. Information We Collect</h3>
              <p className="mb-3 text-gray-700 leading-relaxed">
                We collect only the data necessary for providing emergency response, communication, and account management services. This includes:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700">
                <li><strong>Personal Identification Information:</strong> Full name, address, contact number, email address, and gender.</li>
                <li><strong>Account Information:</strong> Username, password (encrypted), and user role (resident, admin, or volunteer).</li>
                <li><strong>Geolocation Data:</strong> Real-time or reported location data for emergency reporting and dispatch.</li>
                <li><strong>Incident Data:</strong> Details related to reported emergencies or volunteer activities.</li>
                <li><strong>System Logs:</strong> Device information, browser type, IP address, date/time of access, and error logs.</li>
                <li><strong>Optional Data:</strong> Uploaded photos, attachments, or user feedback.</li>
              </ul>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">3. How We Collect Information</h3>
              <p className="mb-3 text-gray-700 leading-relaxed">We collect information through:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700">
                <li>User registration and profile forms.</li>
                <li>Emergency report submissions and volunteer activity updates.</li>
                <li>System-generated logs and cookies.</li>
                <li>User communications via chat or contact features.</li>
                <li>Analytics tools that monitor usage for system improvement.</li>
              </ul>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">4. Purpose of Data Collection</h3>
              <p className="mb-3 text-gray-700 leading-relaxed">Your data is collected and processed for the following legitimate purposes:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700">
                <li>To create, verify, and manage user accounts.</li>
                <li>To facilitate communication and coordination during emergencies.</li>
                <li>To analyze and improve system functionality and response performance.</li>
                <li>To generate operational and statistical reports for service optimization.</li>
                <li>To comply with applicable laws and government regulations.</li>
                <li>To send important updates, notifications, and advisories regarding incidents and volunteer activities.</li>
              </ul>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">5. Legal Basis for Processing</h3>
              <p className="mb-3 text-gray-700 leading-relaxed">Data processing is conducted under any of the following lawful bases as provided by the Data Privacy Act of 2012 (RA 10173):</p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700">
                <li>The data subject's consent.</li>
                <li>Contractual necessity (to perform the requested service).</li>
                <li>Legal obligations imposed by government or regulatory authorities.</li>
                <li>Legitimate interest to improve safety and emergency response operations.</li>
              </ul>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">6. Data Sharing and Disclosure</h3>
              <p className="mb-3 text-gray-700 leading-relaxed">
                RVOIS will never sell or rent your personal data. However, your data may be disclosed to:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700">
                <li>Authorized RVOIS personnel for operations and reporting purposes.</li>
                <li>Local government units (LGUs) or law enforcement agencies when required by law.</li>
                <li>Third-party service providers (e.g., hosting or communication tools) bound by data privacy agreements.</li>
                <li>Regulatory bodies such as NPC, BSP, or SEC for compliance reporting.</li>
              </ul>
              <p className="mb-6 text-gray-700 leading-relaxed">
                All disclosures are limited, purpose-specific, and follow strict confidentiality protocols.
              </p>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">7. Data Storage and Retention</h3>
              <p className="mb-3 text-gray-700 leading-relaxed">
                All personal data is securely stored in encrypted databases hosted on restricted-access servers.
              </p>
              <p className="mb-3 text-gray-700 leading-relaxed">
                Data is retained only for as long as necessary to fulfill its stated purpose or as required by law.
              </p>
              <p className="mb-6 text-gray-700 leading-relaxed">
                When no longer needed, personal data will be safely deleted, anonymized, or destroyed following NPC Circular 16-01 (Guidelines on Data Disposal).
              </p>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">8. Data Protection and Security Measures</h3>
              <p className="mb-3 text-gray-700 leading-relaxed">
                RVOIS implements organizational, physical, and technical safeguards to ensure data security, including:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700">
                <li>Encrypted communication (HTTPS, SSL/TLS).</li>
                <li>Encrypted password storage (using modern hashing algorithms).</li>
                <li>Role-based access control (admin, volunteer, resident).</li>
                <li>Regular system audits and vulnerability testing.</li>
                <li>Backup and recovery procedures.</li>
                <li>Staff data privacy and security training.</li>
              </ul>
              <p className="mb-6 text-gray-700 leading-relaxed">
                While we employ strict measures, users are advised to protect their login credentials and report any unauthorized access immediately.
              </p>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">9. Cookies and Tracking Technologies</h3>
              <p className="mb-3 text-gray-700 leading-relaxed">Our system may use cookies or similar technologies to:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700">
                <li>Maintain user sessions and preferences.</li>
                <li>Analyze user activity for system optimization.</li>
                <li>Enhance functionality and usability.</li>
              </ul>
              <p className="mb-6 text-gray-700 leading-relaxed">
                Users can disable cookies in their browser settings, but some system features may not function properly without them.
              </p>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">10. User Rights Under the Data Privacy Act of 2012 (RA 10173)</h3>
              <p className="mb-3 text-gray-700 leading-relaxed">You have the following rights under RA 10173:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700">
                <li><strong>Right to be informed</strong> – Know how your data is collected and processed.</li>
                <li><strong>Right to access</strong> – Request a copy of your personal data.</li>
                <li><strong>Right to rectification</strong> – Request correction of inaccurate or incomplete data.</li>
                <li><strong>Right to erasure or blocking</strong> – Request deletion of your data under lawful conditions.</li>
                <li><strong>Right to data portability</strong> – Obtain and reuse your data for your own purposes.</li>
                <li><strong>Right to object</strong> – Withdraw consent to data processing.</li>
                <li><strong>Right to damages</strong> – Seek redress for any privacy violation.</li>
              </ul>
              <p className="mb-6 text-gray-700 leading-relaxed">
                Requests may be submitted to our Data Protection Officer (DPO) through the contact details below.
              </p>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">11. International Data Transfer</h3>
              <p className="mb-6 text-gray-700 leading-relaxed">
                RVOIS does not transfer personal data outside the Philippines. Should it become necessary, we ensure full compliance with NPC Advisory 2020-04 on cross-border data transfers.
              </p>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">12. Changes to This Privacy Policy</h3>
              <p className="mb-6 text-gray-700 leading-relaxed">
                We may revise this policy from time to time to comply with new laws or operational updates. Changes will be announced within the platform and reflected in the "Last Updated" section above.
              </p>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">13. Contact Information (Data Protection Officer)</h3>
              <p className="mb-3 text-gray-700 leading-relaxed">
                If you have questions, concerns, or requests regarding your personal data, please contact our Data Protection Officer (DPO):
              </p>
              <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded mb-6">
                <p className="font-semibold text-gray-900 mb-2">Data Protection Officer (DPO)</p>
                <p className="text-gray-800 mb-1">RADIANT Rescue Volunteers Inc.</p>
                <p className="mb-2 text-gray-800"><strong>📧 Email:</strong> radiantrescuevolunteers@gmail.com</p>
                <p className="mb-2 text-gray-800"><strong>📱 Mobile:</strong> 0999 806-4555</p>
                <p className="mb-2 text-gray-800"><strong>☎️ Landline:</strong> 712-3118</p>
                <p className="text-gray-800"><strong>🏢 Address:</strong> Talisay City, Negros Occidental, Philippines</p>
              </div>

              <h3 className="font-bold text-xl mb-3 text-gray-900 border-b pb-2">✅ Compliance Statement</h3>
              <p className="mb-3 text-gray-700 leading-relaxed">RVOIS certifies that it adopts data privacy measures aligned with the:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700">
                <li>Philippine Data Privacy Act of 2012 (RA 10173)</li>
                <li>NPC Advisory Guidelines on Data Processing and Security (NPC Circular 16-01, 17-01)</li>
                <li>BSP Circular No. 808 (Information Security Management)</li>
                <li>SEC Memorandum Circular No. 10, Series of 2014 on the protection of stakeholder information</li>
              </ul>
            </div>
          )}

          {/* Scroll indicator */}
          {requireAcceptance && (
            <div className="mt-4 text-center">
              {((activeTab === 'terms' && !hasScrolledTerms) || (activeTab === 'privacy' && !hasScrolledPrivacy)) && (
                <p className="text-sm text-amber-600 flex items-center justify-center gap-2">
                  <span className="animate-bounce">↓</span>
                  Please scroll to the bottom to continue
                  <span className="animate-bounce">↓</span>
                </p>
              )}
            </div>
          )}
        </div>
        {/* Footer */}
        <div className="p-6 border-t bg-gray-50">
          {requireAcceptance ? (
            <div className="space-y-4">
              {/* Checkboxes */}
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    disabled={!hasScrolledTerms}
                    className="mt-1 h-5 w-5 text-red-600 border-gray-300 rounded focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className={`text-sm ${hasScrolledTerms ? 'text-gray-700' : 'text-gray-600'} group-hover:text-gray-900`}>
                    I have read and agree to the <strong>Terms and Conditions</strong>
                    {!hasScrolledTerms && <span className="text-amber-600 ml-1">(Please read first)</span>}
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    disabled={!hasScrolledPrivacy}
                    className="mt-1 h-5 w-5 text-red-600 border-gray-300 rounded focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className={`text-sm ${hasScrolledPrivacy ? 'text-gray-700' : 'text-gray-600'} group-hover:text-gray-900`}>
                    I have read and agree to the <strong>Privacy Policy</strong>
                    {!hasScrolledPrivacy && <span className="text-amber-600 ml-1">(Please read first)</span>}
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="px-6"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAccept}
                  disabled={!canAccept}
                  className="px-6 bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {!canAccept ? 'Please Accept Both' : 'I Agree & Continue'}
                </Button>
              </div>

              {!canAccept && (
                <p className="text-xs text-center text-gray-500">
                  You must read and accept both the Terms & Conditions and Privacy Policy to continue
                </p>
              )}
            </div>
          ) : (
            <div className="flex justify-end">
              <Button
                onClick={onClose}
                className="px-6 bg-red-600 hover:bg-red-700 text-white"
              >
                Close
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
