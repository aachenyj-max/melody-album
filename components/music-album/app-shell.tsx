import type { ReactNode } from "react";
import { BatteryFull, Signal, Wifi } from "lucide-react";

export function AppShell({
  children,
  immersive = false,
}: {
  children: ReactNode;
  immersive?: boolean;
}) {
  return (
    <div className="album-app">
      <div className={`album-device ${immersive ? "is-immersive" : ""}`}>
        <div className="device-bezel" aria-hidden="true" />
        <div className="device-surface" aria-hidden="true" />
        <div className="device-status" aria-hidden="true">
          <span>9:41</span>
          <div className="status-icons">
            <Signal />
            <Wifi />
            <BatteryFull />
          </div>
        </div>
        <div className="device-island" aria-hidden="true">
          <i />
        </div>
        {children}
      </div>
    </div>
  );
}
