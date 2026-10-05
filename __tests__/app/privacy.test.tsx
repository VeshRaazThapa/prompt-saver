import { render, screen } from '@testing-library/react';
import PrivacyPage from '@/app/privacy/page';

describe('privacy page', () => {
  it('covers what is stored, when chat text is read, no selling, and deletion', () => {
    render(<PrivacyPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Privacy Policy');
    expect(screen.getByText(/Neon Postgres/)).toBeInTheDocument();
    // The extension checks chat-box text locally for "//" and sends text only when the user saves.
    const ext = screen.getByText(/checks the text locally/i);
    expect(ext).toHaveTextContent(/never leaves your browser/i);
    expect(ext).toHaveTextContent(/sends text to Prompt Saver only when you save a prompt/i);
    expect(ext).toHaveTextContent(/Save to Prompt Saver/);
    expect(ext).not.toHaveTextContent(/reads the text in an AI chat box only when/i);
    expect(screen.getByText(/do not sell/i)).toBeInTheDocument();
    expect(screen.getByText(/delete your account/i)).toBeInTheDocument();
  });
});
