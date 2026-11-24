import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import logoMark from '@/assets/logo-mark.png'
import styles from './PrivacyPage.module.css'

const UPDATED = '24 November 2026'

export default function PrivacyPage() {
  useEffect(() => {
    document.title = 'Privacy policy · FindHouse'
  }, [])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true"><img src={logoMark} alt="" /></span>
          FindHouse
        </Link>
      </header>

      <main className={styles.main}>
        <h1>Privacy policy</h1>
        <p className={styles.updated}>Last updated {UPDATED}</p>
        <p>
          FindHouse (<a href="https://findhouse.in">findhouse.in</a>) turns WhatsApp messages from property brokers
          into listing pages. This policy describes what we keep, why we keep it, and who can see it.
        </p>

        <section>
          <h2>Who this covers</h2>
          <p>It covers two groups:</p>
          <ul>
            <li>Brokers who are invited to FindHouse, register, and send listings.</li>
            <li>Anyone who opens a public listing page or a broker’s public site.</li>
          </ul>
        </section>

        <section>
          <h2>Brokers</h2>
          <p>When FindHouse staff add you, we store your WhatsApp number. When you register, we also store:</p>
          <ul>
            <li>Your name, which becomes the name of your public site.</li>
            <li>The site address we make from that name, such as <span className={styles.mono}>your-name.findhouse.in</span>.</li>
            <li>A password. Sign-in is handled by our authentication service. The password is not kept in the property records.</li>
            <li>Whether your account is active, blocked, on a free trial, or paid.</li>
          </ul>
          <p>
            In the workspace you can add and edit listings: rent or price, address, rooms, photos, a description,
            and any extra detail you type as a name and a value. Those extra details are stored with the listing.
          </p>
        </section>

        <section>
          <h2>WhatsApp messages</h2>
          <p>
            Messages you send to the FindHouse WhatsApp number are stored: the text, photos, videos, and captions.
            Photos and videos are kept as files so the listing and the original message can both use them.
          </p>
          <p>
            We read those messages to build the listing. An AI service extracts the details you mentioned, such as
            the rent, the area, the rooms, and any other fact you named. It is instructed to leave out anything you
            did not mention. Photos may also be labelled by room, for example living room or kitchen, so the gallery
            can be grouped.
          </p>
          <p>
            A number that has not been added by FindHouse staff is ignored. A trial account can build one listing;
            after that, further messages are ignored until the account is paid.
          </p>
        </section>

        <section>
          <h2>People who open a listing</h2>
          <p>
            Opening a listing does not ask you to create an account, and the page has no enquiry form. The page
            shows the property details the broker saved, and buttons to call or WhatsApp the broker. That
            conversation goes to the broker’s number. FindHouse does not receive the contents of the call or chat.
          </p>
          <p>
            A public listing appears on the broker’s site, where anyone can find it. A private listing stays off
            that site and off search engines. Anyone who has the link can still open it.
          </p>
        </section>

        <section>
          <h2>What the browser keeps</h2>
          <p>
            FindHouse does not use advertising or analytics cookies. On your device, the browser may store your
            sign-in, your colour theme, and whether you prefer the property list or the grid. Signing out clears
            the sign-in.
          </p>
        </section>

        <section>
          <h2>Who else handles this information</h2>
          <p>We use these services to run FindHouse:</p>
          <ul>
            <li>Supabase, for the database and broker sign-in.</li>
            <li>Cloudflare, to host the website and to store photos and videos.</li>
            <li>WhatsApp, to receive the messages brokers send and to send listing links back.</li>
            <li>Anthropic, to read messages and photos and fill in the listing.</li>
          </ul>
          <p>
            FindHouse staff can see broker numbers so they can invite, block, unblock, or remove a number that has
            not registered. A broker’s workspace shows only that broker’s own listings and WhatsApp submissions.
          </p>
          <p>
            We do not sell personal information. A listing is visible to the people described above: anyone with
            the link, and, when the broker marks it public, anyone who visits the broker’s site.
          </p>
        </section>

        <section>
          <h2>How long we keep it</h2>
          <p>
            A listing stays until the broker deletes it. Deleting a property removes it from FindHouse. The
            WhatsApp messages that created it, and the files attached to those messages, stay as the record of
            that submission. Files uploaded from the workspace are removed from the listing; a copy may remain in
            storage until it is cleared.
          </p>
          <p>
            To correct your name or site address, use Settings. To correct a listing, open it and save the change.
            To ask us to close your account, message the FindHouse WhatsApp number from the phone number on the
            account. Some records, including the original WhatsApp messages, may need to stay.
          </p>
        </section>

        <section>
          <h2>Children</h2>
          <p>FindHouse is for property brokers. It is not directed at children.</p>
        </section>

        <section>
          <h2>Changes</h2>
          <p>
            If this policy changes, the new version will be published on this page with a new date.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            FindHouse, <a href="https://findhouse.in">findhouse.in</a>. Brokers can reach us by messaging the
            FindHouse WhatsApp number from the phone number on their account.
          </p>
        </section>
      </main>
    </div>
  )
}
