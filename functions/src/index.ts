/**
 * Cloud Functions for HalfLifeControl.
 *
 * revenuecatWebhook: receives subscription events from RevenueCat and updates
 * the user's subscriptionTier in Firestore. This is the ONLY secure way to set
 * the tier — Firestore rules block client-side writes to subscriptionTier.
 *
 * Deployment:
 *   cd functions && npm install && npm run build
 *   firebase deploy --only functions
 *
 * RevenueCat setup:
 *   1. Go to RevenueCat dashboard > Project > Integrations > Webhooks
 *   2. Set URL to: https://<region>-<project-id>.cloudfunctions.net/revenuecatWebhook
 *   3. Set Authorization Header to: Bearer <your-webhook-secret>
 *   4. Set the same secret in Firebase config:
 *      firebase functions:config:set revenuecat.webhook_secret="<your-webhook-secret>"
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const ACTIVE_EVENT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'PRODUCT_CHANGE', // upgrade
]);

const INACTIVE_EVENT_TYPES = new Set([
  'CANCELLATION',
  'EXPIRATION',
  'BILLING_ISSUE',
  'SUBSCRIPTION_PAUSED',
]);

export const revenuecatWebhook = functions.https.onRequest(async (req, res) => {
  // Only accept POST
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // Verify webhook authenticity via shared secret in Authorization header
  const secret = functions.config().revenuecat?.webhook_secret;
  if (secret) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${secret}`) {
      res.status(401).send('Unauthorized');
      return;
    }
  }

  try {
    const event = req.body?.event;
    if (!event) {
      res.status(400).send('Missing event payload');
      return;
    }

    const eventType: string = event.type;
    const appUserId: string | undefined = event.app_user_id;

    if (!appUserId) {
      res.status(400).send('Missing app_user_id');
      return;
    }

    let tier: 'free' | 'pro' | null = null;

    if (ACTIVE_EVENT_TYPES.has(eventType)) {
      tier = 'pro';
    } else if (INACTIVE_EVENT_TYPES.has(eventType)) {
      tier = 'free';
    }

    if (tier) {
      await admin.firestore().doc(`users/${appUserId}`).update({
        subscriptionTier: tier,
      });
      console.log(`Updated ${appUserId} → ${tier} (event: ${eventType})`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});
