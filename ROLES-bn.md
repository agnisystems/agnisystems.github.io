# ৪ ধরনের ব্যবহারকারী (Role) — কে কী পারবে

| | Coder | Admin | Editor | 💎 Management |
|---|---|---|---|---|
| সব ডাটা দেখা | ✅ | ✅ | ✅ | ✅ |
| গ্রাহক যোগ | ✅ সরাসরি | ✅ সরাসরি | ✅ Pending-এ যায়, Admin অনুমোদন দেয় | ❌ |
| গ্রাহক Edit | ✅ | ✅ | Edit Request পাঠিয়ে, অনুমোদনের পর | ❌ |
| গ্রাহক মোছা, Trash, Export/Import | ✅ | ✅ | ❌ | ❌ |
| Pending / Edit Request অনুমোদন | ✅ | ✅ | ❌ | ❌ |
| 🗑️ Delete All (সব গ্রাহক একসাথে Trash-এ) | ✅ শুধু Coder | ❌ | ❌ | ❌ |
| 💀 Empty Trash (Trash স্থায়ীভাবে খালি) | ✅ শুধু Coder | ❌ | ❌ | ❌ |
| ♻ Restore All (Trash-এর সব ফেরত) | ✅ শুধু Coder | ❌ | ❌ | ❌ |
| রেকর্ডের Audit Log (পরিবর্তনের ইতিহাস) এন্ট্রি মোছা | ✅ শুধু Coder | ❌ | ❌ | ❌ |
| ব্যবহারকারী যোগ/মোছা/নিষ্ক্রিয়/Logout | সব (Admin, Editor, Management) | **শুধু Coder যে Role-এর অনুমতি ON করেছে** | ❌ | ❌ |
| Role বদলানো ও Admin-এর অনুমতি ON/OFF | ✅ শুধু Coder | ❌ | ❌ | ❌ |
| Coder দেখা / যোগ / মোছা | নিজেই Coder | ❌ কোনোভাবেই না | ❌ | ❌ |

- আগের "User" Role এখন **Editor** হিসেবে কাজ করে (কিছু বদলাতে হবে না)।
- **💎 Management** (ভেতরে Viewer): শুধু দেখার Role, সোনালি আইকন ও সোনালি অবতার। CSV ইমপোর্টে `management` বা `viewer` দুটোই চলে।
- Super Admin `arafatahmed.cit.bd@gmail.com` সবসময় Coder। নতুন Coder অ্যাপ থেকে বানানো যায় না।

## 🕶 Coder সম্পূর্ণ গোপন
- ব্যবহারকারী তালিকা, লগইন ইতিহাস, Active Sessions: Coder আসে না (Admin/Editor/Management কেউ দেখে না)
- গ্রাহকের পরিবর্তনের ইতিহাসে (Audit Log) Coder-এর কাজ **"System"** নামে দেখায়। পুরোনো এন্ট্রিও Coder ছাড়া অন্যদের কাছে "System" দেখায়
- Coder-এর Gmail সাইটের কোডে (GitHub-এ) আর লেখা নেই। শুধু Firebase Rules-এ আছে, যেটা পাবলিক নয়
- ⚠️ `firestore.rules` ফাইলটা **GitHub-এ আপলোড করবেন না** (ওতে Coder-এর Gmail আছে)। শুধু Firebase Console-এ পেস্ট করুন
- ⚠️ আগের (এই আপডেটের আগের) সেশনগুলো Admin-এর তালিকায় দেখা যাবে না। সবাই একবার Logout করে আবার লগইন করলে ঠিক হয়ে যাবে

## Admin-এর ON/OFF অনুমতি কীভাবে দেবেন
1. Coder হিসেবে লগইন → সাইডবারে **Gmail Access**
2. তালিকায় কোনো Admin-এর সারিতে **🔑** বাটন চাপুন
3. তিনটি সুইচ আসবে: **Admin যোগ**, **Editor যোগ**, **Management যোগ**। যেটা ON, সেটা ওই Admin করতে পারবে। তারপর **সেভ**
4. সবগুলো OFF থাকলে ওই Admin-এর সাইডবারে Gmail Access মেনুই আসবে না
5. নতুন Admin তৈরি করলে শুরুতে সব OFF থাকে

Role বদলাতে: Coder-এর তালিকায় প্রতিটি সারিতে Role-এর ড্রপডাউন আছে। বদলালে ওই ব্যক্তি সব ডিভাইস থেকে Logout হয়, আবার লগইনে নতুন Role পায়।

## আপলোড
1. `index.html` GitHub-এ বদলান।
2. `firestore.rules` Firebase Console → Firestore → Rules-এ পেস্ট করে **Publish** করুন। (এটা না করলে নতুন নিয়ম ডাটাবেসে কার্যকর হবে না, শুধু স্ক্রিনে দেখাবে।)
3. `sw.js`-এর `VERSION` সংখ্যা বাড়ান (যেমন `agni-v3`), নইলে ফোনে পুরোনো সংস্করণ থাকতে পারে।

## টেস্ট চেকলিস্ট
1. Coder দিয়ে Admin তৈরি করুন, 🔑 থেকে শুধু "Management যোগ" ON রাখুন
2. ওই Admin দিয়ে লগইন → Gmail Access-এ শুধু Management যোগ হবে (ড্রপডাউনে অন্য Role থাকবে না), তালিকায় Coder দেখা যাবে না
3. Management দিয়ে লগইন → "নতুন গ্রাহক" বাটন নেই, Edit বা Request কিছুই নেই
4. Editor দিয়ে লগইন → নতুন গ্রাহক Pending-এ যায়

## সীমাবদ্ধতা
- Admin-এর "Active Sessions" তালিকা থেকে Coder-এর সেশন স্ক্রিনে লুকানো হয়, তবে ডাটাবেস-স্তরে তালিকা কুয়েরি পুরোপুরি ফিল্টার করা যায় না। Coder-এর সেশন **বন্ধ** করা Rules দিয়ে ঠেকানো আছে।
- Admin-এর অনুমতি বদলালে সে পরের বার Gmail Access খুললে (বা পুনরায় লগইনে) নতুন অনুমতি পায়।
