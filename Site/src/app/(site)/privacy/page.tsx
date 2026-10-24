import type { Metadata } from 'next';
import { ProsePage } from '@/components/Prose';

export const metadata: Metadata = { title: 'Privacy' };

// Placeholder copy: have someone qualified review before launch.
export default function Privacy() {
  return (
    <ProsePage
      title="Privacy"
      sections={[
        { h: 'What we get from Yapin’', p: ['When you log in, Yapin’ shares your user ID, username, display name and avatar. That’s all the identify scope allows. We never see your email or messages.'] },
        { h: 'What we store', p: ['Your profile, the listings you create, bumps you make, and reports you send. Page views and join clicks are counted per server, not per person.'] },
        { h: 'Cookies', p: ['One cookie keeps you logged in. No ad or tracking cookies.'] },
        { h: 'Deleting your data', p: ['Delete a listing from its manage page. To remove your account entirely, revoke YapBoard in Yapin’ Settings → Authorized Apps and send us a removal request.'] },
      ]}
    />
  );
}
