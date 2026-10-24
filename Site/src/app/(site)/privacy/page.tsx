import type { Metadata } from 'next';
import { ProseLink as A, ProsePage } from '@/components/Prose';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Privacy' };

const mail = <A href={`mailto:${LEGAL.email}`}>{LEGAL.email}</A>;
const B = ({ children }: { children: React.ReactNode }) => <b className="text-ink">{children}</b>;

// Placeholder copy: have someone qualified review before launch.
// Keep this in step with the code: if you start storing or sharing something new, say so here.
export default function Privacy() {
  return (
    <ProsePage
      title="Privacy"
      updated={LEGAL.updated}
      intro="This policy explains what YapBoard collects, why, who sees it, how long we keep it, and what you can do about it. It covers yapboard.dev, portal.yapboard.dev and the YapBoard bot."
      summary={[
        'From Yapin’ we get your user ID, username, display name and avatar. Never your email, password or messages.',
        'No ads, no analytics, no tracking cookies. We don’t sell or share your data for advertising.',
        'One cookie keeps you logged in. Another lasts ten minutes while you log in.',
        'Listings are public by design, including the lister’s name and avatar.',
        'You can see, fix or delete your data. Email us and we’ll do it within a month.',
      ]}
      sections={[
        {
          id: 'controller',
          h: 'Who’s responsible for your data',
          p: [
            <>
              {LEGAL.operator} runs YapBoard and is the controller of your personal data under UK data protection law (the UK GDPR and the Data Protection Act 2018). Contact us at {mail}.
            </>,
            'This policy doesn’t cover Yapin’ itself, or the servers you find here. They have their own rules about your data.',
          ],
        },
        {
          id: 'collect',
          h: 'What we collect',
          p: [
            <>
              <B>When you log in with Yapin’.</B> Yapin’ gives us your user ID, username, display name and avatar. That’s everything the “identify” permission allows. Yapin’ also gives us a temporary access token: we use it once to fetch those details and then throw it away. We don’t store it, and we can’t act on your Yapin’ account.
            </>,
            <>
              <B>When you use /bump.</B> The bot sends us your user ID, username, display name and avatar, the server ID and its member count. This happens even if you’ve never visited YapBoard, because we need a basic profile to record who bumped.
            </>,
            <>
              <B>When you list or manage a server.</B> Everything you enter in the listing form. The bot fetches the server’s name, icon, banner and owner from Yapin’. To check you can manage the server, we ask Yapin’ whether you’re a member and which roles you have. We use that answer for the check and don’t store your roles.
            </>,
            <>
              <B>When you send a report.</B> The listing, the reason you picked, what you wrote, and your user ID.
            </>,
            <>
              <B>Records of what happens on YapBoard.</B> Bumps (who, which server and when), when your profile was created and when you last logged in, your role, and if you’re banned, when and why. When staff take an action, we log which staff member did what, to which listing or account, and their note.
            </>,
            <>
              <B>Collected automatically.</B> Page views and join clicks are kept as running totals per server. We don’t record who viewed or clicked. To limit abuse, we briefly count actions like reports against your user ID in server memory. Those counts are never written to disk and are gone within an hour. Our hosting provider keeps standard request logs (IP address, browser, the page requested and the time) for security and troubleshooting.
            </>,
          ],
        },
        {
          id: 'not-collect',
          h: 'What we don’t collect',
          p: [
            {
              ul: [
                'Your email address, password, phone number or payment details.',
                'Your messages, or anything said inside servers. The bot doesn’t read messages.',
                'Your friends list, DMs or the other servers you’re in.',
                'Analytics, advertising pixels, social media trackers or device fingerprints. Our fonts are served from our own domain, not from Google.',
              ],
            },
          ],
        },
        {
          id: 'public',
          h: 'What’s public',
          p: [
            'Listings are meant to be found. Everything in a listing, plus its member count, bump count, tags, badge and the time it was last bumped, can be seen by anyone, including search engines. The listing page also shows the display name (or username) and avatar of the person who listed it.',
            'View, join-click and bump totals appear on the owner’s dashboard, and anyone in the server can see them with /yapboard.',
            'Reports are never shown to the server you reported or to the public. Staff can see who sent a report.',
          ],
        },
        {
          id: 'use',
          h: 'Why we use it, and our legal basis',
          p: [
            'UK data protection law says we need a legal basis for each use. Ours are:',
            {
              ul: [
                <>
                  <B>Running YapBoard for you</B> (logging you in, showing and editing your listings, recording bumps, checking you can manage a server): necessary to provide the service you asked for, under our <A href="/terms">terms</A>.
                </>,
                <>
                  <B>Keeping YapBoard safe and fair</B> (handling reports, moderation, bans, preventing ban evasion and bump manipulation, the staff audit log, request logs, rate limits): our legitimate interest in protecting users and the integrity of the list.
                </>,
                <>
                  <B>Stats for server owners</B> (view, join and bump totals): our legitimate interest, and yours, in seeing how a listing is doing. These are totals, not records about people.
                </>,
                <>
                  <B>Following the law</B> (answering lawful requests, keeping records the law requires): legal obligation.
                </>,
              ],
            },
            'We don’t use your data for advertising, and we don’t make decisions about you by automated means that have legal or similarly significant effects. Cooldowns and rate limits are automatic, but every moderation decision is made by a person.',
          ],
        },
        {
          id: 'sharing',
          h: 'Who we share it with',
          p: [
            'We never sell or rent your personal data. We share it only with:',
            {
              ul: [
                <>
                  <B>Our service providers.</B> Companies that host the site and the database store and process data for us, under contracts that only let them use it to provide that service.
                </>,
                <>
                  <B>Yapin’.</B> To check ownership or record a bump, we call Yapin’s API, which tells Yapin’ which server and user we’re asking about. Server icons, banners and avatars load straight from Yapin’s servers, so Yapin’ receives your IP address and browser details when you view them, as with any image. Yapin’ handles that under its own privacy policy.
                </>,
                <>
                  <B>YapBoard staff.</B> Our volunteer moderators can see reports, profiles, listings and the audit log in the staff portal. They may only use it to moderate YapBoard.
                </>,
                <>
                  <B>Authorities.</B> When the law requires it, or when we believe in good faith it’s needed to protect someone from serious harm, such as reporting child sexual abuse material.
                </>,
                <>
                  <B>A new operator.</B> If someone else takes over YapBoard, your data moves with it under this policy, and we’ll tell you first.
                </>,
              ],
            },
          ],
        },
        {
          id: 'transfers',
          h: 'International transfers',
          p: [
            'Our providers may store or process data outside the UK. When they do, we make sure it’s protected by UK adequacy regulations or by approved safeguards such as the UK International Data Transfer Agreement or the UK Addendum to the EU Standard Contractual Clauses.',
          ],
        },
        {
          id: 'retention',
          h: 'How long we keep it',
          p: [
            {
              ul: [
                <>
                  <B>Your profile:</B> until you ask us to delete it. If you have no listings and haven’t logged in or bumped for {LEGAL.inactiveMonths} months, we delete it.
                </>,
                <>
                  <B>Listings:</B> until you delete them. Deleting a listing removes it, its tags, its bump history and the reports about it straight away.
                </>,
                <>
                  <B>Listings removed by staff:</B> we keep the server ID, its status and the staff note so it can’t simply be listed again.
                </>,
                <>
                  <B>Reports:</B> as long as the listing exists, so staff can spot repeat problems. If you delete your account, reports you sent stay but are no longer linked to you.
                </>,
                <>
                  <B>Bans and the staff audit log:</B> as long as needed to enforce bans and handle appeals. If a banned account is deleted, we keep its user ID, the ban date and the reason, to stop ban evasion.
                </>,
                <>
                  <B>Cookies:</B> the login cookie lasts 30 days, or until you log out. The login-check cookie lasts 10 minutes.
                </>,
                <>
                  <B>Backups:</B> deleted data can stay in database backups for up to {LEGAL.backupDays} days before it’s overwritten.
                </>,
              ],
            },
          ],
        },
        {
          id: 'cookies',
          h: 'Cookies',
          p: [
            'We use two cookies. Both are strictly necessary for logging in, so they don’t need your consent, and there’s nothing to opt out of.',
            {
              ul: [
                <>
                  <code className="font-mono text-[14px] text-ink">yb_session</code> keeps you logged in, on yapboard.dev and the staff portal. Lasts 30 days. Your browser’s scripts can’t read it.
                </>,
                <>
                  <code className="font-mono text-[14px] text-ink">yb_oauth</code> protects your login from forgery while you’re sent to Yapin’ and back. Lasts 10 minutes and is deleted once you’re in.
                </>,
              ],
            },
            'No advertising, analytics or third-party cookies.',
          ],
        },
        {
          id: 'security',
          h: 'Security',
          p: [
            'Everything is served over HTTPS. Sessions are signed and kept in cookies scripts can’t read, login uses OAuth with PKCE, we never store Yapin’ passwords or access tokens, and only staff can open the portal.',
            <>
              No system is perfectly secure. If a breach is likely to put you at risk, we’ll tell the Information Commissioner’s Office within 72 hours of finding out, and tell you without undue delay. If you find a security problem, please email {mail} and give us a chance to fix it before telling others.
            </>,
          ],
        },
        {
          id: 'rights',
          h: 'Your rights',
          p: [
            'You have the right to:',
            {
              ul: [
                'get a copy of the personal data we hold about you;',
                'have it corrected if it’s wrong;',
                'have it deleted;',
                'restrict how we use it, or object to us using it on the basis of legitimate interests;',
                'get it in a portable, machine-readable format; and',
                'complain to a data protection regulator.',
              ],
            },
            'Much of this you can do yourself. Your username, display name and avatar update from Yapin’ each time you log in. Edit or delete a listing from its manage page.',
            <>
              For anything else, email {mail}. To make sure it’s really you, we’ll ask you to confirm the request from your Yapin’ account. We’ll reply within one month. If a request is complicated we may need up to two more months, and we’ll tell you if so. It’s free.
            </>,
            <>
              <B>Deleting your account.</B> Revoking YapBoard in Yapin’ under Settings → Authorized Apps stops future logins but doesn’t delete what we already hold. Ask us to delete your account and, within 30 days, we’ll delete your profile, your listings (with their bumps and reports) and the bumps you made, and unlink the reports you sent. If you’re banned, we keep the ban record described above.
            </>,
            <>
              <B>Complaints.</B> We’d like the chance to sort things out first, but you can complain to the UK Information Commissioner’s Office at <A href="https://ico.org.uk/make-a-complaint/">ico.org.uk</A> or on 0303 123 1113. If you live in the EU, you can also contact your local data protection authority.
            </>,
          ],
        },
        {
          id: 'children',
          h: 'Children',
          p: [
            <>
              YapBoard isn’t for anyone under {LEGAL.minAge}, or under the minimum age to use Yapin’ where they live. If we learn we hold data about a child under that age, we delete it. Parents or guardians who think this has happened can email {mail}.
            </>,
            'Listings marked 18+ are hidden from search unless you choose to show them, and are only for adults.',
          ],
        },
        {
          id: 'changes',
          h: 'Changes to this policy',
          p: [
            'We’ll update this policy when what we collect or how we use it changes. The date at the top shows the last change. For significant changes, we’ll give notice on YapBoard before they apply, and we won’t use data already collected in a significantly new way without telling you first.',
          ],
        },
        {
          id: 'contact',
          h: 'Contact',
          p: [<>Questions about your data or this policy? Email {mail}.</>],
        },
      ]}
    />
  );
}
