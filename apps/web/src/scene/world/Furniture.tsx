import { WORLD_FURNITURE } from '@rene/contracts';
import { Block, Ball } from './Primitives';
import { avatarGeometry, avatarMaterial } from '../../avatar/PartMeshes';
export function Furniture() {
  const sofa = WORLD_FURNITURE[1]; const plant = WORLD_FURNITURE[2]; const lamp = WORLD_FURNITURE[3];
  return <>
    <group name="table-des-suspects">
      <Block at={[0, .8, 0]} size={[2.6, .22, 1.6]} color="#191719" tilt={.018} />
      <Block at={[0, .84, 0]} size={[2.52, .17, 1.52]} color="#087BA0" tilt={.018} />
      {[-1, 1].map(s => <Block key={s} at={[s * .85, .38, 0]} size={[.25, .76, 1.1]} color={s < 0 ? '#F34531' : '#F5E742'} tilt={s * .06} />)}
      <Block at={[.3, .96, .12]} size={[.48, .025, .37]} color="#F5E742" tilt={.06} />
      <mesh position={[-.35, 1.03, -.1]} scale={[.09, .2, .09]} geometry={avatarGeometry.cylinder} material={avatarMaterial('#F5F2EA')} dispose={null} />
    </group>
    <group position={[sofa.x, 0, sofa.z]} name="canape-bleu">
      <Block at={[0, .45, 0]} size={[3.4, .35, 1.4]} color="#191719" />
      <Block at={[0, 1.1, -.54]} size={[3.4, 1.05, .3]} color="#087BA0" tilt={-.025} />
      {[-1, 0, 1].map((s, i) => <Block key={s} at={[s * .94, .7 + i * .015, .02]} size={[.91, .3, 1.15]} color="#087BA0" tilt={s * .018} />)}
      {[-1, 1].map(s => <Block key={s} at={[s * 1.5, .9, 0]} size={[.4, .65, 1.4]} color="#087BA0" tilt={s * -.05} />)}
      <Ball at={[-.6, 1.03, -.08]} size={[.38, .36, .16]} color="#F5E742" /><Ball at={[.6, 1.02, -.12]} size={[.36, .34, .14]} color="#EE89BA" />
    </group>
    <group position={[plant.x, 0, plant.z]} name="plante-indecise">
      <mesh position={[0, .4, 0]} scale={[.5, .8, .5]} geometry={avatarGeometry.cylinder} material={avatarMaterial('#F34531')} dispose={null} />
      <Block at={[.03, 1.5, 0]} size={[.09, 2.1, .09]} color="#191719" tilt={-.06} />
      {[-1, 1].map(s => <group key={s} rotation={[0, 0, s * .5]} position={[s * .17, 1.8 + s * .25, 0]}><Ball at={[0, 0, 0]} size={[.25, .55, .13]} color="#65B847" /></group>)}
      <Ball at={[.05, 2.48, 0]} size={[.18, .2, .15]} color="#F5E742" />
    </group>
    <group position={[lamp.x, 0, lamp.z]} name="lampe-de-travers">
      <Block at={[0, .09, 0]} size={[.9, .18, .85]} color="#191719" />
      <Block at={[0, 1.45, 0]} size={[.08, 2.8, .08]} color="#191719" tilt={-.04} />
      <mesh position={[.12, 2.8, 0]} rotation={[0, 0, -.08]} scale={[.54, .7, .54]} geometry={avatarGeometry.cone} material={avatarMaterial('#EE89BA')} dispose={null} />
    </group>
  </>;
}
