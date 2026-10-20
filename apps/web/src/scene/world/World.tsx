import { Walls } from './Walls';
import { Furniture } from './Furniture';
import { Floor } from './Floor';
import { WallArt } from './WallArt';
export function World() {
  return <><color attach="background" args={['#F5F2EA']} /><ambientLight intensity={1.8} /><directionalLight position={[3, 10, 8]} intensity={1.6} />
    <Floor /><Walls /><Furniture /><WallArt />
  </>;
}
