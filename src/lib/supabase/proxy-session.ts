import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Refreshes the Supabase auth cookie on every request and gates /staff. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Don't put code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims?.sub;

  const path = request.nextUrl.pathname;
  if (!signedIn && path.startsWith('/staff')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }
  if (signedIn && path === '/login' && !request.nextUrl.searchParams.has('reason')) {
    const url = request.nextUrl.clone();
    url.pathname = '/staff';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}
