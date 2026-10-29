// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import type { Metadata } from 'next';
import { ProseLink as A, ProsePage } from '@/components/Prose';
import { env } from '@/lib/env';
import { LEGAL } from '@/lib/legal';
import { platformBase, RATE, requirePlatformUser, SCOPE_ORDER } from '@/lib/platform';

export const metadata: Metadata = { title: 'Platform terms' };

const mail = <A href={`mailto:${LEGAL.email}`}>{LEGAL.email}</A>;

/**
 * The agreement behind a membership, written as terms rather than as house rules: redeeming an invite is
 * what accepts them, so they say who they bind, what the licence covers, what ends it and what survives.
 *
 * Same furniture as the site's own Terms and Privacy pages (src/components/Prose.tsx), so a member reading
 * this and a visitor reading /terms are reading the same kind of document.
 *
 * Placeholder copy: have someone qualified review before launch.
 */
export default async function PlatformTerms() {
  const { user, member } = await requirePlatformUser('/program');
  // The docs are '/docs' on platform.yapboard.dev and '/platform/docs' on the main domain.
  const base = await platformBase();

  return (
    <ProsePage
      title="Platform terms"
      updated={LEGAL.platformUpdated}
      intro={
        <>
          These terms are the agreement between you and {LEGAL.operator} for the YapBoard developer platform — the invite-only programme that lets
          your own Yapin’ bot call YapBoard’s API (“the platform”). They sit on top of our{' '}
          <A href={`${env.siteUrl}/terms`}>site terms</A>, which still apply to your account. Redeeming an invite accepts
          these terms. If you don’t accept them, don’t redeem it, and don’t call the API.
        </>
      }
      summary={[
        'Membership is a revocable licence, not a right. We grant it by invitation and can withdraw it.',
        'One app per bot, and the bots must be yours. Your keys are yours to keep secret — every call made with them counts as yours.',
        'A bump must be something a person asked for. Automatic, scheduled or incentivised bumping ends a membership.',
        'The API is for showing YapBoard inside your bot. Not for copying the boards, reselling access, or running something like YapBoard.',
        'Say where listings come from, and link to them.',
        'No uptime promise, no warranty, and the API can change. We’ll tell you about breaking changes where we can.',
      ]}
      sections={[
        {
          id: 'parties',
          h: 'Who these terms are between',
          p: [
            <>
              The platform is run by {LEGAL.operator} (“we”, “us”). “You” is the account that redeemed the invite, and any person or organisation you
              are acting for. If you joined on behalf of a team, a company or a bot run by several people, you confirm you may accept these terms for
              them, and “you” includes them.
            </>,
            'YapBoard is an independent project. It isn’t owned, operated, sponsored or endorsed by Yapin’, and nothing here makes you our partner, agent or employee, or gives you authority to speak for us.',
            <>You can reach us at {mail}.</>,
          ],
        },
        {
          id: 'acceptance',
          h: 'Accepting these terms',
          p: [
            'You accept these terms by redeeming a platform invite. You accept them again, as they stand at the time, each time you or your software calls the API.',
            'We record when you joined and which staff member invited you. That record, and the invite itself, is how we evidence this agreement.',
            member ? (
              <>
                You accepted these terms on{' '}
                <b className="text-ink">
                  {member.joinedAt.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                </b>
                {member.invite?.invitedBy.username ? <> as @{user.username}, on an invite from @{member.invite.invitedBy.username}</> : <> as @{user.username}</>}.
              </>
            ) : (
              <>You’re reading these as @{user.username}, who isn’t in the programme — so nothing here binds you yet. Redeeming an invite is what does.</>
            ),
          ],
        },
        {
          id: 'membership',
          h: 'What membership is',
          p: [
            'Membership is a personal, non-exclusive, non-transferable, revocable licence to call the YapBoard API from bots you have registered, for as long as we allow it. It is not a sale, a partnership, or a promise of continued access.',
            'You can’t transfer, lend, sublicence or sell your membership, your apps or your keys, and you can’t let another developer’s software call the API with them. If someone else wants access, they can be invited themselves.',
            'Nothing about membership gives you a position on any board, a badge, a listing, placement in search, or any say in how listings are ranked or moderated.',
            'We decide who is invited, what scopes they hold and how many apps they may register, and we can change any of those at any time.',
          ],
        },
        {
          id: 'eligibility',
          h: 'Who can be a member',
          p: [
            'To hold a membership you must:',
            {
              ul: [
                <>meet the eligibility rules in our <A href={`${env.siteUrl}/terms`}>site terms</A>, including the minimum age of {LEGAL.minAge};</>,
                'have a YapBoard account in good standing, and not be banned here or evading a ban;',
                'actually run the bots you register, and be allowed to make them call our API; and',
                'keep your Yapin’ account secure, since that account is how you sign in.',
              ],
            },
            'If your YapBoard account is banned, your membership ends with it and every key stops working.',
          ],
        },
        {
          id: 'apps',
          h: 'Your apps and your keys',
          p: [
            'An app is one bot, registered against that bot’s Yapin’ bot ID. One bot, one app, across the whole programme. Register the bot you actually run, and keep the contact details on it current — it’s where we reach you before we switch anything off.',
            'Keys are secrets. Keep them on your own server. Don’t commit them to a repository, ship them in a client, put them in a configuration people can read, or share them with anyone, including other members.',
            'Every call made with your key is treated as yours, whoever made it. If a key leaks or you suspect it has, revoke it on the app’s page and mint a replacement. Tell us if listings were affected.',
            'We only ever store a hash of a key, so we can’t recover one for you. Rotation means minting the new key first, then revoking the old one.',
          ],
        },
        {
          id: 'scopes',
          h: 'Scopes, limits and how you may call the API',
          p: [
            <>
              An app may only call what its scopes allow — currently {SCOPE_ORDER.join(', ')} — and only up to the published rate limits, presently{' '}
              {RATE.perMinute} requests a minute per app, of which {RATE.bumpPerMinute} may be bumps. See the{' '}
              <A href={`${base}/docs`}>reference</A> for what each scope covers.
            </>,
            'Don’t work around a scope, a limit, a cooldown or a refusal: no second key to double a quota, no second app for one bot, no retrying a refusal in a loop, no sending calls through anything that disguises where they came from.',
            'Treat a refusal as an answer. A turned-down bump tells you when it can happen again; show that to the person instead of trying again.',
            <>
              The <A href={`${base}/requirements`}>integration requirements</A> set out what your bot has to do with each of these answers.
              They form part of these terms, and we keep them short enough to read in one sitting.
            </>,
            'Cache what you read if you like, but keep it current and don’t build a copy of the boards out of it (see below).',
          ],
        },
        {
          id: 'bumps',
          h: 'Bumping',
          p: [
            'A bump has to be something a person asked for, in the moment, for a listing they chose. Send us the account that asked, never your bot’s own account.',
            'You must not bump on a timer, on a schedule, on joining a server, as a side effect of some other command, or in bulk. You must not reward, pay, require or pressure anyone to bump — no bump-for-roles, no bump-to-unlock, no bump channels your bot drives on people’s behalf.',
            'Where a bump may come from is limited too: anyone in a server may bump that server, but a bot or a client may only be bumped from a server it belongs to - its support server, or a server its lister owns. One server must not be used to bump a shelf of listings that have nothing to do with it.',
            'You must report the server a command was typed in honestly. We can’t verify it from outside Yapin’, so we rely on you: sending a server the command didn’t come from, to get past the rule above, is a breach of these terms and we treat it as seriously as bumping nobody asked for.',
            'Where a bump lands in a server that isn’t listed, you must show the add link we hand back with the refusal, as an invitation to list it. Swallowing that moment takes the useful half of the API and gives nothing back to the board you read from, so it is a requirement of membership rather than a suggestion.',
            'This clause is the one we enforce first and discuss afterwards, because a bump moves a real listing on a real board and the person it belongs to can’t undo it.',
          ],
        },
        {
          id: 'permitted',
          h: 'What the API is for',
          p: [
            'The licence covers showing YapBoard inside your bot: letting your users bump a listing, look one up, and search the boards from chat.',
            'It does not cover:',
            {
              ul: [
                'storing, indexing or republishing listings as your own directory, dataset, website, feed, API or export;',
                'selling, reselling or charging for access to our data or our API, or putting it behind your own paid tier;',
                'building or operating a service that competes with YapBoard, or helping someone else do so;',
                'training machine-learning models on what the API returns;',
                'using the API to collect, enrich or profile people, or for advertising or marketing to them; or',
                'anything the law, Yapin’s terms, or our site terms and listing guidelines don’t allow.',
              ],
            },
          ],
        },
        {
          id: 'attribution',
          h: 'Attribution and presentation',
          p: [
            'Where you show a listing, say it came from YapBoard and link to it, so people can reach the listing you’re quoting.',
            'Don’t present YapBoard’s data as your own, and don’t imply we endorse, verify or are affiliated with your bot beyond your membership. You may say your bot “uses the YapBoard API” or is “a YapBoard platform member”. You may not use our name or logo as your own branding, in your bot’s name, or in a way that suggests we run it.',
            'Badges, verification and rankings are ours. Don’t invent them, re-label them, or offer them.',
          ],
        },
        {
          id: 'users',
          h: 'The people using your bot',
          p: [
            'Your users are yours. You are responsible for your bot, what it does on our behalf, what it tells people, and for having your own terms and privacy notice where you need them.',
            'Send us only what a call needs: the account that asked, and the IDs the endpoint asks for. Don’t send us anything else about them, and don’t keep what you receive from us for longer than your bot needs it.',
            <>
              What we do with it is in our <A href={`${env.siteUrl}/privacy`}>privacy notice</A>. We record per-app call
              counts and the account credited with a bump; we don’t log request bodies.
            </>,
            'Tell us promptly if you become aware of a security problem, a leak, or someone misusing your bot to affect listings.',
          ],
        },
        {
          id: 'enforcement',
          h: 'Suspension and withdrawal',
          p: [
            'If something looks wrong we’ll usually message you first, at the contact on your app. Something actively harming listings — bumping that nobody asked for, above all — is suspended first and discussed afterwards.',
            'We may suspend an app, suspend your membership, narrow your scopes, lower your limits or withdraw your membership entirely: for breach of these terms, at the request of a listing’s owner where you’ve affected it, to protect the boards or other people, to comply with the law, or where we reasonably believe we need to.',
            'A suspension refuses your keys and keeps everything else. Nothing is deleted: apps are retired and keys revoked, so a call arriving with one reads as revoked rather than unknown. A fixed integration gets switched back on.',
            'We may reverse bumps and other effects of calls that broke these terms.',
            <>If you think we’ve got it wrong, write to {mail} and we’ll look again.</>,
          ],
        },
        {
          id: 'changes',
          h: 'Changes to the API and to these terms',
          p: [
            'The platform is young and the API will change. We may add, change, deprecate or remove endpoints, scopes, fields, limits and behaviour. Where a change would break working integrations we’ll give notice to the contact on your app where that’s practical, but we can act immediately where security, abuse or the law requires it.',
            'There is no service level, no uptime commitment and no support commitment. Maintenance, outages and breaking changes can happen without warning.',
            'We may change these terms. If a change matters, we’ll tell members through the contact on their app and update the date at the top. Calling the API after a change accepts the new version; if you don’t accept it, retire your apps and stop calling.',
          ],
        },
        {
          id: 'ip',
          h: 'Our rights, and yours',
          p: [
            'YapBoard — the service, the API, this platform, the documentation, the name, the logo and the design — is ours and stays ours. These terms grant a licence to call the API, and nothing else: no ownership, no rights in our code or data, and no right to copy, decompile, resell or recreate any of it.',
            'Your bot is yours. We claim nothing in it by your being a member.',
            'Listings belong to the people who wrote them. Showing one through your bot doesn’t give you any rights in it, and you must honour a removal: if a listing stops being public, stop showing it.',
          ],
        },
        {
          id: 'liability',
          h: 'No warranty, and limits on liability',
          p: [
            'The platform and the API are provided as they are, and as available, with no warranties of any kind — including that they will be uninterrupted, accurate, complete, secure, or fit for what you’re building.',
            'We’re not liable for anything you build, for your users, for your reliance on data from the API, for lost bumps, lost placement, lost users or lost revenue, or for any indirect or consequential loss. Nothing here limits liability that can’t be limited by law, such as for death or personal injury caused by negligence, or for fraud.',
            'As far as the law allows, our total liability to you arising out of the platform is limited to £100. The platform is free; this reflects that.',
            'You’ll cover us for claims brought against us because of your bot, your use of the API, or your breach of these terms.',
          ],
        },
        {
          id: 'ending',
          h: 'Ending your membership',
          p: [
            'You can leave at any time: retire your apps, which revokes their keys, and stop calling. Ask us if you want the membership itself removed.',
            'We can end your membership as set out above. Either way, your right to call the API stops immediately, and you must stop using anything you got through it, delete cached listing data, and remove our name from your bot where it implies membership.',
            'What survives the end of this agreement: the clauses on our rights and yours, no warranty and limits on liability, what the API is for, and anything else that by its nature should.',
            'Listings, bumps and audit records created while you were a member stay as they are — they’re other people’s history now, not yours to withdraw.',
          ],
        },
        {
          id: 'law',
          h: 'Law, and the rest',
          p: [
            <>These terms are governed by the law of {LEGAL.law}, and its courts have exclusive jurisdiction. If you’re a consumer, you keep any rights you have under the law where you live.</>,
            'If any part of these terms can’t be enforced, the rest still stands. Not enforcing something straight away doesn’t mean we’ve given it up. You can’t transfer this agreement; we may transfer it as part of transferring YapBoard.',
            <>
              These terms, your invite, the <A href={`${base}/docs`}>reference</A> and the{' '}
              <A href={`${base}/requirements`}>integration requirements</A> they point to, and our site terms, listing guidelines and privacy notice
              are the whole agreement about the platform between us.
            </>,
            <>Questions, or something you’re unsure is allowed? Ask first: {mail}.</>,
          ],
        },
      ]}
    />
  );
}
