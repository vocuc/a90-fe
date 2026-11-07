import useSeo from '../hooks/useSeo';
import HeroSection from '../components/home/HeroSection';
import CategoryStrip from '../components/home/CategoryStrip';
import AgentFeaturesSection from '../components/home/AgentFeaturesSection';

export default function HomePage() {
  useSeo({ canonical: '/' });
  return (
    <>
      <HeroSection />
      <CategoryStrip title="Khám phá theo danh mục" rows={2} />
      <AgentFeaturesSection />
    </>
  );
}
