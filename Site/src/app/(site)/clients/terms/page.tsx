// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { Metadata } from 'next';
import { ProseLink as A, ProsePage } from '@/components/Prose';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Client terms',
  description: 'The rules for listing a Yapin’ client on YapBoard, and what to check before downloading one.',
};

const mail = <A href={`mailto:${LEGAL.email}`}>{LEGAL.email}</A>;
const yapinTerms = <A href={LEGAL.yapinTerms}>Yapin’s terms of service</A>;

// Placeholder copy: have someone qualified review before launch.
export default function ClientTerms() {
  return (
    <ProsePage
      title="Client terms"
      updated={LEGAL.updated}
      intro={
        <>
          A “client” on YapBoard is somebody’s own build of Yapin’ - a modified desktop app, shipped as its own
          program. These terms add to our <A href="/terms">general terms</A> and the{' '}
          <A href="/guidelines">listing guidelines</A>, and they apply both to people who list a client and to people
          who download one. Everyone listing a client accepts them before it’s submitted.
        </>
      }
      summary={[
        'YapBoard lists clients. It doesn’t build, host, review the code or scan them for malware.',
        'Downloads go straight to the maintainer’s own release page - we only count the click.',
        'Staff check every client listing before it goes up, and can take one down at any time.',
        'Listing software that steals tokens, spies on people or hides what it does gets you banned.',
        'A modified client can break Yapin’s rules. Yapin’, not YapBoard, decides what’s allowed on Yapin’.',
        'Downloading and running a client is your decision and your risk.',
      ]}
      sections={[
        {
          id: 'what',
          h: 'What a client listing is',
          p: [
            <>
              A client listing is an advertisement. It tells people a program exists, who makes it, what it changes, and
              where to download it. The download button on a listing sends you to the maintainer’s own release page or
              file host - YapBoard never serves, mirrors or re-hosts the file itself.
            </>,
            <>
              YapBoard is run by {LEGAL.operator} and is not owned, operated, sponsored or endorsed by Yapin’. Listing a
              client here is not approval by Yapin’, and it isn’t approval by us either: it means a staff member looked
              at the listing and didn’t find a reason to refuse it.
            </>,
          ],
        },
        {
          id: 'listing',
          h: 'If you list a client',
          p: [
            'By submitting a client listing you confirm, and keep confirming for as long as it’s listed, that:',
            {
              ul: [
                'the client is yours to list - you make it, or you have the maintainer’s permission;',
                'the listing describes it honestly, including what it changes and what data it touches;',
                'the download links point at the real files, and you’ll keep them pointing there;',
                <>
                  it contains no malware, no remote access, no token, password or credential theft, no cryptomining, and
                  no data collection you haven’t told people about in the listing;
                </>,
                'it doesn’t ship someone else’s code, art or branding without the right to do so;',
                <>it follows {yapinTerms} and Yapin’s API rules - including no automating user accounts, no scraping, and no working around rate limits, moderation or bans;</>,
                'you’ll keep the listing up to date, and take it down if you stop maintaining the client; and',
                'you’re old enough to agree to these terms where you live.',
              ],
            },
            <>
              You also agree that we can read your repository’s public release information to fill in the listing: the
              latest release’s tag, notes, and the names, sizes and URLs of its files. Nothing is ever written back to
              your repository, and we don’t download the files themselves.
            </>,
          ],
        },
        {
          id: 'refuse',
          h: 'What we refuse, and what gets taken down',
          p: [
            'Staff review every client before it goes on the board. We refuse - and remove, at any time, without notice - any listing where:',
            {
              ul: [
                'the client steals credentials or tokens, spies on people, or does anything it doesn’t disclose;',
                'the download goes somewhere other than the listing says, or changes to after approval;',
                'the client exists mainly to break Yapin’s rules - mass DMs, ban evasion, scraping, self-botting;',
                'it pretends to be official, or to be another client, or uses Yapin’s or YapBoard’s branding as its own;',
                'the source is closed and nothing about it can be checked, and the listing makes claims we can’t verify; or',
                'it’s abandoned, broken, or its links are dead.',
              ],
            },
            <>
              Changing where a listing’s downloads come from sends it back for review automatically - staff approved a
              page pointing at one place, not at wherever it’s pointed afterwards.
            </>,
            <>
              Listing software that harms people costs you the listing and the account. We report what needs reporting,
              and we’ll pass what we have to Yapin’ or to the authorities where it’s warranted.
            </>,
          ],
        },
        {
          id: 'safety',
          h: 'If you download a client',
          p: [
            <>
              Read this part even if you skip the rest. A client runs on your computer, signed in to your Yapin’
              account. It can read everything you can read, and a dishonest one can take your account.
            </>,
            'Before you run a client somebody else made:',
            {
              ul: [
                'check who makes it, and whether anyone else has actually used it;',
                'prefer clients whose source you can read, and check the download comes from that same project;',
                'look at where the file is actually hosted - our dialog tells you before you leave;',
                'scan it, and be suspicious of anything that asks for your password or token, or asks you to turn off your antivirus;',
                'keep two-factor on your Yapin’ account, and change your password if you ever run something you shouldn’t have; and',
                <>
                  remember that modified clients can break {yapinTerms}, and that your Yapin’ account is Yapin’s to
                  suspend, not ours to protect.
                </>,
              ],
            },
            <>
              We don’t build, host, review the code of, or scan any client listed here, and we can’t promise a listed
              client is safe. The maintainer is responsible for their software; you’re responsible for what you choose
              to run. If something looks wrong, use the report button on the listing - that reaches staff directly and
              is the fastest way to get a bad client taken down.
            </>,
          ],
        },
        {
          id: 'liability',
          h: 'Liability',
          p: [
            <>
              Clients are third-party software. To the fullest extent the law allows, we aren’t liable for any loss or
              damage caused by a client you found here - including damage to your device, loss of data, or action taken
              against your Yapin’ account. Section limits in our <A href="/terms#liability">general terms</A> apply here too,
              and nothing in these terms limits liability that can’t be limited by law.
            </>,
            <>
              If you list a client, you’re responsible for it, and you agree to cover us for claims brought against us
              because of it.
            </>,
          ],
        },
        {
          id: 'changes',
          h: 'Changes and contact',
          p: [
            'We may update these terms. Substantial changes are announced on the site, and listing or downloading a client after that means you accept the new version.',
            <>Questions, appeals and reports of a dangerous client: {mail}. For anything urgent, report the listing from its page - that reaches staff straight away.</>,
          ],
        },
      ]}
    />
  );
}
