import type { Metadata } from "next";
import DraftScreen from "@/components/DraftScreen";

export const metadata: Metadata = {
  title: "사건조사서 초안",
};

// 초안 화면 (담은 원문을 세 항목으로 모아 보여 주고, 수정·빼기)
export default function DraftPage() {
  return <DraftScreen />;
}
