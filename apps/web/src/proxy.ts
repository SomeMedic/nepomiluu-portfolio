import { NextResponse, type NextRequest } from 'next/server';
import { documentLanguage, documentLanguageHeader } from './app/document-language';

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  // Always replace caller-provided values with the language of the routed URL.
  requestHeaders.set(documentLanguageHeader, documentLanguage(request.nextUrl.pathname));
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/', '/ru/:path*', '/en/:path*', '/admin/:path*'],
};
