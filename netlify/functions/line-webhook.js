// netlify/functions/line-webhook.js
//
// Receives INCOMING webhook events from the LINE Platform (e.g. bot added to a group,
// bot receives a message, user follows the OA). Register this function's URL as the
// "Webhook URL" in the LINE Developers Console (Messaging API tab):
//
//   https://<your-site>.netlify.app/.netlify/functions/line-webhook
//
// Unlike a Google Apps Script Web App URL, this responds with a plain 200 directly -
// no redirect - so LINE's "Verify" button will succeed.
//
// Its main job here is to capture the groupId / userId you need (by printing them to
// the function logs, and optionally forwarding them into your existing Google Sheet log
// via the same Apps Script webhook you already set up), so you can copy that ID into the
// LINE push script.

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    // LINE only ever calls this with POST; respond 200 to anything else so manual
    // browser visits don't look like errors.
    return { statusCode: 200, body: "OK" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (err) {
    console.error("Invalid JSON from LINE:", err);
    // Still return 200 - LINE will retry/flag the webhook as broken if we don't.
    return { statusCode: 200, body: "OK" };
  }

  const events = Array.isArray(body.events) ? body.events : [];

  for (const evt of events) {
    const sourceType = evt.source && evt.source.type; // 'user' | 'group' | 'room'
    const groupId = evt.source && evt.source.groupId;
    const userId = evt.source && evt.source.userId;
    const roomId = evt.source && evt.source.roomId;

    // This is the important part for you right now: it shows up in
    // Netlify > Functions > line-webhook > logs
    console.log("LINE event:", {
      type: evt.type,
      sourceType,
      groupId,
      userId,
      roomId,
    });

    // Optional: also forward the captured ID into your existing Google Sheet log,
    // so you don't have to dig through Netlify logs. Set GOOGLE_SHEET_WEBHOOK_URL
    // as an environment variable in Netlify (Site settings > Environment variables)
    // to the same Apps Script /exec URL you already use for logging appointments.
    const sheetWebhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
    if (sheetWebhookUrl) {
      try {
        await fetch(sheetWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            trackingCode: "LINE_ID_CAPTURE",
            status: evt.type,
            message: `sourceType=${sourceType} groupId=${groupId || "-"} userId=${userId || "-"} roomId=${roomId || "-"}`,
          }),
        });
      } catch (err) {
        console.error("Failed to forward to Sheet webhook:", err);
      }
    }
  }

  // Always respond 200 quickly - LINE marks the webhook as broken otherwise.
  return {
    statusCode: 200,
    body: "OK",
  };
};
