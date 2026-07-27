import LegalLayout from "./LegalLayout";

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Notice" updated="27 July 2026">
      <p>
        This Privacy Notice describes how <b>Pranit Singh Chhabra</b> ("we",
        "us", "our"), the operator of Cortexed (the "Service"), collects and
        processes your personal data. We act as the <b>data controller</b> for
        personal data collected through the Service.
      </p>

      <h2>1. Data we collect</h2>
      <ul>
        <li><b>Account data</b> — name, email address, login credentials, authentication provider identifiers (e.g. Google).</li>
        <li><b>Profile & learning data</b> — subjects, goals, tracks, notes, chat messages, session progress, mastery and review history.</li>
        <li><b>Support data</b> — messages you send us and any attachments.</li>
        <li><b>Usage & device data</b> — pages visited, features used, timestamps, device type, browser, IP address, and diagnostic logs.</li>
        <li><b>Cookies & similar technologies</b> — see section 8.</li>
      </ul>
      <p>
        Payment information (card details, billing address, tax IDs) is
        collected and processed by Paddle as Merchant of Record and is not
        stored by us.
      </p>

      <h2>2. Purposes and legal bases</h2>
      <ul>
        <li>Creating and managing your account, and providing the Service — <i>performance of a contract</i>.</li>
        <li>Personalising learning paths and AI responses — <i>performance of a contract</i>.</li>
        <li>Security, fraud prevention, and abuse detection — <i>legitimate interests</i>.</li>
        <li>Product improvement and analytics — <i>legitimate interests</i>.</li>
        <li>Customer support — <i>performance of a contract</i> / <i>legitimate interests</i>.</li>
        <li>Legal and tax compliance — <i>legal obligation</i>.</li>
        <li>Marketing emails (if you opt in) — <i>consent</i>, which you may withdraw at any time.</li>
      </ul>

      <h2>3. AI processing</h2>
      <p>
        Prompts and related context you submit to AI features are sent to
        third-party model providers acting as our processors to generate
        responses. We do not sell your data and do not permit providers to use
        your content to train their public models beyond what is required to
        deliver the response.
      </p>

      <h2>4. Sharing</h2>
      <p>We share personal data with the following categories of recipients:</p>
      <ul>
        <li><b>Service providers / subprocessors</b> — hosting, database, authentication, analytics, email, and AI model providers, under written data processing terms.</li>
        <li><b>Paddle.com</b> — our Merchant of Record for sale of the Service, subscription management, payments, tax compliance and invoicing.</li>
        <li><b>Professional advisers</b> — legal, accounting, and audit advisers where necessary.</li>
        <li><b>Authorities</b> — where required by law, regulation, or valid legal process.</li>
      </ul>

      <h2>5. International transfers</h2>
      <p>
        Personal data may be processed outside the UK/EEA by our providers.
        Where this occurs we rely on appropriate safeguards such as the UK
        International Data Transfer Agreement, EU Standard Contractual Clauses
        or adequacy decisions.
      </p>

      <h2>6. Retention</h2>
      <p>
        We retain personal data for as long as your account is active and for a
        reasonable period thereafter to comply with legal obligations, resolve
        disputes and enforce agreements. Learning content and chat history are
        deleted or anonymised when no longer needed. You can request deletion
        at any time (see section 7).
      </p>

      <h2>7. Your rights</h2>
      <p>
        Subject to local law, you may have the right to access, rectify, erase,
        restrict or object to processing of your personal data, to data
        portability, and to withdraw consent. UK/EEA users also have the right
        to lodge a complaint with a supervisory authority (in the UK, the ICO).
        We aim to respond within one month. To exercise your rights, contact us
        through the in-app support channel or delete your account from
        Settings.
      </p>

      <h2>8. Cookies</h2>
      <p>
        We use strictly necessary cookies and local storage to keep you signed
        in, remember preferences, and secure the Service. We may use limited
        first-party analytics to understand usage. You can control cookies via
        your browser settings; disabling essential cookies may break sign-in.
      </p>

      <h2>9. Security</h2>
      <p>
        We use appropriate technical and organisational measures — including
        encryption in transit, access controls, and row-level security in our
        database — to protect personal data. No system is perfectly secure; we
        will notify affected users of a personal data breach where required by
        law.
      </p>

      <h2>10. Children</h2>
      <p>
        The Service is not directed to children under 13. If you believe a
        child has provided personal data without appropriate consent, contact
        us so we can delete it.
      </p>

      <h2>11. Changes</h2>
      <p>
        We may update this Notice from time to time. Material changes will be
        notified in the Service or by email.
      </p>

      <h2>12. Contact</h2>
      <p>
        Data controller: <b>Pranit Singh Chhabra</b>. Contact us through the
        in-app support channel for any privacy request.
      </p>
    </LegalLayout>
  );
}