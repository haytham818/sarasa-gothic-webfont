import "./index.css";

const sarasaUiSc = Object.freeze({
  className: "sarasa-ui-sc-font",
  variable: "sarasa-ui-sc-variable",
  style: Object.freeze({
    fontFamily:
      '"Sarasa UI SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  }),
});

export function Sarasa_UI_SC(...arguments_) {
  if (arguments_.length > 0) {
    throw new TypeError(
      "Call Sarasa_UI_SC() without arguments; weights 400 and 600 and font-display: swap are built into this package.",
    );
  }

  return sarasaUiSc;
}
