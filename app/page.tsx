import MainScreen from "@/components/MainScreen";
import { HOSTED_DEMO } from "@/lib/store/db";

// 메인 화면 (사건 서류 칸, 찾기, 담은 원문)
export default function Home() {
  return (
    <>
      {HOSTED_DEMO && (
        <p role="note" className="bg-amber-100 px-6 py-2 text-sm text-amber-900">
          인터넷 시연 화면입니다. 서류 올리기는 막혀 있고, 법령 조문·유사 사례 찾기만 써 볼 수 있습니다. 실제 서류는 이 컴퓨터에서만 실행하는 앱에서 다루세요.
        </p>
      )}
      <MainScreen />
    </>
  );
}
