import { DraftPreview } from '../../../../components/admin/DraftPreview';
export default async function PreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ locale?: string }> }) {
  const { id } = await params;
  const { locale } = await searchParams;
  return <DraftPreview id={id} locale={locale === 'en' ? 'en' : 'ru'} />;
}
