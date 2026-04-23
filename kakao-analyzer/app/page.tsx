"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UploadCloud,
  MessageSquare,
  Users,
  Calendar,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
// Recharts 컴포넌트 임포트
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ============================================================
// 타입 정의
// ============================================================

/**
 * 파싱된 카카오톡 메시지 하나의 구조
 */
interface ChatMessage {
  date: string; // "2024년 1월 15일 월요일" 형식
  sender: string; // 발신자 이름
  time: string; // "오전 10:30" 형식
  content: string; // 메시지 본문
}

// ============================================================
// 상수 및 유틸리티
// ============================================================

/**
 * 욕설 감지에 사용할 단어 목록
 * 필요에 따라 단어를 추가/삭제할 수 있습니다.
 */
const PROFANITY_LIST = [
  "시발",
  "씨발",
  "존나",
  "좆",
  "병신",
  "미친",
  "닥쳐",
  "개새끼",
  "지랄",
];

/**
 * 차트 색상 팔레트 (참여자 지분 차트에 사용)
 * CSS 변수를 통해 전역 테마와 연동할 수 있으나 여기서는 하드코딩
 * 디자이너: 이 배열을 수정하여 차트 색상을 변경할 수 있습니다.
 */
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

// ============================================================
// 헬퍼 함수
// ============================================================

/**
 * "오전/오후 HH:MM" 형식의 시간을 24시간제 숫자(0~23)로 변환
 * @param timeStr - 예: "오전 10:30"
 * @returns 변환된 시간 (실패 시 -1)
 */
function convertTo24Hour(timeStr: string): number {
  const match = timeStr.match(/(오전|오후) (\d{1,2}):(\d{2})/);
  if (!match) return -1;
  let hour = parseInt(match[2], 10);
  if (match[1] === "오후" && hour !== 12) hour += 12;
  else if (match[1] === "오전" && hour === 12) hour = 0;
  return hour;
}

/**
 * 카카오톡 대화 내보내기 텍스트를 파싱하여 ChatMessage 배열로 변환
 * @param rawText - 내보내기된 전체 텍스트
 * @returns 파싱된 메시지 배열
 */
function parseKakaoText(rawText: string): ChatMessage[] {
  const lines = rawText.split(/\r?\n/);
  const messages: ChatMessage[] = [];
  let currentDate = "";

  // 날짜 행 정규식 (예: "--------------- 2024년 1월 15일 월요일 ---------------")
  const dateRegex = /^-*\s*(\d{4}년 \d{1,2}월 \d{1,2}일 [가-힣]+요일)\s*-*/;

  // 메시지 행 정규식 (예: "[홍길동] [오전 10:30] 안녕하세요")
  const msgRegex = /^\[(.+?)\]\s*\[(오전|오후)\s*(\d{1,2}:\d{2})\]\s*(.+)/;

  lines.forEach((line) => {
    const dateMatch = line.match(dateRegex);
    if (dateMatch) {
      // 현재 날짜 갱신
      currentDate = dateMatch[1];
    } else {
      const msgMatch = line.match(msgRegex);
      if (msgMatch && currentDate) {
        messages.push({
          date: currentDate,
          sender: msgMatch[1].trim(),
          time: `${msgMatch[2]} ${msgMatch[3]}`,
          content: msgMatch[4].trim(),
        });
      }
    }
  });

  return messages;
}

// ============================================================
// 메인 페이지 컴포넌트
// ============================================================

export default function Home() {
  // 상태 관리
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [keywordInput, setKeywordInput] = useState("이모티콘,사진,클로");
  const [error, setError] = useState<string | null>(null);
  const [topSenderCount, setTopSenderCount] = useState(10);

  // ============================================================
  // 통계 계산 (메시지 배열이 변경될 때마다 자동 재계산)
  // ============================================================
  const stats = useMemo(() => {
    if (messages.length === 0) return null;

    // 발신자별 메시지 수 집계
    const senders: Record<string, number> = {};
    // 시간대별 메시지 수 (0시~23시)
    const hours = Array(24)
      .fill(0)
      .map((_, i) => ({ name: `${i}시`, count: 0 }));
    let profanity = 0; // 욕설 총 횟수
    const profanityBySender: Record<string, number> = {}; // 발신자별 욕설 횟수

    messages.forEach((m) => {
      // 발신자 집계
      senders[m.sender] = (senders[m.sender] || 0) + 1;

      // 시간대 집계
      const h = convertTo24Hour(m.time);
      if (h >= 0) hours[h].count++;

      // 욕설 포함 여부 검사
      let hasProfanity = false;
      PROFANITY_LIST.forEach((word) => {
        if (m.content.includes(word)) {
          profanity++;
          hasProfanity = true;
        }
      });
      if (hasProfanity) {
        profanityBySender[m.sender] = (profanityBySender[m.sender] || 0) + 1;
      }
    });

    // 발신자 데이터를 내림차순 정렬 후 상위 N명만 추출
    const senderData = Object.entries(senders)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topSenderCount);

    // 욕설 발신자 데이터를 내림차순 정렬
    const profanitySenderData = Object.entries(profanityBySender)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topSenderCount);

    return { senderData, hourlyData: hours, profanity, profanitySenderData };
  }, [messages, topSenderCount]);

  // ============================================================
  // 키워드 분석 데이터 (입력된 키워드 변경 시 재계산)
  // ============================================================
  const keywordData = useMemo(() => {
    if (messages.length === 0) return [];

    // 콤마로 구분된 키워드 배열 생성 (공백 제거, 빈 문자열 필터링)
    const keys = keywordInput
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k);

    // 각 키워드가 포함된 메시지 수 계산
    return keys
      .map((k) => ({
        name: k,
        count: messages.filter((m) => m.content.includes(k)).length,
      }))
      .sort((a, b) => b.count - a.count);
  }, [messages, keywordInput]);

  // ============================================================
  // 파일 업로드 핸들러
  // ============================================================
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseKakaoText(ev.target?.result as string);
      if (parsed.length === 0) {
        setError("파싱된 메시지가 없습니다. 파일 형식을 확인해주세요.");
      } else {
        setMessages(parsed);
        setError(null);
      }
    };
    reader.readAsText(file);
  };

  // ============================================================
  // 렌더링: 파일 업로드 전 화면
  // ============================================================
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <Card className="w-full max-w-md border-2 border-dashed border-slate-300 bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl">
          <CardContent className="pt-12 pb-12 flex flex-col items-center gap-6">
            {/* 아이콘 영역 */}
            <div className="rounded-full bg-indigo-50 p-4">
              <UploadCloud className="w-12 h-12 text-indigo-500" />
            </div>

            {/* 안내 텍스트 */}
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold text-slate-800">
                카톡 대화 분석 시작하기
              </h2>
              <p className="text-sm text-slate-500">
                카카오톡에서 내보내기한 .txt 파일을 업로드하세요
              </p>
              {error && (
                <p className="text-red-500 text-xs mt-3 bg-red-50 py-2 px-3 rounded-md">
                  ⚠️ {error}
                </p>
              )}
            </div>

            {/* 숨겨진 파일 인풋과 연결된 버튼 */}
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".txt"
              onChange={handleFileUpload}
            />
            <Button
              onClick={() => document.getElementById("file-upload")?.click()}
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-8"
            >
              파일 선택
            </Button>
          </CardContent>
        </Card>
        <p className="text-xs text-slate-400 mt-6">
          파일은 서버로 전송되지 않고 브라우저에서만 처리됩니다.
        </p>
      </div>
    );
  }

  // ============================================================
  // 렌더링: 분석 대시보드
  // ============================================================
  return (
    <main className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* 헤더 영역 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-800 tracking-tight">
              📊 대화 분석 리포트
            </h1>
            <p className="text-slate-500 mt-1">
              총{" "}
              <span className="font-semibold text-slate-700">
                {messages.length.toLocaleString()}
              </span>
              개의 메시지
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setMessages([])}
            className="border-slate-300 hover:bg-slate-100"
          >
            새 분석 시작
          </Button>
        </div>

        {/* 요약 카드 (KPI) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-white shadow-md border-0 rounded-xl overflow-hidden">
            <CardHeader className="pb-2 flex flex-row justify-between items-center">
              <CardTitle className="text-sm font-medium text-slate-500">
                참여자
              </CardTitle>
              <div className="p-1.5 bg-blue-50 rounded-lg">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-800">
                {stats?.senderData.length ?? 0}
                <span className="text-base font-normal text-slate-500 ml-1">
                  명
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-md border-0 rounded-xl overflow-hidden">
            <CardHeader className="pb-2 flex flex-row justify-between items-center">
              <CardTitle className="text-sm font-medium text-slate-500">
                욕설 감지
              </CardTitle>
              <div className="p-1.5 bg-red-50 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">
                {stats?.profanity ?? 0}
                <span className="text-base font-normal text-slate-500 ml-1">
                  회
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-md border-0 rounded-xl overflow-hidden">
            <CardHeader className="pb-2 flex flex-row justify-between items-center">
              <CardTitle className="text-sm font-medium text-slate-500">
                대화 기간
              </CardTitle>
              <div className="p-1.5 bg-emerald-50 rounded-lg">
                <Calendar className="w-4 h-4 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold text-slate-800 truncate">
                {messages.length > 0
                  ? `${messages[0].date.split("요일")[0].trim()} ~ ${messages[messages.length - 1].date.split("요일")[0].trim()}`
                  : "알 수 없음"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 욕설 발신자별 차트 */}
        {stats?.profanitySenderData && stats.profanitySenderData.length > 0 && (
          <Card className="bg-white shadow-md border-0 rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                욕설 발신자별 분석
              </CardTitle>
              <p className="text-xs text-slate-400 -mt-1">
                욕설 포함 메시지 수 기준 상위 10명
              </p>
            </CardHeader>
            <CardContent className="h-80 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.profanitySenderData}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={90}
                    tick={{ fontSize: 12, fill: "#475569" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "#f1f5f9" }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    radius={[0, 6, 6, 0]}
                    barSize={24}
                    fill="#ef4444"
                    label={{
                      position: "right",
                      fontSize: 11,
                      fill: "#64748b",
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* 차트 영역: 참여자 지분 & 시간대별 활성도 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 참여자 지분 (가로 막대 차트) */}
          <Card className="bg-white shadow-md border-0 rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                대화 지분 TOP {topSenderCount}
              </CardTitle>
              <p className="text-xs text-slate-400 -mt-1">
                메시지 수 기준 상위 {topSenderCount}명
              </p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>표시 인원: {topSenderCount}명</span>
                  <span>1명 ~ 20명</span>
                </div>
                <input
                  id="top-sender-count"
                  type="range"
                  min="1"
                  max="20"
                  value={topSenderCount}
                  onChange={(e) => setTopSenderCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 10)))}
                  className="w-full accent-indigo-500"
                />
              </div>
            </CardHeader>
            <CardContent className="h-80 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats?.senderData}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={90}
                    tick={{ fontSize: 12, fill: "#475569" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "#f1f5f9" }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    radius={[0, 6, 6, 0]}
                    barSize={24}
                    label={{
                      position: "right",
                      fontSize: 11,
                      fill: "#64748b",
                    }}
                  >
                    {stats?.senderData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 시간대별 활성도 (세로 막대 차트) */}
          <Card className="bg-white shadow-md border-0 rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-500" />
                시간대별 메시지 수
              </CardTitle>
              <p className="text-xs text-slate-400 -mt-1">
                24시간 기준 분포
              </p>
            </CardHeader>
            <CardContent className="h-80 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats?.hourlyData}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    interval={3}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    width={55}
                    tickFormatter={(value) =>
                      new Intl.NumberFormat("ko-KR").format(Number(value))
                    }
                  />
                  <Tooltip
                    cursor={{ fill: "#fef3c7" }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#fbbf24"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* 키워드 분석 섹션 */}
        <Card className="bg-white shadow-md border-0 rounded-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              키워드 트렌드 분석
            </CardTitle>
            <p className="text-xs text-slate-400 -mt-1">
              콤마(,)로 구분하여 여러 키워드를 입력하세요
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 키워드 입력 필드 */}
            <div className="max-w-xl">
              <Input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                placeholder="예: 이모티콘, 사진, 클로바"
                className="bg-slate-50 border-slate-200 focus:ring-emerald-500"
              />
            </div>

            {/* 키워드 빈도 차트 */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={keywordData}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "#475569" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    width={55}
                    tickFormatter={(value) =>
                      new Intl.NumberFormat("ko-KR").format(Number(value))
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={50}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 푸터 (데이터 기준 안내) */}
        <div className="text-right text-xs text-slate-400 border-t pt-4 border-slate-200">
          분석 기준: 전체 {messages.length.toLocaleString()}개 메시지
        </div>
      </div>
    </main>
  );
}