"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.revenuecatWebhook = void 0;
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
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
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
exports.revenuecatWebhook = functions.https.onRequest(async (req, res) => {
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
        const eventType = event.type;
        const appUserId = event.app_user_id;
        if (!appUserId) {
            res.status(400).send('Missing app_user_id');
            return;
        }
        let tier = null;
        if (ACTIVE_EVENT_TYPES.has(eventType)) {
            tier = 'pro';
        }
        else if (INACTIVE_EVENT_TYPES.has(eventType)) {
            tier = 'free';
        }
        if (tier) {
            await admin.firestore().doc(`users/${appUserId}`).update({
                subscriptionTier: tier,
            });
            console.log(`Updated ${appUserId} → ${tier} (event: ${eventType})`);
        }
        res.status(200).send('OK');
    }
    catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Internal Server Error');
    }
});
//# sourceMappingURL=index.js.map