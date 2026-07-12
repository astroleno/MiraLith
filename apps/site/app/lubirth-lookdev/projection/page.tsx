import { LuBirthLookdevRoute } from "../../../components/LuBirthLookdevRoute";

export const metadata = {
  title: "LuBirth Projection Lookdev | MiraLith",
  description: "Projection-space LuBirth horizon compositing lookdev route."
};

export default function LuBirthProjectionLookdevPage() {
  return <LuBirthLookdevRoute pass="projection" />;
}
