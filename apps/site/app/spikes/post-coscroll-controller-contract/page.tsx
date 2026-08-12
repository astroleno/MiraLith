import { notFound } from "next/navigation";
import { PostCoScrollControllerContractFixture } from "../../../components/post-coscroll/PostCoScrollControllerContractFixture";

export default function PostCoScrollControllerContractPage() {
  if (process.env.MIRALITH_CONTRACT_FIXTURES !== "1") {
    notFound();
  }

  return <PostCoScrollControllerContractFixture />;
}
