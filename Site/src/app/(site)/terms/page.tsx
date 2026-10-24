import type { Metadata } from 'next';
import { ProseLink as A, ProsePage } from '@/components/Prose';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Terms' };

const mail = <A href={`mailto:${LEGAL.email}`}>{LEGAL.email}</A>;

// Placeholder copy: have someone qualified review before launch.
export default function Terms() {
  return (
    <ProsePage
      title="Terms"
      updated={LEGAL.updated}
      intro={
        <>
          These terms are the agreement between you and YapBoard whenever you use yapboard.dev, portal.yapboard.dev, the YapBoard bot or anything else we run (together, “YapBoard”). Please read them. If you don’t agree, don’t use YapBoard.
        </>
      }
      summary={[
        'YapBoard is a free, community-run list of Yapin’ servers. Yapin’ doesn’t run it.',
        'You keep ownership of what you write. You let us show it on YapBoard.',
        'Only list servers you run. Keep listings honest, and follow the listing guidelines.',
        'We can hide or remove listings and ban accounts that break the rules.',
        'We don’t run the servers listed here. Join them at your own risk.',
        'YapBoard comes as is, and our liability is limited as far as the law allows.',
      ]}
      sections={[
        {
          id: 'about',
          h: 'Who we are',
          p: [
            <>YapBoard is run by {LEGAL.operator} (“we”, “us”). It’s an independent, community-run directory of servers on Yapin’. It isn’t owned, operated, sponsored or endorsed by Yapin’.</>,
            <>You can reach us at {mail}.</>,
          ],
        },
        {
          id: 'agreement',
          h: 'Your agreement with us',
          p: [
            <>
              By using YapBoard, logging in, adding the bot to a server or listing a server, you agree to these terms and to the <A href="/guidelines">listing guidelines</A>, which form part of them. Our <A href="/privacy">privacy policy</A> explains what we do with your data.
            </>,
            'If you use YapBoard on behalf of a server, community, business or other organisation, you confirm you’re allowed to accept these terms for it, and “you” includes that organisation.',
            'Yapin’s own terms still apply to everything you do on Yapin’. Nothing here changes them.',
          ],
        },
        {
          id: 'eligibility',
          h: 'Who can use YapBoard',
          p: [
            'To use YapBoard you must:',
            {
              ul: [
                <>be at least {LEGAL.minAge}, or the minimum age to use Yapin’ where you live, whichever is higher;</>,
                'be at least 18 to view listings marked 18+, or to list a server marked 18+;',
                'not have been banned from YapBoard before, unless we’ve lifted the ban; and',
                'not be barred from using services like this under the law that applies to you.',
              ],
            },
          ],
        },
        {
          id: 'accounts',
          h: 'Your account',
          p: [
            'You log in with your Yapin’ account. You’re responsible for everything done through it on YapBoard, so keep your Yapin’ account secure. If you think someone else has got into it, secure it on Yapin’ and tell us.',
            'One person, one account. Don’t share accounts, and don’t use extra accounts to get around a ban, a cooldown, a limit or a moderation decision. We can refuse or end access for any account that breaks these terms.',
          ],
        },
        {
          id: 'listings',
          h: 'Listing a server',
          p: [
            'You can only list a server you own, or where you have a role with Manage Server. We check this through the YapBoard bot. If you stop running the server, delete the listing or tell us.',
            'You’re responsible for your listing and for the server it points to. That includes keeping the listing accurate and up to date, keeping the invite working, and running the server in line with Yapin’s rules and the law.',
            'Nobody has a right to be listed, to a particular position in search or sorting, or to a badge. We decide how listings are ranked and shown, and we can change that at any time. Bumping moves a server to the top of the recently bumped sort. It doesn’t guarantee views, joins or members.',
            'Badges are given at our discretion and can be removed at any time. A badge, or a listing itself, is not a promise that a server is safe, and it doesn’t mean we endorse it.',
          ],
        },
        {
          id: 'content',
          h: 'Your content',
          p: [
            '“Your content” means anything you give us: listing names, summaries, descriptions, tags, images, accent colours, reports and messages to staff, including server details our bot fetches from Yapin’ for your listing.',
            'You keep ownership of your content. You give us a worldwide, non-exclusive, royalty-free licence to host, store, copy, resize, format, display and distribute it, for as long as it’s on YapBoard, so we can run, show and promote YapBoard (for example, featuring a listing on the home page or in an announcement). The licence ends when you delete the content, except for copies in backups that are cleared on their normal cycle, and copies we keep for moderation or legal reasons as described in the privacy policy.',
            'You promise that:',
            {
              ul: [
                'you have every right needed to give us your content and this licence;',
                'your content doesn’t infringe anyone’s copyright, trademark, privacy or other rights; and',
                'your content is lawful and follows the listing guidelines.',
              ],
            },
          ],
        },
        {
          id: 'conduct',
          h: 'Things you must not do',
          p: [
            'When using YapBoard, you must not:',
            {
              ul: [
                'break the law, Yapin’s rules or the listing guidelines;',
                'manipulate bumps, views, join clicks, search results or rankings, for example with bots, scripts, macros, self-bots, alt accounts or paid traffic;',
                'buy, sell or trade bumps, listings, badges or YapBoard accounts;',
                'scrape, crawl or bulk-download YapBoard, except search engines that follow our robots.txt, or through an API we publish for that purpose;',
                'probe, scan or test the security of YapBoard without our written permission, or attack, overload or interfere with it;',
                'get around rate limits, cooldowns, bans, 18+ settings or any access control;',
                'access the staff portal, or another person’s account or listing, without permission;',
                'impersonate YapBoard, our staff, Yapin’ or anyone else;',
                'use YapBoard to send spam or unsolicited advertising;',
                'use anything on YapBoard to harass, track or build profiles of people; or',
                'send false, abusive or bad-faith reports, or mass-report a server.',
              ],
            },
          ],
        },
        {
          id: 'moderation',
          h: 'Moderation and enforcement',
          p: [
            'We don’t have to monitor YapBoard, but we can review any listing or account at any time. If we believe something breaks these terms or the guidelines, puts people at risk, or exposes us or others to legal liability, we can:',
            {
              ul: [
                'hide a listing, including while we look into a report;',
                'remove a listing, and stop that server from being listed again;',
                'remove a badge;',
                'ban an account from YapBoard, and any other account the same person uses; and',
                'report what we find to Yapin’ or to law enforcement, where we think that’s needed or the law requires it.',
              ],
            },
            'We try to be fair and consistent. We usually leave a note explaining a decision, but we don’t have to give reasons where that could put someone at risk, help people abuse YapBoard, or break the law. We can act without warning for serious harm, such as scams, malware, threats or anything involving the exploitation of children.',
            <>
              If you think we got it wrong, see <A href="/guidelines#appeals">appeals</A> in the listing guidelines. A ban applies to you as a person: new accounts made to get around it will be banned too.
            </>,
          ],
        },
        {
          id: 'bot',
          h: 'The YapBoard bot',
          p: [
            'When you add the bot to a server, it uses the access you give it to run its commands, read basic server details (name, icon, banner, owner and member count) and check who can manage the server. It doesn’t read messages.',
            'You can remove the bot at any time. Your listing will stay up, but bumping from the server and ownership checks need the bot, so some features will stop working until it’s back. We may change, limit or remove commands at any time.',
          ],
        },
        {
          id: 'copyright',
          h: 'Copyright and trademark complaints',
          p: [
            <>If you think something on YapBoard infringes your copyright or trademark, email {mail} with:</>,
            {
              ul: [
                'what work or mark you own;',
                'a link to the listing and the part you object to;',
                'your name and how to contact you;',
                'a statement that you believe in good faith the use isn’t authorised by you, your agent or the law; and',
                'a statement that your notice is accurate and that you own the rights, or are allowed to act for whoever does.',
              ],
            },
            'We may remove or hide the material and pass your notice to the person who listed it, who can reply to us. We ban accounts that repeatedly infringe other people’s rights.',
          ],
        },
        {
          id: 'ours',
          h: 'What belongs to us',
          p: [
            'The YapBoard name, logo and brand belong to us. You may not use them in a way that suggests we endorse you or that you are YapBoard.',
            'YapBoard’s source code is published under the Apache License 2.0, and that licence governs your use of the code. These terms govern your use of the YapBoard service we run. The Apache licence doesn’t grant any right to the YapBoard name or logo.',
            'Yapin’ and related names and marks belong to their owners. Server names, icons and descriptions belong to whoever listed them.',
            'If you send us ideas or feedback, we can use them freely, without paying you or owing you anything.',
          ],
        },
        {
          id: 'third-parties',
          h: 'Yapin’ and listed servers',
          p: [
            'YapBoard links to servers on Yapin’. We don’t run those servers, can’t see inside them, and aren’t responsible for what happens in them, including what people say, share or sell there. Joining a server is between you, that server and Yapin’, under Yapin’s terms. Be careful with links, downloads and requests for money or personal details.',
            'YapBoard depends on Yapin’. If Yapin’ changes, limits or stops its login or bot API, parts of YapBoard may stop working, and we aren’t responsible for that.',
          ],
        },
        {
          id: 'availability',
          h: 'Changes to YapBoard',
          p: [
            'YapBoard is free. We can add, change, suspend or remove any part of it, or shut it down, at any time. If we plan to shut YapBoard down, we’ll try to give notice on the site first.',
            'We don’t promise that YapBoard will always be available, fast or error-free. Keep your own copy of anything you write for your listing.',
          ],
        },
        {
          id: 'disclaimers',
          h: 'Disclaimers',
          p: [
            'YapBoard is provided “as is” and “as available”. As far as the law allows, we make no promises or warranties about it, whether express or implied, including that it’s fit for a particular purpose, or that listings, member counts, badges, stats or search results are accurate, complete or current. We don’t vet servers beyond what the listing guidelines describe.',
            'Nothing in these terms affects your legal rights as a consumer that can’t be changed by agreement.',
          ],
        },
        {
          id: 'liability',
          h: 'Our liability to you',
          p: [
            'Nothing in these terms limits or excludes our liability for death or personal injury caused by our negligence, for fraud or fraudulent misrepresentation, or for anything else the law doesn’t allow us to limit or exclude.',
            'Subject to that:',
            {
              ul: [
                'we’re only responsible for loss you suffer that was a foreseeable result of us breaking these terms or failing to use reasonable care and skill. We aren’t responsible for loss that wasn’t foreseeable;',
                'YapBoard is for personal and community use. We aren’t liable for business losses, such as lost profit, revenue, members, growth, opportunity, goodwill or data;',
                'we aren’t liable for what happens in servers listed on YapBoard or on Yapin’, for content other people post, or for events outside our reasonable control; and',
                'because YapBoard is free, our total liability to you for all claims connected with YapBoard is limited to £50.',
              ],
            },
          ],
        },
        {
          id: 'indemnity',
          h: 'Claims caused by you',
          p: [
            'As far as the law allows, you agree to cover our reasonable losses, costs (including legal fees) and liabilities arising from a claim by someone else about your content, your server, or your breach of these terms or the law. If you’re a consumer, this only applies to the extent consumer law permits it.',
          ],
        },
        {
          id: 'ending',
          h: 'Ending this agreement',
          p: [
            <>
              You can stop using YapBoard at any time. Delete your listings, remove the bot from your servers, revoke YapBoard in Yapin’ under Settings → Authorized Apps, and if you want your data gone, ask us to delete your account as the <A href="/privacy#rights">privacy policy</A> explains.
            </>,
            'We can suspend or end your access at any time if you break these terms, if we must for legal reasons, if your use puts others at risk, or if we shut YapBoard down.',
            'When this agreement ends, your right to use YapBoard ends with it. The parts of these terms that are meant to last, including the content licence for backups and retained records, disclaimers, liability, claims caused by you, and legal terms, keep applying.',
          ],
        },
        {
          id: 'changes',
          h: 'Changes to these terms',
          p: [
            'We may update these terms. The date at the top shows when they last changed. For significant changes, we’ll give notice on YapBoard at least 14 days before they take effect, unless we need to change them sooner for legal or safety reasons. If you keep using YapBoard after a change takes effect, you accept the new terms. If you don’t, stop using YapBoard and delete your listings.',
          ],
        },
        {
          id: 'legal',
          h: 'Legal terms',
          p: [
            {
              ul: [
                <>
                  <b className="text-ink">Governing law.</b> These terms are governed by the law of {LEGAL.law}, and its courts can hear any dispute about them. If you live in Scotland or Northern Ireland you can also bring a claim in your local courts. If you’re a consumer living elsewhere, you keep the protection of any mandatory laws where you live.
                </>,
                <>
                  <b className="text-ink">Whole agreement.</b> These terms, the listing guidelines and the privacy policy are the whole agreement between you and us about YapBoard.
                </>,
                <>
                  <b className="text-ink">Severability.</b> If a court finds part of these terms can’t be enforced, the rest still applies.
                </>,
                <>
                  <b className="text-ink">No waiver.</b> If we don’t enforce a term straight away, we can still enforce it later.
                </>,
                <>
                  <b className="text-ink">Transfer.</b> We may transfer this agreement to whoever takes over running YapBoard, and we’ll tell you if we do. You may not transfer it without our written consent.
                </>,
                <>
                  <b className="text-ink">Third parties.</b> Only you and we can enforce these terms. No one else has rights under them.
                </>,
              ],
            },
          ],
        },
        {
          id: 'contact',
          h: 'Contact',
          p: [<>Questions about these terms? Email {mail}.</>],
        },
      ]}
    />
  );
}
