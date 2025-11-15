import { supabase } from "./supabase"

export const customEmailTemplates = {
  SIGNUP: {
    subject: "Welcome to Radiant Rescue Volunteer – Confirm Your Registration",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #e11d48; margin-bottom: 20px;">Welcome to Radiant Rescue Volunteer</h2>
        
        <p>You are registering for the <strong>Rescue Volunteer's Operations Information System</strong> managed by <strong>Radiant Rescue Volunteer Incorporated</strong> — a community-driven initiative for emergency response and public safety.</p>
        
        <p>To complete your registration securely, please click the link below to confirm your email.</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;">
            🔐 <strong>Your Confirmation Phrase</strong>: {{ .ConfirmationPhrase }}
            <br>
            <small style="color: #6b7280;">Keep this phrase private. You can use it later to verify your identity in the system.</small>
          </p>
        </div>
        
        <div style="margin: 25px 0;">
          <a href="{{ .ConfirmationURL }}" style="background-color: #e11d48; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Confirm Email Address
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">By proceeding, you agree to our policies and confirm that your data will be protected in accordance with the <strong>Philippine Data Privacy Act of 2012 (RA 10173)</strong>.</p>
        
        <p style="margin-top: 30px;">Thank you for joining our mission. Together, we save lives.</p>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          — Radiant Rescue Volunteer, Inc.
        </p>
      </div>
    `,
  },
}

export const initializeEmailTemplates = async () => {
  try {
    // Placeholder: Email template customization via Supabase Auth is not supported via updateUser
    // Keep function for future use; no-op to satisfy TypeScript
    const { error } = { error: null as any }

    if (error) {
      console.error("Failed to update email template:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Error initializing email templates:", error)
    return false
  }
} 