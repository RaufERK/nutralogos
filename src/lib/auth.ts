import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const adminEmail = process.env.ADMIN_EMAIL
        const adminPassword = process.env.ADMIN_PASSWORD

        if (
          credentials.email === adminEmail &&
          credentials.password === adminPassword
        ) {
          return {
            id: '1',
            email: adminEmail,
            name: 'Admin',
            role: 'admin',
          }
        }

        return null
      },
    }),
  ],
  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user && typeof user === 'object' && 'role' in user) {
        ;(token as Record<string, unknown>).role = (user as Record<string, unknown>).role
      }
      return token
    },
    async session({ session, token }) {
      if (token && typeof token === 'object' && 'role' in token) {
        const tokenRole = (token as { [key: string]: unknown }).role
        if (typeof tokenRole === 'string') {
          ;(session.user as unknown as { role?: string }).role = tokenRole
        }
      }
      return session
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
})
