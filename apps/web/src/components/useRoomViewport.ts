import { useEffect, useState } from 'react';
export type RoomLayout = 'desktop' | 'intermediate' | 'mobile';
export interface ClearArea { left: number; top: number; width: number; height: number }
export function useRoomViewport() {
  const read = () => {
    const viewport = window.visualViewport;
    const width = viewport?.width ?? innerWidth; const height = viewport?.height ?? innerHeight;
    const layout: RoomLayout = width < 900 || height < 600 ? 'mobile' : width >= 1200 && height >= 700 ? 'desktop' : 'intermediate';
    return { width, height, top: viewport?.offsetTop ?? 0, left: viewport?.offsetLeft ?? 0, layout };
  };
  const [viewport, setViewport] = useState(read);
  useEffect(() => {
    const update = () => setViewport(read());
    window.addEventListener('resize', update); visualViewport?.addEventListener('resize', update); visualViewport?.addEventListener('scroll', update);
    return () => { window.removeEventListener('resize', update); visualViewport?.removeEventListener('resize', update); visualViewport?.removeEventListener('scroll', update); };
  }, []);
  return viewport;
}
