import { render, screen } from '@testing-library/react';
import PrivacyPage from '@/app/privacy/page';

describe('privacy page', () => {
  it('covers what is stored, when chat text is read, no selling, and deletion', () => {
    render(<PrivacyPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Privacy Policy');
    expect(screen.getByText(/Neon Postgres/)).toBeInTheDocument();
    expect(screen.getByText(/only when you/i)).toBeInTheDocument();
    expect(screen.getByText(/do not sell/i)).toBeInTheDocument();
    expect(screen.getByText(/delete your account/i)).toBeInTheDocument();
  });
});
