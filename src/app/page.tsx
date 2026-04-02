import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';

export default async function LandingPage(): Promise<React.ReactElement> {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect('/app');
  }

  return (
    <div className="bg-stone-50 font-body">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-stone-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-6">
          <Link href="/" className="font-display text-[22px] text-stone-900">
            Prompt Saver
          </Link>
          <Link
            href="/app"
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-hover"
          >
            Start Saving Prompts &rarr;
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto grid max-w-[1100px] items-center gap-12 px-6 pb-16 pt-20 md:grid-cols-2">
        <div>
          <h1 className="font-display text-[52px] leading-[1.1] tracking-tight text-stone-900 max-md:text-4xl">
            Your prompts,<br />
            <em className="text-primary">saved and searchable.</em>
          </h1>
          <p className="mt-4 max-w-[440px] text-lg leading-relaxed text-stone-500">
            Stop losing your best prompts in chat history. Save, version, and find any prompt in seconds.
          </p>
          <Link
            href="/app"
            className="mt-7 inline-flex items-center gap-2 rounded-[10px] bg-primary px-7 py-3.5 text-base font-medium text-white shadow-[0_2px_8px_rgba(13,148,136,0.2)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary-hover"
          >
            Start Saving Prompts
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
          </Link>
          <p className="mt-3 text-[13px] text-stone-400">Free forever. No account required.</p>
        </div>

        {/* App Preview */}
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-[0_8px_32px_rgba(28,25,23,0.08)]">
          <div className="flex items-center gap-1.5 border-b border-stone-200 bg-stone-50 px-3 py-2.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-300" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <span className="font-display text-base">Prompt Saver</span>
              <span className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-white">+ New Prompt</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { title: 'Resume Analyzer', desc: 'Evaluate candidates against role requirements', tag: 'hiring', time: '2m ago', v: 'v3' },
                { title: 'Code Review Template', desc: 'Structured review with security checklist', tag: 'code-review', time: '1d ago', v: 'v7' },
                { title: 'Meeting Summary', desc: 'Extract action items from meeting notes', tag: 'productivity', time: '3d ago', v: 'v2' },
                { title: 'Content Brief Writer', desc: 'Generate SEO content briefs from topics', tag: 'content', time: '5d ago', v: 'v4' },
              ].map((card) => (
                <div key={card.title} className="rounded-lg border border-stone-200 p-2.5 transition-shadow duration-200 hover:shadow-md">
                  <p className="text-xs font-semibold text-stone-900">{card.title}</p>
                  <p className="mt-0.5 text-[10px] text-stone-500">{card.desc}</p>
                  <span className="mt-1.5 inline-block rounded-full bg-primary-light px-1.5 py-0.5 text-[9px] font-medium text-primary">{card.tag}</span>
                  <div className="mt-1.5 flex justify-between text-[9px] text-stone-400">
                    <span>{card.time}</span>
                    <span className="font-mono">{card.v}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pain */}
      <section className="mx-auto max-w-[1100px] px-6 py-20">
        <h2 className="text-center font-display text-4xl text-stone-900 max-md:text-3xl">Sound familiar?</h2>
        <p className="mt-2 text-center text-base text-stone-500">You&rsquo;ve been here before. We all have.</p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              ),
              bg: 'bg-red-50', color: 'text-red-500',
              title: 'The lost prompt',
              body: '\u201cI had a perfect prompt for this\u2026 somewhere. Was it in ChatGPT? Notion? A Slack message?\u201d',
            },
            {
              icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              ),
              bg: 'bg-amber-50', color: 'text-amber-500',
              title: 'The rewrite',
              body: '\u201cI spent 20 minutes writing this prompt last week. Now I\u2019m rewriting it from scratch because I can\u2019t find it.\u201d',
            },
            {
              icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              ),
              bg: 'bg-emerald-50', color: 'text-emerald-500',
              title: 'The better version',
              body: '\u201cI improved this prompt yesterday but accidentally overwrote the working version. Which one was better?\u201d',
            },
          ].map((card) => (
            <div key={card.title} className="rounded-xl border border-stone-200 bg-white p-7 transition-all duration-200 hover:border-stone-300 hover:shadow-md">
              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] ${card.bg} ${card.color}`}>
                {card.icon}
              </div>
              <h3 className="text-base font-semibold text-stone-900">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-500">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-stone-200 bg-white py-20">
        <div className="mx-auto max-w-[1100px] px-6">
          <h2 className="text-center font-display text-4xl text-stone-900 max-md:text-3xl">Three steps. That&rsquo;s it.</h2>
          <div className="relative mt-12 grid gap-8 md:grid-cols-3">
            <div className="absolute left-[15%] right-[15%] top-7 hidden h-0.5 bg-gradient-to-r from-primary-light via-primary to-primary-light md:block" />
            {[
              { num: '1', title: 'Save', body: 'Paste your prompt, add a title and tags. Done in 10 seconds.' },
              { num: '2', title: 'Version', body: 'Every edit is automatically versioned. Compare any two versions side by side.' },
              { num: '3', title: 'Find', body: 'Search by any word in your prompt \u2014 title, content, or tags. Instant results.' },
            ].map((step) => (
              <div key={step.num} className="relative z-10 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary font-display text-2xl text-white shadow-[0_4px_12px_rgba(13,148,136,0.25)]">
                  {step.num}
                </div>
                <h3 className="text-lg font-semibold text-stone-900">{step.title}</h3>
                <p className="mx-auto mt-1.5 max-w-[260px] text-sm text-stone-500">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-[1100px] px-6 py-20">
        <h2 className="text-center font-display text-4xl text-stone-900 max-md:text-3xl">Built for how you actually work.</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {[
            {
              icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
              title: 'Version history',
              body: 'Every save is a snapshot. See what changed, when, and why. Restore any previous version with one click.',
            },
            {
              icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
              title: 'Instant search',
              body: 'Full-text search across everything \u2014 titles, content, tags. Find any prompt in seconds, not minutes.',
            },
            {
              icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>,
              title: 'Tags & favorites',
              body: 'Organize by project, purpose, or whatever makes sense to you. Star your go-to prompts for quick access.',
            },
            {
              icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
              title: 'Zero friction',
              body: 'No account, no API key, no onboarding wizard. Open Prompt Saver and start saving prompts. Literally.',
            },
          ].map((f) => (
            <div key={f.title} className="flex gap-4 rounded-xl border border-stone-200 bg-white p-6 transition-all duration-200 hover:border-stone-300 hover:shadow-md">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#F0FDFA] text-primary">
                {f.icon}
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-stone-900">{f.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-stone-500">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-b from-stone-50 to-[#F0FDFA] py-20 text-center">
        <h2 className="font-display text-[40px] text-stone-900 max-md:text-3xl">
          Your prompts deserve better<br />than a Notion doc.
        </h2>
        <p className="mt-3 text-base text-stone-500">Start building your prompt library today. It takes 10 seconds.</p>
        <Link
          href="/app"
          className="mt-7 inline-flex items-center gap-2 rounded-[10px] bg-primary px-8 py-4 text-base font-medium text-white shadow-[0_4px_16px_rgba(13,148,136,0.25)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary-hover"
        >
          Start Saving Prompts
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
        </Link>
        <p className="mt-3 text-[13px] text-stone-400">Free. No signup. Works in your browser.</p>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 py-8 text-center text-[13px] text-stone-400">
        <p>Prompt Saver</p>
      </footer>
    </div>
  );
}
