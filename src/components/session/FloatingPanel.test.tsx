import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Shapes } from "lucide-react";
import FloatingPanel from "./FloatingPanel";
import PanelDock from "./PanelDock";

function TheaterHarness() {
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [value, setValue] = useState("2");

  return (
    <div data-canvas-frame>
      {!minimized && (
        <FloatingPanel
          rect={{ x: 8, y: 8, w: 340, h: 268 }}
          onRectChange={() => undefined}
          collapsed={false}
          onToggleCollapsed={() => undefined}
          title="Math Theater"
          icon={Shapes}
          maximized={maximized}
          onToggleMaximized={() => setMaximized((current) => !current)}
          onMinimize={() => {
            setMaximized(false);
            setMinimized(true);
          }}
        >
          <label>
            Parameter
            <input value={value} onChange={(event) => setValue(event.target.value)} />
          </label>
        </FloatingPanel>
      )}
      <PanelDock
        items={minimized ? [{ id: "stage", label: "Math Theater", icon: Shapes }] : []}
        onRestore={() => setMinimized(false)}
        bottom={0}
      />
    </div>
  );
}

describe("Math Theater panel controls", () => {
  it("minimizes from the expanded state and restores its live contents", () => {
    render(<TheaterHarness />);

    fireEvent.change(screen.getByLabelText("Parameter"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Expand Math Theater" }));
    expect(screen.getByRole("button", { name: "Restore Math Theater" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Minimize Math Theater" }));
    expect(screen.queryByLabelText("Parameter")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restore Math Theater" }));
    expect(screen.getByLabelText("Parameter")).toHaveValue("7");
    expect(screen.getByRole("button", { name: "Expand Math Theater" })).toBeInTheDocument();
  });
});