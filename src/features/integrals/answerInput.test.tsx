/**
 * The answer box, which is the one place a student's work meets the grader. The owner's standing
 * worry is a right answer being misread, so both routes in — typing and the palette — are covered
 * here, along with the box's account of what it has understood so far.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import AnswerInput from "./components/AnswerInput";
import { gradeAnswer } from "./answer";
import { PROBLEMS } from "./problems";

const indefinite = PROBLEMS.find((p) => p.kind === "indefinite")!;
const definite = PROBLEMS.find((p) => p.kind === "definite")!;

function Harness({ problem = indefinite }: { problem?: typeof indefinite }) {
  const [value, setValue] = useState("");
  return (
    <AnswerInput
      value={value}
      onChange={setValue}
      onSubmit={() => undefined}
      verdict={null}
      problem={problem}
    />
  );
}

beforeEach(() => window.localStorage.clear());

const box = () => screen.getByLabelText(/Your answer to the integral/i) as HTMLInputElement;

describe("the symbol palette", () => {
  it("stays out of the way until asked for", () => {
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "Square root" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Symbols/ }));
    expect(screen.getByRole("button", { name: "Square root" })).toBeInTheDocument();
  });

  it("remembers that you want it, across problems", () => {
    const first = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Symbols/ }));
    first.unmount();

    render(<Harness />);
    expect(screen.getByRole("button", { name: "Square root" })).toBeInTheDocument();
  });

  it("types the plainest syntax the grader accepts, not LaTeX", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Symbols/ }));
    fireEvent.click(screen.getByRole("button", { name: "Sine" }));
    // Landing inside the brackets is the whole point of a function key.
    expect(box().value).toBe("sin()");
    expect(box().selectionStart).toBe(4);
  });

  it("inserts at the caret rather than the end", () => {
    render(<Harness />);
    fireEvent.change(box(), { target: { value: "2x" } });
    box().setSelectionRange(1, 1);
    fireEvent.click(screen.getByRole("button", { name: /Symbols/ }));
    fireEvent.click(screen.getByRole("button", { name: "pi" }));
    expect(box().value).toBe("2pix");
  });

  it("builds an answer the grader marks correct", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Symbols/ }));
    fireEvent.click(screen.getByRole("button", { name: "Square root" }));
    fireEvent.click(screen.getByRole("button", { name: "x" }));
    expect(gradeAnswer({ ...indefinite, answer: "sqrt(x)" }, box().value).status).toBe("correct");
  });

  it("does not offer x or + C on a definite integral", () => {
    render(<Harness problem={definite} />);
    fireEvent.click(screen.getByRole("button", { name: /Symbols/ }));
    // The two answers a definite integral cannot have are the two the grader rejects by name.
    expect(screen.queryByRole("button", { name: "x" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Constant of integration/ })).toBeNull();
    expect(screen.getByRole("button", { name: "pi" })).toBeInTheDocument();
  });
});

describe("what the box says it understood", () => {
  it("shows the reading back once it parses", () => {
    render(<Harness />);
    fireEvent.change(box(), { target: { value: "x^3/3" } });
    expect(screen.getByText(/reads as/)).toBeInTheDocument();
  });

  it("holds its tongue mid-expression", () => {
    render(<Harness />);
    fireEvent.change(box(), { target: { value: "sin(x" } });
    expect(screen.getByText(/still reading that/)).toBeInTheDocument();
  });

  it("says so when more typing will not help", () => {
    render(<Harness />);
    fireEvent.change(box(), { target: { value: "x^^2" } });
    expect(screen.getByText(/Can't read that/)).toBeInTheDocument();
    expect(screen.queryByText(/still reading that/)).toBeNull();
  });
});
