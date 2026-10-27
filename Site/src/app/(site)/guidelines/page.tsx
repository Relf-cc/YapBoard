// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { Metadata } from 'next';
import { ProseLink as A, ProsePage } from '@/components/Prose';
import { BadgeMark } from '@/components/Badge';
import { BADGES, BADGE_ORDER } from '@/lib/badges';
import { LEGAL } from '@/lib/legal';
import { MAX_TAGS } from '@/lib/tags';

export const metadata: Metadata = { title: 'Listing guidelines' };

const mail = <A href={`mailto:${LEGAL.email}`}>{LEGAL.email}</A>;

export default function Guidelines() {
  return (
    <ProsePage
      title="Listing guidelines"
      updated={LEGAL.updated}
      intro={
        <>
          These rules apply to every listing and everyone who uses YapBoard. They’re part of our <A href="/terms">terms</A>. Staff apply them with judgement: we go by what a rule is for, so finding a loophole doesn’t make something allowed.
        </>
      }
      summary={[
        'Only list servers you run, and describe them honestly.',
        'Turn on 18+ for any adult content. Keep the listing itself clean either way.',
        'Some things are never allowed: anything sexualising minors, scams, malware, hate, threats, doxxing and illegal trade.',
        'Bump by hand with /bump, once every 2 hours. No bots, alts or paid bumps.',
        'Report honestly. If you think we got a decision wrong, you can appeal once.',
      ]}
      sections={[
        {
          id: 'honest',
          h: 'Be what you say you are',
          p: [
            'People should land in the server your listing describes.',
            {
              ul: [
                'The name should be the server’s name. The one-liner and description should describe what the server is actually like now.',
                <>Only use tags that really apply, up to {MAX_TAGS}. No stuffing tags or keywords to show up in more searches.</>,
                'Set the language to the one most members use.',
                'The invite must lead to the listed server and keep working. Listings with dead invites are removed.',
                'Don’t claim to be official, partnered or verified unless you have the badge. Don’t fake a badge with emoji or images.',
                'Don’t use another server’s, creator’s or brand’s name or look to borrow its traffic.',
                'Don’t promise giveaways, rewards or perks you won’t deliver.',
              ],
            },
          ],
        },
        {
          id: 'listing-content',
          h: 'Keep the listing itself clean',
          p: [
            'Your name, one-liner, description, tags, icon and banner are shown to everyone browsing. Even if your server is marked 18+, the listing must not contain:',
            {
              ul: [
                'sexually explicit or graphic images or descriptions. Say what the server is about without showing it;',
                'slurs, shock content or anything meant to upset people;',
                'personal information about anyone;',
                'links or invites to other servers or sites that aren’t about this server; or',
                'walls of keywords, repeated text or formatting tricks meant to game search.',
              ],
            },
          ],
        },
        {
          id: 'adult',
          h: 'Mark adult content',
          p: [
            'Turn on 18+ if your server has any sexual content, graphic violence or gore, or is centred on adult themes, even if it’s only in some channels. If you’re not sure, turn it on. 18+ listings stay out of default search, which is the point.',
            'Adult servers must keep minors out, following Yapin’s rules. Unmarked adult servers are hidden until they’re marked.',
            'Never allowed, marked or not: sexual content involving minors or anyone presented as a minor, intimate images shared without consent, and sexual content of real people made or shared without their consent, including AI-generated or edited images.',
          ],
        },
        {
          id: 'never',
          h: 'Never allowed',
          p: [
            'These servers can’t be listed at all. We remove them without warning, ban the accounts behind them, and report them to Yapin’ or the authorities where appropriate.',
            {
              ul: [
                'Anything that sexualises minors, or adult servers that target or knowingly admit minors.',
                'Terrorism, violent extremism, or praising mass violence.',
                'Hate groups, or servers organised around attacking people for who they are: race, ethnicity, religion, disability, sex, gender identity, sexual orientation or similar.',
                'Organising harassment, raids, brigading, doxxing or swatting, and threats or calls for violence.',
                'Promoting suicide, self-harm or eating disorders. Support and recovery communities are welcome.',
                'Scams and fraud: phishing, fake giveaways, account or token grabbers, malware, and get-rich-quick or investment schemes.',
                'Trading stolen accounts, data or payment cards, or selling hacking services.',
                'Selling illegal drugs, weapons or other goods or services where it’s against the law.',
                'Piracy: cracked software, leaked paid content, and selling or sharing accounts for paid services.',
                'Real-money gambling that isn’t properly licensed, or any gambling aimed at minors.',
                'Impersonating people, brands, Yapin’ or YapBoard.',
                'Servers made to dodge a Yapin’ or YapBoard ban, or that break Yapin’s rules in any other way.',
              ],
            },
          ],
        },
        {
          id: 'who-lists',
          h: 'Who can list a server',
          p: [
            'Only the owner, or someone with a role that has Manage Server, can list a server, and the YapBoard bot has to be in it. Each server can only be listed once.',
            'If someone listed your server without asking, or the server has changed hands, use “Request removal” on its page and we’ll sort it out. Don’t list a server you’ve been removed from, or one you got control of without the owner’s say.',
          ],
        },
        {
          id: 'bumping',
          h: 'Bumping',
          p: [
            'Anyone in the server can bump it with /bump, once every 2 hours. A bump has to be a real person choosing to bump.',
            {
              ul: [
                'Reminding members to bump is fine.',
                'Self-bots, scripts, macros, auto-clickers and modified clients that bump for you are not.',
                'Bumping from alt accounts is not.',
                'Paying for bumps, or trading bumps with other servers, is not.',
                'Inflating views or join clicks with scripts, refresh loops, bots or paid traffic is not.',
              ],
            },
            'Bump manipulation gets the listing hidden and can get the accounts involved banned.',
          ],
        },
        {
          id: 'badges',
          h: 'Badges',
          p: [
            'Badges are the little seals beside a server’s name. YapBoard staff hand them out, a server can hold more than one, and they can’t be bought, traded or transferred. We take them away if a server changes hands or stops qualifying.',
            <span key="list" className="block space-y-2.5">
              {BADGE_ORDER.map((k) => (
                <span key={k} className="flex items-start gap-2.5">
                  <BadgeMark kind={k} size={17} seed={k} className="mt-[3px]" />
                  <span>
                    <b className="font-semibold text-ink">{BADGES[k].long}</b> — {BADGES[k].blurb}
                  </span>
                </span>
              ))}
            </span>,
            'A badge means we checked one thing about a server. It doesn’t mean we vouch for what happens inside. Don’t imply you have one you haven’t been given.',
          ],
        },
        {
          id: 'reports',
          h: 'Reporting',
          p: [
            'If a listing breaks these rules, use Report on its page. Pick the reason that fits best and tell us what you saw. Specifics help us act faster.',
            'False reports, reports made to hurt a rival server, and organised mass reporting count as misusing YapBoard and can get you banned.',
            'If someone is in immediate danger, contact your local emergency services. For content inside a server, also report it to Yapin’, since we can only act on listings.',
          ],
        },
        {
          id: 'enforcement',
          h: 'How we enforce these rules',
          p: [
            'Staff review every report. We look at the listing, and where it matters, at the server it links to and how its owners behave. What happens in a server counts.',
            {
              ul: [
                'We can hide a listing while we look into it, or until something is fixed. The owner sees a note explaining why.',
                'We can remove a listing. A removed server can’t be listed again.',
                'We can take away a badge.',
                'We can ban an account from YapBoard, along with any other accounts the same person uses.',
              ],
            },
            'For serious harm (anything involving minors, scams, malware, threats or doxxing) we act straight away, without warning. Repeated problems or ban evasion lead to permanent bans. Every staff action is logged.',
          ],
        },
        {
          id: 'appeals',
          h: 'Appeals',
          p: [
            <>
              If you think we made a mistake, use “Request removal” on the listing and choose “Something else”, or email {mail}. Include a link to the listing and explain why you think the decision was wrong.
            </>,
            'You get one appeal per decision. Where we can, someone other than the staff member who made the decision will review it. The result of the appeal is final. Don’t relist the server or make new accounts while you wait, or the appeal will be refused.',
          ],
        },
        {
          id: 'changes',
          h: 'Changes to these guidelines',
          p: [
            'We update these guidelines as YapBoard grows. The date at the top shows the last change. Every listing has to follow the current version, including listings made before a change.',
          ],
        },
      ]}
    />
  );
}
