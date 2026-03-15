export interface User {
  id: string; // Google OAuth subject
  email: string; // Google email
  name: string; // Display name
  avatar?: string; // Google profile picture URL
  created_at: string; // ISO8601 timestamp
  last_login: string; // ISO8601 timestamp
  tier: 'free' | 'pro' | 'enterprise'; // Subscription tier
  subscription_id?: string; // Stripe subscription ID
}
