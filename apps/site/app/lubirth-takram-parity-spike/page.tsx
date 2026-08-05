import { LuBirthTakramParitySpikeClient } from "../../components/LuBirthTakramParitySpikeClient";

export const metadata = {
  title: "LuBirth Takram Parity Spike"
};

/** Query-only evidence route; it is never mounted by a product route. */
export default function LuBirthTakramParitySpikePage() {
  return <LuBirthTakramParitySpikeClient />;
}
