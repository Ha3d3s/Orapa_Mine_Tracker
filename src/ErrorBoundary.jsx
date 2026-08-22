import React from "react";
import { AlertTriangle } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("Orapa Mine — erreur interceptée :", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#12121C] text-[#EDE9E0] font-sans flex flex-col items-center justify-center px-6 gap-4 text-center">
          <AlertTriangle size={40} className="text-[#E05C5C]" />
          <h1 className="text-lg font-bold">Un imprévu est survenu</h1>
          <p className="text-sm text-[#9A94A8] max-w-xs">
            Ce mode a rencontré une erreur. Tes autres parties (sauvegardées) ne sont pas affectées.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false }); this.props.onReset?.(); }}
            className="mt-2 px-5 py-2.5 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] font-semibold text-sm"
          >
            Retour à l'accueil
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
