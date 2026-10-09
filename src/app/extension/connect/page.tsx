import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { isAllowedExtensionId } from '@/lib/extension/ids';
import { ConnectPanel } from './ConnectPanel';
import { BrandMark } from '@/components/BrandMark';

export const metadata = { title: 'Connect extension — Prompt Saver' };

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ ext?: string }>;
}): Promise<React.ReactElement> {
  const { ext } = await searchParams;
  const session = await getServerSession(authOptions);
  if (session === null) {
    const back = `/extension/connect${ext !== undefined ? `?ext=${encodeURIComponent(ext)}` : ''}`;
    redirect(`/app/auth/signin?callbackUrl=${encodeURIComponent(back)}`);
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4 font-body">
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <span className="font-display text-2xl text-stone-900">Prompt Saver</span>
        </div>
        <h1 className="mt-8 font-display text-[30px] leading-tight text-stone-900">
          Connect the Chrome extension
        </h1>
        {ext !== undefined && isAllowedExtensionId(ext) ? (
          <ConnectPanel extId={ext} email={session.user?.email ?? ''} />
        ) : (
          <p className="mt-4 text-stone-600">
            This link didn&apos;t come from the Prompt Saver extension. Open the extension and click
            <strong> Connect account</strong> again.
          </p>
        )}
      </div>
    </main>
  );
}
