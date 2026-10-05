import { fireEvent, render, screen } from '@testing-library/react';
import { ConnectPanel } from '@/app/extension/connect/ConnectPanel';
import { connectExtensionAction } from '@/lib/actions/extension';

jest.mock('@/lib/actions/extension', () => ({ connectExtensionAction: jest.fn() }));
jest.mock('@/lib/actions/tokens', () => ({ revokeTokenAction: jest.fn() }));

describe('ConnectPanel', () => {
  it('shows the requesting extension id so the user can verify it', () => {
    render(<ConnectPanel extId="coclcgbalhmalehigbkflhaocjieklfe" email="a@b.c" />);
    expect(screen.getByText('coclcgbalhmalehigbkflhaocjieklfe')).toBeInTheDocument();
  });

  it('shows the error state instead of hanging on Connecting… when the action rejects', async () => {
    jest.mocked(connectExtensionAction).mockRejectedValue(new Error('network down'));
    render(<ConnectPanel extId="abc" email="a@b.c" />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByText('Connecting…')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
  });
});
