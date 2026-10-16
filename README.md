# Heebee Workshops

Workshop feed + waitlist + manual-payment confirmation, with chef profiles. No-build static site (HTML/CSS/JS modules) on Firebase.

## Pages

| URL | Who | What |
|---|---|---|
| `#/` | Public | Feed: featured workshop, coming soon, past workshops |
| `#/e/<id>` | Public | Event page: batches, chef, venue, join waitlist form |
| `#/c/<id>` | Public | Chef profile: bio, experience, achievements, workshops, photo gallery |
| `#/pay?ref=…&am=…` | Public | UPI QR / ID page linked from the payment WhatsApp |
| `#/admin` | Team | Workshops, bookings, chefs, stay-updated list, settings |
| `#/chef` | Chefs | Edit own profile, post up to 21 photos |

## The booking flow

1. Customer picks a batch → fills name, phone, WhatsApp, email → ticks the policy box → **waitlist**.
2. Admin → Bookings → **Ask for payment** opens WhatsApp with the payment message (UPI ID + pay-page link) pre-filled. Tap send.
3. Customer pays and sends the screenshot on WhatsApp.
4. Admin checks it → **Payment received · confirm seat** → seat number assigned → **Send confirmation on WhatsApp**.

Open admin on the phone that is logged in to the Heebee WhatsApp number, so the one-tap messages go from that number.

Message templates are editable in Admin → Settings. **Don't use emojis in them**: WhatsApp's pre-filled links turn emojis into "�". `*bold*`, ₹, · and ✦ are fine.

## Run locally

```bash
npx serve -l 5190 .
```

Without Firebase keys in `js/config.js` the app runs in **demo mode** (sample data in this browser's localStorage). Demo admin: `gavish@heebeecoffee.com`, demo chef: `aarav@example.com`; passwords aren't checked in demo mode.

## Firebase setup (one time)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → name it `heebee-workshops` (Analytics off).
2. **Upgrade to Blaze** (needed for photo uploads). Then Google Cloud console → Billing → **Budgets & alerts** → create a ₹100 budget with email alerts. Normal use stays inside the free tier.
3. **Authentication** → Get started → Sign-in method → **Email/Password**: enable it *and* enable **Email link (passwordless sign-in)** (chef invites use it).
   - Settings → Authorized domains → add `heebee-slack.github.io`.
   - Users → **Add user** → `gavish@heebeecoffee.com` + your password. This is the admin login.
4. **Firestore Database** → Create → location `asia-south1 (Mumbai)` → production mode. **Rules** tab → paste `firestore.rules` → Publish.
5. **Storage** → Get started → same location. **Rules** tab → paste `storage.rules` → Publish.
6. Project settings → Your apps → **Web (</>)** → register "Workshops" → copy the `firebaseConfig` values into `js/config.js`. (These keys are public by design; the rules protect the data.)
7. Admin → Settings: add the WhatsApp number, UPI ID, payee name and QR image.

To add another admin, add their email to `ADMIN_EMAILS` in `js/config.js` **and** to `isAdmin()` in both rules files.

## Chefs

Admin → Chefs → **Add chef** (name + email) sends a Firebase invite email. The chef opens it, sets a password and builds their profile at `#/chef`. Admin can **block** a profile (hidden publicly; the chef sees "Your profile has been blocked by the company") or **hide** single posts. Photos are resized in the browser (max 2048px JPEG) so uploads stay well under 5 MB; the storage rules also reject anything 5 MB or larger.

## Data

- `events/{id}`: title, tagline, description, includes[], imageUrl, chefId, durationMins, price, venue{name,address,mapsUrl}, batches[{id,date,time,seats,price,chefId}], confirmed{batchId: n}, status, featured
- `bookings/{id}`: ref, eventId, batchId, name, phone, whatsapp, email, agreedAt, status (waitlist/confirmed/cancelled), spot, timestamps. **Public can create, only admin can read.**
- `chefs/{id}` + `chefs/{id}/posts/{id}`, `chefInvites/{email}` → chefId, `updates/{id}` (keep-me-updated), `settings/main`
