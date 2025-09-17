import { MembersDashboard } from '@/components/members-dashboard';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mitglieder-Dashboard - Schlossparktheater',
  description: 'Live-Dashboard für Theater-Mitglieder mit Online-Status und aktuellen Aktivitäten',
};

export default function MembersDashboardPage() {
  return <MembersDashboard />;
}