const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.attemptEntry = functions.https.onCall(async (data, context) => {
    try {

        const payload = data?.data ?? data;

        const entryName = (payload?.entryName || "").trim();
        const password = (payload?.password || "").trim();

        console.log("PARSED:", { entryName, password });

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

    } catch (err) {
        console.error("🔥 FUNCTION CRASH:", err);
        return {
            success: false,
            message: err.message
        };
    }
});