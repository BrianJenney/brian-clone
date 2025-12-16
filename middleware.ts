import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_SECRET = process.env.AUTH_SECRET || 'default-secret-change-me';

async function hashString(str: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(str);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifySessionToken(token: string): Promise<boolean> {
	try {
		const parts = token.split(':');
		if (parts.length !== 3) return false;

		const [status, expiryStr, signature] = parts;
		const expiry = parseInt(expiryStr, 10);

		// Check expiry
		if (Date.now() > expiry) return false;

		// Verify signature
		const payload = `${status}:${expiryStr}`;
		const expectedSignature = await hashString(payload + AUTH_SECRET);

		return signature === expectedSignature;
	} catch {
		return false;
	}
}

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Allow access to login page and auth API routes
	if (
		pathname === '/login' ||
		pathname.startsWith('/api/auth/') ||
		pathname.startsWith('/_next/') ||
		pathname.startsWith('/favicon') ||
		pathname.endsWith('.ico')
	) {
		return NextResponse.next();
	}

	// Check for auth cookie
	const sessionCookie = request.cookies.get('auth_session');

	if (!sessionCookie || !(await verifySessionToken(sessionCookie.value))) {
		// Redirect to login
		const loginUrl = new URL('/login', request.url);
		return NextResponse.redirect(loginUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 */
		'/((?!_next/static|_next/image|favicon.ico).*)',
	],
};
