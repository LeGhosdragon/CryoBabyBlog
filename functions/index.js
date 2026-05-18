const admin = require("firebase-admin");
admin.initializeApp();

const { onCall } = require("firebase-functions/v2/https");
const { onValueCreated } = require("firebase-functions/v2/database");

/* -----------------------------
   ENTRY SYSTEM (GEN 2)
------------------------------*/
exports.attemptEntry = onCall(async (request) => {
    const payload = request.data;

    const entryName = (payload?.entryName || "").trim();
    const password = (payload?.password || "").trim();

    if (!entryName || !password) {
        return { success: false, message: "Missing parameters" };
    }

    const db = admin.database();

    const entriesSnap = await db.ref("entries").once("value");
    const entries = entriesSnap.val() || {};

    const entryId = Object.keys(entries).find(id =>
        (entries[id].name || "").toLowerCase() === entryName.toLowerCase()
    );

    if (!entryId) {
        return { success: false, message: "Entry not found" };
    }

    const secretSnap = await db.ref(`entrySecrets/${entryId}`).once("value");
    const secret = secretSnap.val();

    if (!secret?.password) {
        return { success: false, message: "Missing secret data" };
    }

    if (secret.password.toLowerCase() !== password.toLowerCase()) {
        return { success: false, message: "ACCESS DENIED" };
    }

    return {
        success: true,
        content: secret.content
    };
});


/* -----------------------------
   CHAT NOTIFICATIONS (GEN 2 FIXED)
------------------------------*/
exports.notifyChat = onValueCreated(
    "/chatMessages/{messageId}",
    async (event) => {

        const msg = event.data.val();
        if (!msg) return;

        const db = admin.database();

        const tokensSnap = await db.ref("fcmTokens").once("value");
        const tokensObj = tokensSnap.val() || {};
        const tokens = Object.values(tokensObj);

        if (tokens.length === 0) {
            console.log("No FCM tokens found");
            return;
        }

        const message = {
            notification: {
                title: `💬 ${msg.user}`,
                body: msg.message || ""
            }
        };

        await admin.messaging().sendEachForMulticast({
            tokens,
            ...message
        });
    }
);