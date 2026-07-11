import { NasaEarthRoute } from "../../components/NasaEarthRoute";

export const metadata = {
  title: "NASA Earth Shader | MiraLith",
  description:
    "A real-time NASA-grade Earth shader route with volumetric cloud shadows, ocean glint, and Karman-line atmospheric scattering."
};

export default function NasaPage() {
  return <NasaEarthRoute />;
}
