import { create } from 'zustand';

/** Local selection only. The server still validates every interaction. */
export const useSocialSelection = create<{ targetId: string | null; request: number }>(() => ({ targetId: null, request: 0 }));
export function selectSocialTarget(targetId: string) {
  useSocialSelection.setState(state => ({ targetId, request: state.request + 1 }));
}
export function clearSocialTarget() { useSocialSelection.setState({ targetId: null }); }
