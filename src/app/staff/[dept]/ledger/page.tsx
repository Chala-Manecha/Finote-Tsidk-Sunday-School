import { redirect } from 'next/navigation';

/** Moved into the one የገንዘብ ሪፖርት page. */
export default async function Moved({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { dept } = await params;
  const sp = new URLSearchParams(Object.entries(await searchParams).filter((e): e is [string, string] => !!e[1]));
  
  const q = sp.toString();
  redirect(`/staff/${dept}/money-report${q ? `?${q}` : ''}`);
}
