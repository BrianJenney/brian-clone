import { cookies } from 'next/headers';
import { createHash } from 'crypto';

const AUTH_PASSWORD = process.env.AUTH_PASSWORD || '';
const AUTH_SECRET = process.env.AUTH_SECRET || 'default-secret-change-me';

function hashPassword(password: string): string {
	return createHash('sha256').update(password).digest('hex');
}

function createSessionToken(): string {
	const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
	const payload = `authenticated:${expiry}`;
	const signature = createHash('sha256')
		.update(payload + AUTH_SECRET)
		.digest('hex');
	return `${payload}:${signature}`;
}

export async function POST(req: Request) {
	try {
		const { password } = await req.json();

		if (!AUTH_PASSWORD) {
			return Response.json(
				{ error: 'Auth not configured' },
				{ status: 500 }
			);
		}

		// Compare hashed passwords
		const hashedInput = hashPassword(password);
		const hashedStored = hashPassword(AUTH_PASSWORD);

		if (hashedInput !== hashedStored) {
			return Response.json({ error: 'Invalid password' }, { status: 401 });
		}

		// Create session token and set cookie
		const token = createSessionToken();
		const cookieStore = await cookies();

		cookieStore.set('auth_session', token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 7 * 24 * 60 * 60, // 7 days
			path: '/',
		});

		return Response.json({ success: true });
	} catch (error) {
		console.error('Login error:', error);
		return Response.json({ error: 'Login failed' }, { status: 500 });
	}
}
