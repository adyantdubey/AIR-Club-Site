import TeamSection from '../components/sections/Team';
import Breadcrumb from '../components/ui/Breadcrumb';

export default function Team() {
  return (
    <>
      <div className="px-[var(--pad-x)] pt-28 md:pt-32">
        <Breadcrumb parts={['Team']} />
      </div>
      <TeamSection />
    </>
  );
}
