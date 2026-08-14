const nodemailer = require('nodemailer');

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(email, otp) {
  const user = process.env.GMAIL_USER || 'mikegborbitey05@gmail.com';
  const pass = (process.env.GMAIL_APP_PASSWORD || 'shfxkgvmrugdvbtw').replace(/\s+/g, '');

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #eaeaea; text-align: center;">
      <div style="background: #4f46e5; color: #ffffff; width: 48px; height: 48px; border-radius: 12px; font-size: 20px; font-weight: bold; line-height: 48px; margin: 0 auto 16px auto;">SD</div>
      <h2 style="color: #111827; margin: 0 0 8px 0; font-size: 22px;">Verify Your Account</h2>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px 0;">Use the 6-digit verification code below to complete your registration on SD Shopping:</p>
      <div style="background: #f3f4f6; border-radius: 12px; padding: 18px 24px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4f46e5; font-family: monospace; margin: 0 0 24px 0;">${otp}</div>
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">This code expires in 5 minutes. If you did not request this code, please ignore this email.</p>
    </div>
  `;

  let lastError = null;

  // Strategy 1: Brevo REST API over HTTPS (Port 443 - Delivers directly to ANY recipient's inbox)
  if (process.env.BREVO_API_KEY) {
    try {
      const brevoKey = process.env.BREVO_API_KEY.trim();
      const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.GMAIL_USER || 'mikegborbitey05@gmail.com';
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'SD Shopping', email: senderEmail },
          to: [{ email }],
          subject: 'Your SD Shopping Verification OTP Code',
          htmlContent
        })
      });
      const brevoData = await res.json().catch(() => ({}));
      if (res.ok) {
        console.log(`✅ [Email Delivered via Brevo to ${email}]: MessageId: ${brevoData.messageId || 'OK'}`);
        return { success: true, method: 'brevo_https' };
      } else {
        console.warn('❌ [Brevo API Error]:', JSON.stringify(brevoData));
        lastError = brevoData.message || 'Brevo delivery failed';
      }
    } catch (brevoErr) {
      console.warn('Brevo HTTPS API exception:', brevoErr.message);
      lastError = brevoErr.message;
    }
  }

  // Strategy 2: Direct Gmail SMTP Transporter (Local Development Fallback)
  const configurations = [
    { host: 'smtp.gmail.com', port: 587, secure: false, requireTLS: true },
    { host: 'smtp.gmail.com', port: 465, secure: true }
  ];

  let lastError = null;

  for (const config of configurations) {
    try {
      const transporter = nodemailer.createTransport({
        ...config,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 4000,
        greetingTimeout: 4000,
        socketTimeout: 4000
      });

      const info = await transporter.sendMail({
        from: `"SD Shopping" <${user}>`,
        to: email,
        subject: 'Your SD Shopping Verification OTP Code',
        html: htmlContent
      });

      console.log(`✅ [Email Sent via Gmail SMTP (Port ${config.port}) to ${email}]: MessageId: ${info.messageId}`);
      return { success: true, method: `smtp_${config.port}` };
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ [SMTP Port ${config.port} Notice for ${email}]:`, err.message);
    }
  }

  return {
    success: false,
    error: lastError ? lastError.message : 'Connection timeout',
    isTimeout: true
  };
}

module.exports = {
  generateOTP,
  sendOTPEmail
};
