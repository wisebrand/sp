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

  const brevoKey = (process.env.BREVO_API_KEY || process.env.BREVO_KEY || process.env.SENDINBLUE_API_KEY || process.env.BREVO_TOKEN || '').trim().replace(/^["']|["']$/g, '');

  // Strategy 1: Brevo REST API over HTTPS (Port 443 - Delivers directly to ANY recipient's inbox)
  if (brevoKey) {
    try {
      const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.GMAIL_USER || 'mikegborbitey05@gmail.com').trim();
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
        return {
          success: false,
          error: brevoData.message || 'Brevo rejected the email. Please check your Brevo sender email configuration.'
        };
      }
    } catch (brevoErr) {
      console.warn('Brevo HTTPS API exception:', brevoErr.message);
      lastError = brevoErr.message;
    }
  }

  // If on cloud hosting (Render) without BREVO_API_KEY, fast fail instead of timing out on blocked SMTP ports
  const isCloudHost = process.env.RENDER || process.env.NODE_ENV === 'production' || process.env.PORT && process.env.PORT !== '5000';
  if (isCloudHost && !brevoKey) {
    console.warn('⚠️ [Cloud Host Notice]: Render blocks SMTP ports 465/587. BREVO_API_KEY is required in Render Environment.');
    return {
      success: false,
      error: 'BREVO_API_KEY is not detected in Render Environment Variables. Please add BREVO_API_KEY in Render dashboard and save changes.'
    };
  }

  // Strategy 2: Direct Gmail SMTP Transporter (Local Development Fallback)
  const configurations = [
    { host: 'smtp.gmail.com', port: 587, secure: false, requireTLS: true },
    { host: 'smtp.gmail.com', port: 465, secure: true }
  ];

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
    error: lastError ? lastError.message : 'Connection timeout'
  };
}

async function sendOrderReceiptEmail(email, order) {
  const user = process.env.GMAIL_USER || 'mikegborbitey05@gmail.com';
  const pass = (process.env.GMAIL_APP_PASSWORD || 'shfxkgvmrugdvbtw').replace(/\s+/g, '');
  const brevoKey = (process.env.BREVO_API_KEY || process.env.BREVO_KEY || process.env.SENDINBLUE_API_KEY || process.env.BREVO_TOKEN || '').trim().replace(/^["']|["']$/g, '');

  const id = order._id || order.id || 'order_0';
  const orderId = `ORD-${id.toString().substring(Math.max(0, id.toString().length - 6)).toUpperCase()}`;
  const trackingNum = order.trackingNumber || 'SD-TRK-982104';
  const total = Number(order.totalAmount || 0).toFixed(2);
  const items = order.items || [];
  const address = typeof order.shippingAddress === 'string' ? order.shippingAddress : (order.shippingAddress?.street || order.shippingAddress?.address || 'Customer Delivery Address');
  const payMethod = order.paymentMethod || 'Credit Card';
  const dateStr = new Date(order.createdAt || Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  const itemsRows = items.map(item => `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #111827; font-size: 13px;">${item.title || item.name}</td>
      <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-size: 13px; text-align: center;">${item.quantity || 1}</td>
      <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #111827; font-size: 13px; text-align: right; font-weight: 600;">$${Number((item.price || 0) * (item.quantity || 1)).toFixed(2)}</td>
    </tr>
  `).join('');

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e5e7eb;">
      <div style="text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px; margin-bottom: 24px;">
        <div style="background: #4f46e5; color: #ffffff; width: 48px; height: 48px; border-radius: 12px; font-size: 20px; font-weight: bold; line-height: 48px; margin: 0 auto 12px auto;">SD</div>
        <h2 style="color: #111827; margin: 0 0 4px 0; font-size: 22px; font-weight: 800;">Order Confirmed & Paid</h2>
        <p style="color: #6b7280; font-size: 13px; margin: 0;">Thank you for shopping with SD Shopping! Here is your official order receipt.</p>
      </div>

      <div style="background: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 12px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 0; color: #6b7280;">Order ID: <strong style="color: #111827;">${orderId}</strong></td>
            <td style="padding: 4px 0; color: #6b7280; text-align: right;">Date: <strong style="color: #111827;">${dateStr}</strong></td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #6b7280;">Tracking Number: <strong style="color: #4f46e5; font-family: monospace;">${trackingNum}</strong></td>
            <td style="padding: 4px 0; color: #6b7280; text-align: right;">Payment: <strong style="color: #059669;">${payMethod} (Paid)</strong></td>
          </tr>
          <tr>
            <td colspan="2" style="padding: 4px 0 0 0; color: #6b7280;">Shipping Address: <strong style="color: #111827;">${address}</strong></td>
          </tr>
        </table>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="border-bottom: 2px solid #e5e7eb;">
            <th style="padding: 8px 0; text-align: left; font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase;">Item</th>
            <th style="padding: 8px 0; text-align: center; font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase;">Qty</th>
            <th style="padding: 8px 0; text-align: right; font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <div style="border-top: 2px solid #f3f4f6; padding-top: 12px; margin-bottom: 24px; text-align: right;">
        <span style="font-size: 16px; font-weight: 800; color: #111827;">Total Paid: </span>
        <span style="font-size: 20px; font-weight: 900; color: #4f46e5; margin-left: 8px;">$${total}</span>
      </div>

      <div style="text-align: center; color: #9ca3af; font-size: 11px; border-top: 1px solid #f3f4f6; padding-top: 16px;">
        <p style="margin: 0;">Track your package delivery live with tracking code <strong style="color: #4f46e5;">${trackingNum}</strong> on SD Shopping.</p>
      </div>
    </div>
  `;

  if (brevoKey) {
    try {
      const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.GMAIL_USER || 'mikegborbitey05@gmail.com').trim();
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'SD Shopping', email: senderEmail },
          to: [{ email }],
          subject: `SD Shopping Order Receipt [${orderId}] - Paid ($${total})`,
          htmlContent
        })
      });
      if (res.ok) {
        console.log(`✅ [Receipt Delivered via Brevo to ${email}] Order: ${orderId}`);
        return { success: true };
      }
    } catch (e) {
      console.warn('Brevo receipt error:', e.message);
    }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });
    await transporter.sendMail({
      from: `"SD Shopping" <${user}>`,
      to: email,
      subject: `SD Shopping Order Receipt [${orderId}] - Paid ($${total})`,
      html: htmlContent
    });
    console.log(`✅ [Receipt Delivered via SMTP to ${email}] Order: ${orderId}`);
    return { success: true };
  } catch (err) {
    console.warn(`⚠️ [Receipt SMTP notice for ${email}]:`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  generateOTP,
  sendOTPEmail,
  sendOrderReceiptEmail
};

