import { render } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { ThemeProvider } from "@/theme";

/** Renders inside the theme provider (RNTL 14 `render` is async). */
export function renderThemed(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}
