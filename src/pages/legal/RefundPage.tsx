import LegalLayout from "./LegalLayout";

export default function RefundPage() {
  return (
    <LegalLayout title="Refund Policy" updated="27 July 2026">
      <p>
        Cortexed is operated by <b>Pranit Singh Chhabra</b>. Payments are
        processed by our Merchant of Record, Paddle.com.
      </p>

      <h2>30-day money-back guarantee</h2>
      <p>
        We offer a <b>30-day money-back guarantee</b> on new paid subscriptions.
        If you are not satisfied with your purchase, you can request a full
        refund within 30 days of your order date.
      </p>

      <h2>How to request a refund</h2>
      <p>
        Refunds are handled by Paddle. To request a refund, visit{" "}
        <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">paddle.net</a>{" "}
        and locate your order using the email address you used at checkout, or
        contact us through the in-app support channel and we will assist you.
      </p>

      <h2>Subscription cancellations</h2>
      <p>
        You can cancel your subscription at any time from the Pricing page in
        the app. Cancellation stops future renewals; you retain access until
        the end of the current billing period. Renewal charges outside the
        30-day window are generally non-refundable, but we consider requests
        made in good faith on a case-by-case basis, together with Paddle.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about refunds: contact us through the in-app support channel
        or reach Paddle at{" "}
        <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">paddle.net</a>.
      </p>
    </LegalLayout>
  );
}