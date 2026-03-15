import 'next-auth';
import 'next-auth/jwt';

/**
 * Type augmentation for NextAuth
 * Extends default session and user types with our custom fields
 */

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    image: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
    email: string;
    name: string;
    picture: string | null;
  }
}
