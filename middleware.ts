import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // console.log('request', request);
  // 如果已经在密钥页面，则不需要检查
  if (request.nextUrl.pathname === '/secret') {
    return NextResponse.next()
  }

  const hasSecretKey = request.cookies.has('secret_key')
    // console.log('hasSecretKey', hasSecretKey);
  // 如果没有密钥，重定向到密钥输入页面
  if (!hasSecretKey) {
    // 保存当前路径到 URL 参数中
    const url = new URL('/secret', request.url)
    url.searchParams.set('from', request.nextUrl.pathname)
    
    const response = NextResponse.redirect(url)
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * /api/*, /_next/static/*, /_next/image/*, /favicon.ico, /secret
     */
    '/((?!api|_next/static|_next/image|favicon.ico|secret).*)',
  ],
} 