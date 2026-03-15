import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { Resend } from "resend";
import { render } from "@react-email/render";
import * as crypto from "crypto";
import BrainDispatch from "./templates/BrainDispatch";

initializeApp();
const db = getFirestore();

const resendApiKey = defineSecret("RESEND_API_KEY");
const unsubscribeSecret = defineSecret("UNSUBSCRIBE_SECRET");

const APP_URL = process.env.APP_URL || "https://braindump.app";
const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";

// ── Helpers ──

interface UserProfile {
  displayName?: string;
  email?: string;
  preferences?: {
    digestFrequency?: string;
    digestDay?: string;
    digestHour?: number;
    lastFuelLevel?: number | null;
  };
}

interface BoardItem {
  text: string;
  category: string;
  completed: boolean;
  completedAt?: Timestamp;
}

function generateUnsubscribeToken(uid: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(uid)
    .digest("hex")
    .slice(0, 32);
}

function verifyUnsubscribeToken(uid: string, token: string, secret: string): boolean {
  const expected = generateUnsubscribeToken(uid, secret);
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

function getDayOfWeek(): string {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[new Date().getUTCDay()];
}

function formatDateString(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// ── Scheduled Function: Send Brain Dispatch emails ──

export const sendBrainDispatch = onSchedule(
  {
    schedule: "every 1 hours",
    timeZone: "UTC",
    secrets: [resendApiKey, unsubscribeSecret],
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const currentHour = new Date().getUTCHours();
    const currentDay = getDayOfWeek();

    // Find users whose digest is due now
    const usersSnap = await db.collection("users").get();
    const resend = new Resend(resendApiKey.value());

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const userDoc of usersSnap.docs) {
      try {
        const profile = userDoc.data() as UserProfile;
        const prefs = profile.preferences;

        if (!prefs || !profile.email) {
          skipped++;
          continue;
        }

        // Check if this user should receive a digest now
        if (prefs.digestFrequency === "none") {
          skipped++;
          continue;
        }

        const userHour = prefs.digestHour ?? 9;
        if (userHour !== currentHour) {
          skipped++;
          continue;
        }

        if (prefs.digestFrequency === "weekly" && prefs.digestDay !== currentDay) {
          skipped++;
          continue;
        }

        // Fetch active items
        const activeSnap = await db
          .collection("users")
          .doc(userDoc.id)
          .collection("items")
          .where("completed", "==", false)
          .get();

        const tasks: { text: string }[] = [];
        const ideas: { text: string }[] = [];
        const thoughts: { text: string }[] = [];
        const emotions: { text: string }[] = [];

        activeSnap.docs.forEach((d) => {
          const item = d.data() as BoardItem;
          const entry = { text: item.text };
          switch (item.category) {
            case "task": tasks.push(entry); break;
            case "idea": ideas.push(entry); break;
            case "thought": thoughts.push(entry); break;
            case "emotion": emotions.push(entry); break;
          }
        });

        // Fetch recently completed items (last 7 days)
        const sevenDaysAgo = Timestamp.fromDate(
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        );
        const completedSnap = await db
          .collection("users")
          .doc(userDoc.id)
          .collection("items")
          .where("completed", "==", true)
          .where("completedAt", ">=", sevenDaysAgo)
          .get();

        const completedItems = completedSnap.docs.map((d) => {
          const item = d.data() as BoardItem;
          return {
            text: item.text,
            completedAt: item.completedAt?.toDate() ?? new Date(),
          };
        });

        // Skip if board is completely empty
        if (tasks.length + ideas.length + thoughts.length + emotions.length + completedItems.length === 0) {
          skipped++;
          continue;
        }

        // Generate unsubscribe URL
        const token = generateUnsubscribeToken(userDoc.id, unsubscribeSecret.value());
        const unsubscribeUrl = `https://us-central1-brain-dump-8c689.cloudfunctions.net/unsubscribe?uid=${userDoc.id}&token=${token}`;

        const firstName = (profile.displayName || "").split(" ")[0];

        // Render email
        const html = await render(
          BrainDispatch({
            firstName,
            tasks,
            ideas,
            thoughts,
            emotions,
            completedItems,
            fuelLevel: prefs.lastFuelLevel ?? null,
            appUrl: APP_URL,
            unsubscribeUrl,
            dateString: formatDateString(),
          })
        );

        // Send via Resend
        await resend.emails.send({
          from: FROM_EMAIL,
          to: profile.email,
          subject: `Your Brain Dispatch — ${formatDateString()}`,
          html,
        });

        sent++;
      } catch (err) {
        console.error(`[BrainDispatch] Error for user ${userDoc.id}:`, err);
        errors++;
      }
    }

    console.log(`[BrainDispatch] Sent: ${sent}, Skipped: ${skipped}, Errors: ${errors}`);
  }
);

// ── HTTPS Endpoint: One-click unsubscribe ──

export const unsubscribe = onRequest(
  {
    secrets: [unsubscribeSecret],
    cors: true,
  },
  async (req, res) => {
    const { uid, token } = req.query as { uid?: string; token?: string };

    if (!uid || !token) {
      res.status(400).send(unsubscribePage("Missing parameters.", false));
      return;
    }

    try {
      if (!verifyUnsubscribeToken(uid, token, unsubscribeSecret.value())) {
        res.status(403).send(unsubscribePage("Invalid unsubscribe link.", false));
        return;
      }

      // Set digestFrequency to "none"
      await db.doc(`users/${uid}`).set(
        { preferences: { digestFrequency: "none" } },
        { merge: true }
      );

      res.status(200).send(unsubscribePage("You've been unsubscribed from Brain Dispatch emails.", true));
    } catch (err) {
      console.error("[Unsubscribe] Error:", err);
      res.status(500).send(unsubscribePage("Something went wrong. Please try again.", false));
    }
  }
);

function unsubscribePage(message: string, success: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Brain Dump — Unsubscribe</title>
  <style>
    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #FAF8F5;
      color: #5D4E43;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
    }
    .card {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 4px 24px rgba(93,78,67,0.08);
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 20px; font-weight: 600; margin: 0 0 8px; }
    p { font-size: 15px; opacity: 0.7; margin: 0 0 24px; }
    a {
      display: inline-block;
      background: #B8A9D4;
      color: white;
      text-decoration: none;
      padding: 10px 24px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? "✅" : "⚠️"}</div>
    <h1>${success ? "All done!" : "Oops"}</h1>
    <p>${message}</p>
    <a href="${APP_URL}">Open Brain Dump</a>
  </div>
</body>
</html>`;
}
