import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { Button } from "./button";

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(async () => {
  if (root) {
    await act(async () => {
      root!.unmount();
    });
    root = null;
  }
  host?.remove();
  host = null;
});

async function render(ui: React.ReactNode) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(ui);
  });
}

describe("Button (browser)", () => {
  it("renders its label and the default slot attributes", async () => {
    await render(<Button>Throw dart</Button>);
    const button = page.getByRole("button", { name: "Throw dart" });
    await expect.element(button).toBeInTheDocument();
    await expect.element(button).toHaveAttribute("data-variant", "default");
    await expect.element(button).toHaveAttribute("data-size", "default");
  });

  it("fires onClick when the user clicks it", async () => {
    const onClick = vi.fn();
    await render(<Button onClick={onClick}>Record</Button>);
    await page.getByRole("button", { name: "Record" }).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    await render(
      <Button onClick={onClick} disabled>
        Finish
      </Button>,
    );
    const button = page.getByRole("button", { name: "Finish" });
    await expect.element(button).toBeDisabled();
    await button.click({ force: true }).catch(() => {});
    expect(onClick).not.toHaveBeenCalled();
  });

  it("reflects variant and size props on data attributes", async () => {
    await render(
      <Button variant="destructive" size="lg">
        Abandon
      </Button>,
    );
    const button = page.getByRole("button", { name: "Abandon" });
    await expect.element(button).toHaveAttribute("data-variant", "destructive");
    await expect.element(button).toHaveAttribute("data-size", "lg");
  });
});
