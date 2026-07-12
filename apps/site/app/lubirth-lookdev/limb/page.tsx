import { LuBirthLookdevRoute } from "../../../components/LuBirthLookdevRoute";

export const metadata = {
  title: "LuBirth Limb Lookdev | MiraLith",
  description: "Isolated LuBirth limb scattering lookdev route."
};

export default function LuBirthLimbLookdevPage() {
  return <LuBirthLookdevRoute pass="limb" />;
}
