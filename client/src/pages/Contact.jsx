import { useEffect } from 'react';
import { roverStore } from '../lib/roverStore';
import RoverScene from '../components/three/RoverScene';
import ContactSection from '../components/sections/Contact';
import Breadcrumb from '../components/ui/Breadcrumb';

export default function Contact() {
  useEffect(() => {
    // no hero on this page: keep the rover hidden until the drive-in trigger fires
    Object.assign(roverStore, { hero: 1, about: 0, hidden: 1, contact: 0, footer: 0, assembled: 1 });
  }, []);
  return (
    <>
      <RoverScene />
      <div className="px-[var(--pad-x)] pt-28 md:pt-32">
        <Breadcrumb parts={['Contact']} />
      </div>
      <ContactSection showTeams />
    </>
  );
}
