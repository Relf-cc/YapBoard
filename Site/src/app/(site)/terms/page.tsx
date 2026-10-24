import type { Metadata } from 'next';
import { ProsePage } from '@/components/Prose';

export const metadata: Metadata = { title: 'Terms' };

// Placeholder copy: have someone qualified review before launch.
export default function Terms() {
  return (
    <ProsePage
      title="Terms"
      sections={[
        { h: 'Using YapBoard', p: ['YapBoard is a directory of Yapin’ servers. By using it you agree to follow the listing guidelines and Yapin’s own rules.'] },
        { h: 'Your listings', p: ['You keep ownership of what you write. You give YapBoard permission to show it on the site. You’re responsible for what your listing says and for the server it links to.'] },
        { h: 'Moderation', p: ['We can hide or remove any listing, and suspend any account, if we believe it breaks the guidelines.'] },
        { h: 'No warranty', p: ['YapBoard is provided as is. We don’t run the servers listed here and aren’t responsible for what happens in them.'] },
      ]}
    />
  );
}
