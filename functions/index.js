const {logger, setGlobalOptions} = require("firebase-functions");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {Resend} = require("resend");

setGlobalOptions({maxInstances: 10});

const recaptchaSecret = defineSecret("RECAPTCHA_SECRET_KEY");
const resendApiKey = defineSecret("RESEND_API_KEY");

const MIN_RECAPTCHA_SCORE = 0.5;
const EXPECTED_ACTION = "submit_ticket";
const TICKETS_DATABASE = "it-tickets";

const DEFAULT_NOTIFY_TO = "hyrum@newleafnurseryhayden.com";
const DEFAULT_NOTIFY_FROM = "onboarding@resend.dev";
const DEFAULT_ADMIN_TICKETS_URL = "https://it.newleafnurseryhayden.com/admin.html";

const escapeHtml = (value) => {
  return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
};

const formatTimestamp = (timestamp) => {
  if (!timestamp || typeof timestamp.toDate !== "function") {
    return "Unknown";
  }

  return timestamp.toDate().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

exports.verifyRecaptchaV3 = onCall(
    {
      cors: true,
      secrets: [recaptchaSecret],
    },
    async (request) => {
      const data = request.data || {};
      const token = data.token;
      const action = data.action;

      if (!token || typeof token !== "string") {
        throw new HttpsError("invalid-argument", "Missing reCAPTCHA token.");
      }

      if (action !== EXPECTED_ACTION) {
        throw new HttpsError("invalid-argument", "Invalid reCAPTCHA action.");
      }

      const body = new URLSearchParams({
        secret: recaptchaSecret.value(),
        response: token,
      });

      const verifyResponse = await fetch(
          "https://www.google.com/recaptcha/api/siteverify",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
          },
      );

      if (!verifyResponse.ok) {
        throw new HttpsError("internal", "reCAPTCHA verification failed.");
      }

      const result = await verifyResponse.json();

      if (!result.success) {
        throw new HttpsError("permission-denied", "reCAPTCHA check failed.");
      }

      if (result.action !== EXPECTED_ACTION) {
        throw new HttpsError("permission-denied", "reCAPTCHA action mismatch.");
      }

      if (result.score < MIN_RECAPTCHA_SCORE) {
        throw new HttpsError("permission-denied", "Low reCAPTCHA score.");
      }

      return {
        score: result.score,
        success: true,
      };
    },
);

exports.sendNewTicketNotification = onDocumentCreated(
    {
      database: TICKETS_DATABASE,
      document: "tickets/{ticketId}",
      region: "us-central1",
      secrets: [resendApiKey],
    },
    async (event) => {
      const snapshot = event.data;
      if (!snapshot) {
        logger.warn("Ticket notification skipped: missing snapshot data.");
        return;
      }

      const ticket = snapshot.data() || {};
      const ticketId = event.params.ticketId;

      const notifyTo = process.env.NOTIFY_EMAIL_TO || DEFAULT_NOTIFY_TO;
      const notifyFrom = process.env.NOTIFY_EMAIL_FROM || DEFAULT_NOTIFY_FROM;
      const adminTicketsUrl = process.env.ADMIN_TICKETS_URL ||
        DEFAULT_ADMIN_TICKETS_URL;

      const requester = ticket.requester || "Unknown requester";
      const title = ticket.title || "Untitled issue";
      const description = ticket.description || "No description provided.";
      const requesterEmail = ticket.email || "No requester email";
      const device = ticket.device || "Not specified";
      const importance = ticket.importance || "Medium";
      const createdAt = formatTimestamp(ticket.createdAt);

      const subject = `New IT Ticket (${importance}): ${title}`;
      const html = `
        <h2>New IT Ticket Submitted</h2>
        <p><strong>Ticket ID:</strong> ${escapeHtml(ticketId)}</p>
        <p><strong>Requester:</strong> ${escapeHtml(requester)}</p>
        <p><strong>Email:</strong> ${escapeHtml(requesterEmail)}</p>
        <p><strong>Device:</strong> ${escapeHtml(device)}</p>
        <p><strong>Importance:</strong> ${escapeHtml(importance)}</p>
        <p><strong>Created:</strong> ${escapeHtml(createdAt)}</p>
        <p><strong>Title:</strong> ${escapeHtml(title)}</p>
        <p><strong>Description:</strong></p>
        <p>${escapeHtml(description).replace(/\n/g, "<br>")}</p>
        <p>
          <a href="${escapeHtml(adminTicketsUrl)}">Open Admin Ticket View</a>
        </p>
      `;

      const resend = new Resend(resendApiKey.value());

      try {
        const response = await resend.emails.send({
          from: notifyFrom,
          to: notifyTo,
          subject,
          html,
        });

        logger.info("New ticket email sent.", {
          emailId: response.data && response.data.id,
          ticketId,
          to: notifyTo,
        });
      } catch (error) {
        logger.error("Failed to send ticket notification email.", {
          error: error && error.message,
          ticketId,
          to: notifyTo,
        });
        throw error;
      }
    },
);
