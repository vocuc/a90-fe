import HeroSection from '../components/home/HeroSection';
import CategoryStrip from '../components/home/CategoryStrip';
import FeaturedSection from '../components/home/FeaturedSection';
import NewestSection from '../components/home/NewestSection';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <CategoryStrip title="Khám phá theo danh mục" rows={2} />
      <FeaturedSection />
      <NewestSection />
    </>
  );
}
