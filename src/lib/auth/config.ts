import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { isEmailAllowed } from './allowlist';

const providers = [];

if (process.env['GOOGLE_CLIENT_ID'] && process.env['GOOGLE_CLIENT_SECRET']) {
  providers.push(
    GoogleProvider({
      clientId: process.env['GOOGLE_CLIENT_ID'],
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'],
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,

  callbacks: {
    // Gate sign-in on the allowlist. Google has already verified this email.
    async signIn({ user }) {
      return isEmailAllowed(user.email);
    },

    // `token.sub` is Google's stable subject id — our users.id primary key.
    async jwt({ token, user }) {
      if (user) {
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
      }
      if (typeof token.sub === 'string') {
        token.userId = token.sub;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.image = token.picture as string | null;
      }
      return session;
    },
  },

  pages: {
    signIn: '/app/auth/signin',
    error: '/app/auth/error',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};

export default NextAuth(authOptions);
