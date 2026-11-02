// Firestore ডাটা → Excel + JSON → ইমেইল (অ্যাটাচমেন্ট)
const ExcelJS = require("exceljs");
const nodemailer = require("nodemailer");

const COLLECTIONS = ["customers", "pending", "trash", "editreqs"]; // ব্যাকআপ হবে
const DRY = process.env.DRY_RUN === "1";

function plain(v) {
  if (v === null || v === undefined) return "";
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v) || typeof v === "object") return JSON.stringify(v, (k, x) => (x && typeof x.toDate === "function" ? x.toDate().toISOString() : x));
  return v;
}
function toRows(docs) {
  const keys = [];
  docs.forEach((d) => Object.keys(d).forEach((k) => { if (!keys.includes(k)) keys.push(k); }));
  return docs.map((d) => { const r = {}; keys.forEach((k) => (r[k] = plain(d[k]))); return r; });
}

async function loadData() {
  if (DRY) {
    return { customers: [{ id: "1", name: "টেস্ট", mobile: "017", at: new Date() }], pending: [], trash: [], editreqs: [] };
  }
  const admin = require("firebase-admin");
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const db = admin.firestore();
  const out = {};
  for (const c of COLLECTIONS) {
    const snap = await db.collection(c).get();
    out[c] = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
    console.log(c + ":", out[c].length);
  }
  return out;
}

(async () => {
  const data = await loadData();
  const stamp = new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10); // বাংলাদেশের তারিখ

  const wb = new ExcelJS.Workbook();
  COLLECTIONS.forEach((c) => {
    const rows = toRows(data[c] || []);
    const ws = wb.addWorksheet(c);
    if (!rows.length) { ws.addRow(["ডাটা নেই"]); return; }
    const keys = Object.keys(rows[0]);
    ws.columns = keys.map((k) => ({ header: k, key: k, width: Math.min(40, Math.max(12, k.length + 4)) }));
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
  });
  const xlsx = Buffer.from(await wb.xlsx.writeBuffer());
  const json = Buffer.from(JSON.stringify(data, (k, v) => (v && typeof v.toDate === "function" ? v.toDate().toISOString() : v), 2));

  const total = COLLECTIONS.map((c) => c + ": " + (data[c] || []).length).join("\n");
  if (DRY) { console.log("DRY RUN ok. xlsx bytes:", xlsx.length, "json bytes:", json.length); return; }

  const tr = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
  await tr.sendMail({
    from: '"Agni Systems Backup" <' + process.env.GMAIL_USER + ">",
    to: process.env.MAIL_TO,
    subject: "Agni Systems সাপ্তাহিক ব্যাকআপ — " + stamp,
    text: "সাপ্তাহিক স্বয়ংক্রিয় ব্যাকআপ (" + stamp + ")\n\n" + total + "\n\nExcel ও JSON ফাইল সংযুক্ত আছে। ফাইলে গ্রাহকের ব্যক্তিগত তথ্য থাকে, কাউকে ফরোয়ার্ড করবেন না।",
    attachments: [
      { filename: "Agni-" + stamp + ".xlsx", content: xlsx },
      { filename: "Agni-" + stamp + ".json", content: json },
    ],
  });
  console.log("Email sent to", process.env.MAIL_TO);
})().catch((e) => { console.error(e); process.exit(1); });
