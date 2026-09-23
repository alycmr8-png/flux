import type { Metadata } from "next";
import { LegalPage, Fill } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Ucorns",
  description: "What Ucorns collects, who processes it, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="19 September 2026">
      <p>
        Ucorns records university lectures and turns them into study material. That means we handle
        recordings of classrooms, the notes you write, and the questions you ask. This page explains
        exactly what we hold, who else processes it, and how to get rid of it.
      </p>
      <p>
        Ucorns is operated by <Fill>[LEGAL ENTITY NAME]</Fill>, <Fill>[REGISTERED ADDRESS]</Fill>
        {" "}("Ucorns", "we", "us"). Questions about this policy go to <Fill>[PRIVACY CONTACT EMAIL]</Fill>.
      </p>

      <h2>1. What we collect</h2>

      <h3>Your account</h3>
      <p>
        Your email address and name, taken from the sign-in method you choose (email, or Google).
        You may also pick an avatar emoji and colour, and an interface language. Authentication is
        handled by Clerk — we never see or store your password.
      </p>

      <h3>What you capture in class</h3>
      <ul>
        <li><strong>Audio recordings</strong> of lectures you record, and their duration.</li>
        <li><strong>Transcripts</strong> of those recordings, including per-sentence timestamps.</li>
        <li><strong>Photographs</strong> you take of whiteboards, slides or handwritten pages, and the text read from them.</li>
        <li><strong>Files</strong> you upload, such as slide decks and PDFs, and links you paste.</li>
        <li><strong>Notes</strong> you write yourself.</li>
      </ul>

      <h3>What Ucorns generates from it</h3>
      <p>
        Summaries, key points, flashcards, practice quizzes and exam packs; your quiz answers and
        scores; and a searchable index of your course, stored as short excerpts with numerical
        representations (embeddings) used to find relevant passages when you ask a question.
      </p>

      <h3>Connected services, if you choose to connect them</h3>
      <p>
        If you connect Google, we store access tokens so Ucorns can add study events to your calendar
        and save study material to your Drive. If you connect Canvas, we store the credentials needed
        to read your course information. You can disconnect either at any time.
      </p>

      <h3>Messages and sharing</h3>
      <p>
        Ucorns lets you connect with other students, send them messages, and share study material. Those
        messages and shared items are stored so the other person can read them. Treat them as visible
        to their recipient — they are not end-to-end encrypted.
      </p>

      <h3>Billing</h3>
      <p>
        Payments are processed by Stripe. <strong>We never receive or store your card number.</strong> We
        keep your Stripe customer and subscription identifiers, your plan, its status and renewal date.
      </p>

      <h3>Usage</h3>
      <p>
        Counts of lectures recorded, minutes of audio, questions asked and study material generated in
        the current month, so we can apply plan limits. Plus ordinary server logs (IP address, device
        and browser type, timestamps) kept for security and debugging.
      </p>

      <h2>2. Recordings, and the people in them</h2>
      <div className="callout">
        <p>
          <strong>A lecture recording captures other people — usually your lecturer, sometimes
          classmates who ask questions.</strong> Those people are not Ucorns users and have not agreed to
          anything with us.
        </p>
        <p>
          You are responsible for having permission to record, under the law where you are and the
          rules of your institution. Some places require everyone present to consent; many universities
          restrict recording outright. Please check before you record. See our{" "}
          <a href="/terms">Terms of Service</a>.
        </p>
      </div>
      <p>
        We process a recording only to produce your study material. We do not identify speakers, build
        voice profiles, or match voices between recordings. If a lecturer or classmate asks us to
        remove a recording of them, write to <Fill>[PRIVACY CONTACT EMAIL]</Fill> and we will work with
        you to locate and delete it.
      </p>

      <h2>3. Why we use it</h2>
      <ul>
        <li><strong>To provide the product</strong> — transcribing recordings, reading photographs, generating study material, answering questions about your course, and syncing what you asked us to sync.</li>
        <li><strong>To run your account</strong> — signing you in, applying plan limits, taking payment, and contacting you about your account.</li>
        <li><strong>To keep it working and safe</strong> — diagnosing faults, preventing abuse, and protecting the service.</li>
        <li><strong>To meet legal obligations.</strong></li>
      </ul>
      <p>
        Where the GDPR applies, we rely on <strong>performance of a contract</strong> for providing the
        product, <strong>legitimate interests</strong> for security and improvement, and{" "}
        <strong>consent</strong> where you connect an optional service such as Google.
      </p>

      <h2>4. Who else processes your data</h2>
      <p>These providers process data on our behalf so Ucorns can work:</p>
      <table>
        <thead>
          <tr><th>Provider</th><th>What it handles</th></tr>
        </thead>
        <tbody>
          <tr><td>Clerk</td><td>Sign-in, your email and name</td></tr>
          <tr><td>Neon</td><td>The database: transcripts, notes, study material, course index</td></tr>
          <tr><td>Deepgram</td><td>Live transcription — audio is streamed as you record</td></tr>
          <tr><td>OpenAI</td><td>Transcription fallback, reading photographs, generating study material and answers, and creating embeddings</td></tr>
          <tr><td>Stripe</td><td>Payments and subscriptions</td></tr>
          <tr><td>Google</td><td>Calendar and Drive, only if you connect them</td></tr>
          <tr><td><Fill>[HOSTING PROVIDER]</Fill></td><td>Servers and stored audio files</td></tr>
        </tbody>
      </table>
      <p>
        We do not sell your data, and we do not share it for advertising.
      </p>

      <h3>Artificial intelligence and training</h3>
      <p>
        <strong>Your recordings, notes and questions are not used to train our models or our providers'
        models.</strong> We use Deepgram and OpenAI through their business APIs, under terms that
        exclude API content from model training. We do not train any model on your content.
      </p>

      <h2>5. Where your data is held</h2>
      <p>
        Data is stored and processed in <Fill>[PRIMARY DATA REGION]</Fill>, and our providers may process
        it elsewhere, including the United States. Where the GDPR applies, those transfers rely on the
        European Commission's Standard Contractual Clauses.
      </p>

      <h2>6. How long we keep it</h2>
      <ul>
        <li><strong>While your account is open</strong> — recordings, transcripts, notes and study material are kept until you delete them, because the point of the product is that they are still there at exam time.</li>
        <li><strong>Deleted recordings</strong> move to your archive first, and are removed permanently when you delete them from there.</li>
        <li><strong>When you delete your account</strong> — see below.</li>
        <li><strong>Billing records</strong> are kept as long as tax and accounting law requires, typically <Fill>[RETENTION PERIOD]</Fill>.</li>
      </ul>

      <h2>7. Deleting your account</h2>
      <p>
        You can delete your account from inside Ucorns: <strong>Account → Delete account</strong>, on the
        web and in the phone app. It cannot be undone. Deleting removes:
      </p>
      <ul>
        <li>your recordings and their audio files;</li>
        <li>every transcript, note, photograph, summary, quiz and flashcard;</li>
        <li>your course index, including the stored excerpts and embeddings;</li>
        <li>your calendar events and any connected-service tokens;</li>
        <li>your sign-in identity.</li>
      </ul>
      <p>
        Any paid subscription is cancelled at the same time. Backups are overwritten on our ordinary
        cycle, within <Fill>[BACKUP RETENTION]</Fill>. Messages you sent to another student may remain
        visible to that person.
      </p>

      <h2>8. Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access, correct, export, restrict or
        delete your personal data, to object to certain processing, and to withdraw consent. Most of
        this you can do yourself in the app; for anything else write to{" "}
        <Fill>[PRIVACY CONTACT EMAIL]</Fill> and we will respond within one month.
      </p>
      <p>
        If you are in the EU or UK and think we have handled your data badly, you may complain to your
        national data protection authority.
      </p>
      <p>
        If you are in California, we do not sell or share personal information as those terms are
        defined by the CCPA, and we will not discriminate against you for exercising your rights.
      </p>

      <h2>9. Children</h2>
      <p>
        Ucorns is for university and college students. It is not intended for children under{" "}
        <Fill>[MINIMUM AGE — 13, or 16 in parts of the EU]</Fill>, and we do not knowingly collect their
        data. If you believe a child has given us personal data, write to{" "}
        <Fill>[PRIVACY CONTACT EMAIL]</Fill> and we will delete it.
      </p>

      <h2>10. Security</h2>
      <p>
        Traffic is encrypted in transit. Audio is served through short-lived signed links rather than
        public URLs, so a recording cannot be reached by guessing an address. Access to production data
        is limited to people who need it. No service can promise perfect security, and we will tell you
        and the relevant regulator if a breach affects your data.
      </p>

      <h2>11. Changes</h2>
      <p>
        We will update this page when the product changes, and update the date at the top. If a change
        materially affects your rights, we will tell you in the app or by email before it takes effect.
      </p>

      <h2>12. Contact</h2>
      <p>
        <Fill>[LEGAL ENTITY NAME]</Fill><br />
        <Fill>[REGISTERED ADDRESS]</Fill><br />
        <Fill>[PRIVACY CONTACT EMAIL]</Fill>
        <br />
        <Fill>[EU/UK REPRESENTATIVE, IF REQUIRED]</Fill>
      </p>
    </LegalPage>
  );
}
