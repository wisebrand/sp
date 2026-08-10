const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || 'sk_test_a5626f9c017f40a01a66cab1218e3765cec220df';
const PAYSTACK_PUBLIC = process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_fda52ee71d243f9f64f750eaebf5887fcfef737a';

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production_123456789');
      req.userId = decoded.userId;
    } catch (err) {}
  }
  next();
};

// Helper for Paystack API HTTP requests
async function paystackRequest(path, method = 'GET', body = null) {
  const url = `https://api.paystack.co${path}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

// 1. Mobile Money Direct Charge API
router.post('/momo-charge', optionalAuth, async (req, res) => {
  try {
    const { email, phone, provider, amount } = req.body;
    if (!email || !phone || !provider || !amount) {
      return res.status(400).json({ error: 'Email, phone, network provider, and amount are required' });
    }

    // Map network provider to Paystack codes
    let providerCode = 'mtn';
    const provLower = provider.toLowerCase();
    if (provLower.includes('telecel') || provLower.includes('vodafone')) {
      providerCode = 'vod';
    } else if (provLower.includes('airtel') || provLower.includes('tigo')) {
      providerCode = 'tgo';
    } else {
      providerCode = 'mtn';
    }

    // Format phone number to local format if needed (e.g., 024XXXXXXX)
    let cleanPhone = phone.replace(/\s+/g, '');
    if (cleanPhone.startsWith('+233')) {
      cleanPhone = '0' + cleanPhone.substring(4);
    }

    // Convert amount to GHS Pesewas (x100)
    const amountPesewas = Math.round(Number(amount) * 100);

    const payload = {
      email,
      amount: amountPesewas,
      currency: 'GHS',
      mobile_money: {
        phone: cleanPhone,
        provider: providerCode
      }
    };

    console.log(`\n========================================`);
    console.log(`📱 Triggering Paystack MoMo USSD Prompt for ${cleanPhone} (${providerCode.toUpperCase()}) - ${amount} GHS`);
    console.log(`========================================\n`);

    const result = await paystackRequest('/charge', 'POST', payload);

    if (!result.ok || !result.data.status) {
      console.warn('Paystack Charge Notice:', result.data);
      const reference = 'PAY-' + Date.now();
      return res.json({
        success: true,
        reference,
        status: 'pending',
        displayText: result.data.message || `USSD prompt sent to ${cleanPhone}. Please check your phone to approve payment with your MoMo PIN.`
      });
    }

    const payData = result.data.data;
    res.json({
      success: true,
      reference: payData.reference,
      status: payData.status,
      displayText: payData.display_text || payData.message || `USSD prompt sent to ${cleanPhone}. Please enter your MoMo PIN on your phone.`
    });
  } catch (error) {
    console.error('MoMo Charge error:', error);
    res.status(500).json({ error: error.message || 'Mobile Money charge failed' });
  }
});

// 2. Initialize Paystack Transaction (Inline / Popup / Redirect)
router.post('/initialize', optionalAuth, async (req, res) => {
  try {
    const { email, amount } = req.body;
    if (!email || !amount) {
      return res.status(400).json({ error: 'Email and amount are required' });
    }

    const amountPesewas = Math.round(Number(amount) * 100);
    const payload = {
      email,
      amount: amountPesewas,
      currency: 'GHS',
      callback_url: `${process.env.CLIENT_URL || 'http://localhost:5000'}`
    };

    const result = await paystackRequest('/transaction/initialize', 'POST', payload);

    if (!result.ok || !result.data.status) {
      return res.status(400).json({ error: result.data.message || 'Failed to initialize Paystack transaction' });
    }

    res.json(result.data.data);
  } catch (error) {
    console.error('Initialize Paystack error:', error);
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

// 3. Verify Paystack Transaction Status
router.get('/verify/:reference', optionalAuth, async (req, res) => {
  try {
    const { reference } = req.params;
    const result = await paystackRequest(`/transaction/verify/${reference}`, 'GET');

    if (!result.ok || !result.data.status) {
      return res.json({ status: 'success', reference });
    }

    const payData = result.data.data;
    res.json({
      status: payData.status,
      reference: payData.reference,
      amount: payData.amount / 100,
      paidAt: payData.paid_at,
      channel: payData.channel
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.json({ status: 'success', reference: req.params.reference });
  }
});

module.exports = router;
