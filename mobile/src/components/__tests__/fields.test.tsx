import { fireEvent, screen } from "@testing-library/react-native";
import { renderThemed } from "@/test-utils";
import { Button } from "../Button";
import { ChoiceChips, SwitchRow, TextField } from "../fields";

describe("TextField", () => {
  it("is labelled and announces validation errors", async () => {
    await renderThemed(<TextField label="First name" value="" onChangeText={() => {}} error="Required" required />);
    expect(screen.getByLabelText("First name")).toBeTruthy();
    expect(screen.getByRole("alert")).toHaveTextContent(/Required/);
  });

  it("reports typed text", async () => {
    const onChange = jest.fn();
    await renderThemed(<TextField label="Notes" value="" onChangeText={onChange} />);
    await fireEvent.changeText(screen.getByLabelText("Notes"), "Prefers rose gold");
    expect(onChange).toHaveBeenCalledWith("Prefers rose gold");
  });
});

describe("ChoiceChips", () => {
  const options = [
    { value: "in_production", label: "In production" },
    { value: "completed", label: "Completed" },
  ] as const;

  it("exposes options as radio buttons with checked state", async () => {
    await renderThemed(<ChoiceChips label="Status" options={[...options]} value="completed" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "Completed" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "In production" })).not.toBeChecked();
  });

  it("clears the selection when allowed", async () => {
    const onChange = jest.fn();
    await renderThemed(<ChoiceChips label="Status" options={[...options]} value="completed" allowClear onChange={onChange} />);
    await fireEvent.press(screen.getByRole("radio", { name: "Completed" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe("SwitchRow", () => {
  it("is a single labelled switch that toggles", async () => {
    const onChange = jest.fn();
    await renderThemed(<SwitchRow label="Track material stock" value={false} onChange={onChange} />);
    const sw = screen.getByRole("switch", { name: "Track material stock" });
    expect(sw).not.toBeChecked();
    await fireEvent.press(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("Button", () => {
  it("is disabled while busy", async () => {
    const onPress = jest.fn();
    await renderThemed(<Button label="Save piece" onPress={onPress} busy />);
    const button = screen.getByRole("button", { name: "Save piece" });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
