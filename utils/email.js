const nodemailer = require('nodemailer');

function createTransporter() {
  const user = process.env.GMAIL_USER || 'mikegborbitey05@gmail.com';
  const pass = (process.env.GMAIL_APP_PASSWORD || 'shfxkgvmrugdvbtw').replace(/\s+/g, '');

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Use direct SSL for Render cloud compatibility
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
  });
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(email, otp) {
  const user = process.env.GMAIL_USER || 'mikegborbitey05@gmail.com';
  const transporter = createTransporter();

  try {
    const mailOptions = {
      from: `"SD Shopping" <${user}>`,
      to: email,
      subject: 'Your SD Shopping Verification OTP Code',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #eaeaea; text-align: center;">
          <div style="background: #4f46e5; color: #ffffff; width: 48px; height: 48px; border-radius: 12px; font-size: 20px; font-weight: bold; line-height: 48px; margin: 0 auto 16px auto;">SD</div>
          <h2 style="color: #111827; margin: 0 0 8px 0; font-size: 22px;">Verify Your Account</h2>
          <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px 0;">Use the 6-digit verification code below to complete your registration on SD Shopping:</p>
          <div style="background: #f3f4f6; border-radius: 12px; padding: 18px 24px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4f46e5; font-family: monospace; margin: 0 0 24px 0;">${otp}</div>
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">This code expires in 5 minutes. If you did not request this code, please ignore this email.</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [Email Sent Successfully to ${email}]: MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`⚠️ [Email Sending Notice to ${email}]:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  generateOTP,
  sendOTPEmail
};
