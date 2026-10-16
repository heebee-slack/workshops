// Default settings: policy text and WhatsApp templates. All editable from Admin → Settings.

export const DEFAULT_POLICY = `HEEBEE WORKSHOPS — TERMS, NO-SHOW AND NO-REFUND POLICY

1. Waitlist first, seat second
Submitting this form adds you to the waitlist for the batch you chose. It does not reserve a seat. Your seat is confirmed only after we have received your full payment and sent you a confirmation message on WhatsApp with your seat number.

2. Payment
Payment details (UPI ID / QR) are shared with you on WhatsApp by the Heebee team. Please send a screenshot of the successful payment on the same WhatsApp chat. Payments are verified manually; until verification you remain on the waitlist. If a batch fills up before your payment is verified, we will offer you a seat in another batch or return your payment in full.

3. No refunds
All confirmed bookings are final. Workshop fees are non-refundable and non-transferable to cash, for any reason, including change of plans, illness, travel, traffic or weather. Ingredients, equipment and the chef's time are arranged in advance for every confirmed seat, so we cannot release or refund them.

4. No-shows and late arrival
If you do not attend, or arrive more than 20 minutes after the start time, your seat is treated as a no-show. No-shows are not refunded, rescheduled or credited. Late arrivals may join if the chef can accommodate them, but missed portions of the workshop will not be repeated.

5. Seat transfer
You may transfer your confirmed seat to a friend once, by informing us on WhatsApp at least 24 hours before your batch starts. The person attending must share their name and phone number with us. Transfers are not possible within 24 hours of the start time.

6. Rescheduling by Heebee
If Heebee or the chef has to cancel or reschedule a batch, you can choose to move to another batch or receive a full refund of the amount paid. Heebee is not responsible for any other costs, such as travel.

7. One seat per form
Each form books one seat for one person. Friends must fill in their own form; use the "Share with a friend" button.

8. Allergies and dietary needs
Workshops may involve gluten, dairy, eggs, nuts and other allergens. Please tell us about any allergies on WhatsApp before your batch. Heebee cannot guarantee an allergen-free environment, and you take part at your own discretion.

9. Conduct and safety
Please follow the chef's instructions, especially around knives, ovens and hot surfaces. Heebee may ask anyone behaving unsafely or disrespectfully to leave, without a refund. Children under 14 must be accompanied by a booked adult unless the workshop is marked as a kids' workshop.

10. Photos and video
We may photograph or film workshops for Heebee's social media and marketing. If you'd prefer not to appear, please tell the team on arrival.

11. Changes to the workshop
The menu, recipes or chef may change for reasons outside our control. We'll always tell you in advance on WhatsApp.

By ticking the box, you confirm that you have read and agree to these terms, including the no-show and no-refund policy.`;

// No emojis: WhatsApp's click-to-chat links turn them into "�". Symbols like ₹ · – ✦ are fine.
export const DEFAULT_TEMPLATES = {
  payment: `Hi {name},

Thank you for joining the waitlist for *{event}* at Heebee!

*Date:* {date} · {time}
*Duration:* {duration}
*Venue:* {venue}
*Ref:* {ref}

To move from the waitlist to a *confirmed seat*, please pay *{price}* to:
UPI ID: *{upi}*
Name: {payee}

QR code and one-tap UPI: {payLink}

Once paid, reply here with a *screenshot of the payment*. We'll confirm your seat right after we verify it.

Please note: bookings are non-refundable and no-shows are not refunded.

Stay happy, stay caffeinated!
Team Heebee`,
  confirmed: `Congratulations {name}!

You've been moved from the waitlist to a *confirmed seat* for *{event}*.

✦ *Seat #{spot}*
*Date:* {date} · {time}
*Duration:* {duration}
*Venue:* {venue}
{maps}
*Ref:* {ref}

Please arrive 10 minutes early. See you there!

Stay happy, stay caffeinated!
Team Heebee`,
  reminder: `Hi {name}! A quick reminder that *{event}* is coming up.

*Date:* {date} · {time}
*Venue:* {venue}
{maps}
*Seat:* #{spot}

Please arrive 10 minutes early. See you soon!
Team Heebee`,
  relaunch: `Hi {name},

Good news! *{event}* is back at Heebee, with new batches open now.

Pick your batch and join the waitlist here:
{link}

Seats are limited, so join early!
Team Heebee`,
};

export const DEFAULT_SETTINGS = {
  whatsapp: '',
  upiId: '',
  payeeName: 'Heebee Coffee',
  qrUrl: '',
  policy: DEFAULT_POLICY,
  templates: DEFAULT_TEMPLATES,
};

export const TEMPLATE_VARS = '{name} {event} {date} {time} {duration} {venue} {maps} {price} {upi} {payee} {payLink} {ref} {spot} {link}';
