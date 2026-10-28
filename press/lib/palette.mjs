// Two paper stocks for one print run. The site is printed on near-black
// only; the README follows GitHub's theme, so the same plates are also
// pulled on bone for the light theme ("held to the light"). Dark values are
// the site's own tokens (app/globals.css, converted from oklch).
//
// What changes between the pulls is the paper and the type on it. Card
// stocks and their inks, the portrait and the thermal paper are the same
// in both, the way a card is the same card whatever table it lies on.

const shared = {
  brand: "#d9634a", // --brand, terracotta
  // card stocks, each with an ink of its own hue (--stock-* / --ink-*)
  stocks: {
    terracotta: { paper: "#d9634a", ink: "#2b0d06" },
    teal: { paper: "#4f9590", ink: "#04201e" },
    bone: { paper: "#ebe7e1", ink: "#1a1715" },
    stone: { paper: "#a6a09a", ink: "#1b1815" },
  },
  // the portrait prints the same on both stocks: near-black figure, bone dots
  portrait: { shadow: "#1a1715", ink: "#ebe7e1" },
  // thermal roll
  thermal: { paper: "#f5f1ea", ink: "#1a1715" },
}

export const stocks = {
  dark: {
    ...shared,
    name: "dark",
    paper: "#1a1715", // --background
    card: "#23201d", // --card
    raised: "#2f2a28", // --secondary
    type: "#ebe7e1", // --foreground
    headline: "#f5f1ea",
    muted: "#a6a09a", // --muted-foreground
    faint: "#58514c",
    rule: "rgba(219,203,185,0.24)", // --rule
    border: "rgba(219,203,185,0.12)", // --border
    crop: "rgba(166,160,154,0.6)",
    teal: "#498e89", // --teal
    stampFrame: "#ebe7e1",
    watermark: "#1e1b19", // in the paper, invisible on black stock
  },
  light: {
    ...shared,
    name: "light",
    paper: "#f5f1ea", // bone, the identity anchor
    card: "#ece7df",
    raised: "#e3ddd3",
    type: "#1a1715",
    headline: "#1a1715",
    muted: "#6b645e",
    faint: "#b4aca3",
    rule: "rgba(26,23,21,0.28)",
    border: "rgba(26,23,21,0.14)",
    crop: "rgba(26,23,21,0.45)",
    teal: "#3e8a86",
    stampFrame: "#1a1715",
    watermark: "#ece6dc", // held to the light, it shows
  },
}

export const themes = ["dark", "light"]
