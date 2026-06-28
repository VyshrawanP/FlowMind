import nodemailer from 'nodemailer';
import dns from 'dns';
import config from '../config/index.js';

// Force DNS resolution to prefer IPv4 first (resolves ENETUNREACH in containers without IPv6 routing)
dns.setDefaultResultOrder('ipv4first');

// Setup email configuration properties inside config
const { host: smtpHost, port: smtpPort, user: smtpUser, pass: smtpPass, from: smtpFrom } = config.smtp;

let transporter = null;

if (smtpHost && smtpUser && smtpPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    family: 4, // Force IPv4 to prevent ENETUNREACH errors in container networks
  });
  console.log(`✉️  SMTP Email Transporter configured successfully: ${smtpHost}:${smtpPort}`);
} else {
  console.log(`⚠️  SMTP configuration missing. Real emails will NOT be sent. Falling back to console logging.`);
}

export async function sendOtpEmail(toEmail, otpCode, expiresAt) {
  const subject = 'FlowMind Security - Verify Your Account';
  const textContent = `Your FlowMind verification code is: ${otpCode}. It expires in 5 minutes (at ${expiresAt.toLocaleTimeString()}).`;
  
  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 8px; padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 24px; font-weight: bold; color: #6366f1;">FlowMind</span>
      </div>
      <h2 style="font-size: 18px; font-weight: bold; color: #18181b; margin-bottom: 16px;">Verify Your Account</h2>
      <p style="font-size: 14px; color: #71717a; line-height: 1.5; margin-bottom: 24px;">
        Thank you for creating an account with FlowMind. Use the verification code below to verify your email address. This code is active for 5 minutes.
      </p>
      <div style="background-color: #f4f4f5; border-radius: 6px; padding: 16px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #18181b;">${otpCode}</span>
      </div>
      <p style="font-size: 12px; color: #a1a1aa; text-align: center; margin-top: 0;">
        Expired at: ${expiresAt.toLocaleTimeString()}
      </p>
      <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
      <p style="font-size: 11px; color: #a1a1aa; line-height: 1.4; text-align: center; margin-bottom: 0;">
        If you did not request this code, you can safely ignore this email.
      </p>
    </div>
  `;

  // Output to console log ALWAYS (useful for local sandbox verification)
  console.log(`===============================================`);
  console.log(`✉️  SECURITY OTP GENERATED FOR ${toEmail.toUpperCase()}`);
  console.log(`👉  Verification Code: ${otpCode}`);
  console.log(`⏱️  Expires at: ${expiresAt.toLocaleTimeString()}`);
  console.log(`===============================================`);

  if (transporter) {
    try {
      await transporter.sendMail({
        from: smtpFrom,
        to: toEmail,
        subject,
        text: textContent,
        html: htmlContent
      });
      console.log(`✅ Real OTP email sent successfully to: ${toEmail}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send real OTP email to ${toEmail}:`, error.message);
      return false;
    }
  }

  return false;
}
