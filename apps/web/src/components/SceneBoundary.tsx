import { Component, type ReactNode } from 'react';
export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="scene-fallback"><strong>Le salon se joue aussi sans 3D.</strong><p>Votre navigateur ne peut pas afficher la scène.<br />Les indices, le vote et le chat restent disponibles.</p></div> : this.props.children; }
}
