import { cookies } from 'next/headers';

export async function POST() {
	const cookieStore = await cookies();
	cookieStore.delete('auth_session');
	return Response.json({ success: true });
}
