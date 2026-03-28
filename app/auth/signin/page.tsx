import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import SignInButtons from './SignInButtons'
import { authOptions } from '@/lib/auth'

export const metadata = {
  title: 'Sign in · Antigravity',
}

export default async function SignInPage() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/')

  const hasGoogle = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  const hasGitHub = Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET)

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/50 p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-sm font-bold">
            AG
          </div>
          <h1 className="text-xl font-bold text-white">Sign in</h1>
          <p className="text-sm text-slate-500">
            Use Google or GitHub to sync your watchlist across sessions on this device. JWT session — no separate user database required.
          </p>
        </div>

        {!hasGoogle && !hasGitHub ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-200/90">
            <p className="font-medium text-amber-100 mb-2">OAuth not configured</p>
            <p className="text-amber-200/70 mb-3">
              Copy <code className="text-xs bg-slate-950 px-1 py-0.5 rounded">.env.example</code> to{' '}
              <code className="text-xs bg-slate-950 px-1 py-0.5 rounded">.env.local</code> and add at least one provider (Google and/or GitHub) plus{' '}
              <code className="text-xs bg-slate-950 px-1 py-0.5 rounded">NEXTAUTH_SECRET</code>.
            </p>
            <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm font-medium">
              ← Back to markets
            </Link>
          </div>
        ) : (
          <SignInButtons hasGoogle={hasGoogle} hasGitHub={hasGitHub} />
        )}

        <p className="text-xs text-slate-600 text-center leading-relaxed">
          By signing in you agree that this platform is for information only and does not provide investment advice.
          See footer disclaimer on the main site.
        </p>
      </div>
    </div>
  )
}
