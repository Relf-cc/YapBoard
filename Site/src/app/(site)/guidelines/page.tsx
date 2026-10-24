import type { Metadata } from 'next';
import { ProsePage } from '@/components/Prose';

export const metadata: Metadata = { title: 'Listing guidelines' };

export default function Guidelines() {
  return (
    <ProsePage
      title="Listing guidelines"
      sections={[
        { h: 'Be what you say you are', p: ['Your name, one-liner, description and tags should describe the server people will land in. No bait-and-switch, no stuffing tags you don’t use.'] },
        { h: 'Mark adult content', p: ['If your server has any sexual or graphic content, turn on 18+. It keeps you out of default search, and that’s the point. Unmarked adult servers get hidden.'] },
        { h: 'Nothing illegal or harmful', p: ['No scams, phishing, malware, piracy hubs, doxxing, hate groups, or anything that puts people at risk. These are removed without warning, and the account that listed them can be banned.'] },
        { h: 'One listing per server', p: ['Only people who run the server can list it. If someone listed yours without asking, use “Request removal” on its page and we’ll sort it out.'] },
        { h: 'Bumping', p: ['Bump with /bump in your server, once every 2 hours. Bots, scripts or alt accounts that bump for you count as manipulation and get the listing hidden.'] },
        { h: 'What staff can do', p: ['Staff review reports and can hide a listing while they look into it, remove it, or ban an account from YapBoard. If you think we got it wrong, reply through a removal request on the listing.'] },
      ]}
    />
  );
}
