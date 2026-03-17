const express = require('express');
const router = express.Router();
const db = require('../database');

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const CLIENT_URL = process.env.CLIENT_URL || 'https://www.melaninnetwork.co.uk';

// POST /api/ads/checkout — create Stripe checkout session for ad campaign
router.post('/checkout', async (req, res) => {
  if (!STRIPE_SECRET) return res.status(500).json({ error: 'Payments not configured' });
  const stripe = require('stripe')(STRIPE_SECRET);

  const { business_name, contact_email, format, headline, body, cta_url, budget_daily, duration_days } = req.body;
  if (!business_name || !contact_email || !format || !headline || !budget_daily || !duration_days)
    return res.status(400).json({ error: 'Missing required fields' });

  const amount_pence = Math.round(parseFloat(budget_daily) * parseInt(duration_days) * 100);
  if (amount_pence < 500) return res.status(400).json({ error: 'Minimum campaign £5' });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: contact_email,
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: {
            name: `Melanin Network Ad — ${format}`,
            description: `${headline} · ${duration_days} day${duration_days > 1 ? 's' : ''} · £${budget_daily}/day`,
          },
          unit_amount: amount_pence,
        },
        quantity: 1,
      }],
      metadata: { business_name, format, headline, duration_days, budget_daily },
      success_url: `${CLIENT_URL}/ad-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${CLIENT_URL}/create-ad.html`,
    });

    // Save draft campaign
    db.run(
      `INSERT INTO ad_campaigns (business_name, contact_email, format, headline, body, cta_url, budget_daily, duration_days, amount_pence, stripe_session_id, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,'pending')`,
      [business_name, contact_email, format, headline, body || '', cta_url || '', budget_daily, duration_days, amount_pence, session.id]
    );

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: 'Payment failed — please try again' });
  }
});

// GET /api/ads/active — get active ad for display in sidebar
router.get('/active', (req, res) => {
  db.get(
    `SELECT * FROM ad_campaigns WHERE status='active' AND end_date > datetime('now') ORDER BY RANDOM() LIMIT 1`,
    [], (err, row) => {
      res.json(row || null);
      if (row) db.run('UPDATE ad_campaigns SET impressions=impressions+1 WHERE id=?', [row.id]);
    }
  );
});

// POST /api/ads/:id/click
router.post('/:id/click', (req, res) => {
  db.run('UPDATE ad_campaigns SET clicks=clicks+1 WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// Stripe webhook — activate campaign on payment
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const stripe = require('stripe')(STRIPE_SECRET);
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = webhookSecret
      ? stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
      : JSON.parse(req.body);
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const days = parseInt(session.metadata?.duration_days || 7);
    db.run(
      `UPDATE ad_campaigns SET status='active', stripe_payment_intent=?, start_date=datetime('now'), end_date=datetime('now','+${days} days') WHERE stripe_session_id=?`,
      [session.payment_intent, session.id]
    );
  }

  res.json({ received: true });
});

module.exports = router;
