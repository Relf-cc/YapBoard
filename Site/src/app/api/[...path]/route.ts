import { fail } from '@/lib/http';

/** Unknown API paths answer in JSON, not with the site's HTML 404 page. Real routes take priority over this. */
const notFound = () => fail('Not found', 404);
export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
