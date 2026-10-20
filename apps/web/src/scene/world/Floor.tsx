import { STAGE_ANCHOR } from '@rene/contracts';
import { Block, Ball } from './Primitives';
export function Floor() {
  return <>
    <Block at={[0, -.16, 0]} size={[15.6, .3, 11.6]} color="#E8B5C2" />
    {Array.from({ length: 11 }, (_, i) => <Block key={i} at={[0, -.002, i - 5]} size={[15.4, .012, .018]} color="#D798AA" />)}
    <group rotation={[0, -.12, 0]} position={[-3.8, 0, 1.1]}>
      <Block at={[0, .008, 0]} size={[4.3, .025, 3.3]} color="#191719" />
      <Block at={[.04, .024, 0]} size={[4.15, .018, 3.15]} color="#F5F2EA" />
      <Block at={[0, .037, 0]} size={[3.8, .012, .22]} color="#F34531" tilt={.06} />
      <Ball at={[1, .045, .7]} size={[.4, .012, .3]} color="#F5E742" />
    </group>
    <group position={[STAGE_ANCHOR.x, 0, STAGE_ANCHOR.z]} rotation={[0, .08, 0]}>
      <Block at={[0, .006, 0]} size={[3.3, .025, 2.2]} color="#191719" />
      <Block at={[.03, .025, 0]} size={[3.15, .018, 2.05]} color="#65B847" />
      <Block at={[0, .037, 0]} size={[.1, .01, 1.3]} color="#F5F2EA" />
      <Block at={[0, .038, 0]} size={[1.3, .01, .1]} color="#F5F2EA" />
    </group>
  </>;
}
